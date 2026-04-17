import WebSocket from "ws";
import { customAlphabet, nanoid } from "nanoid";
import crypto from "crypto";
import { CustomWebSocket, ChatMessage, ParticipantRecord, ServerPayload } from "../types/room.js";
import { Room } from "../models/Room.js";
import { messageStore } from "./messageService.js";

const RECONNECT_GRACE_PERIOD_MS = 30 * 1000;
const createRoomId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789-", 10);

interface JoinResult {
    roomId: string;
    participantId: string;
    reconnectToken: string;
    username: string;
    userCount: number;
    participants: ReturnType<Room["getParticipantView"]>;
    history: ChatMessage[];
    reconnected: boolean;
    historyEnabled: boolean;
}

class RoomManager {
    public rooms: Map<string, Room> = new Map();

    public createRoomId(): string {
        return createRoomId();
    }

    private async getOrCreateRoom(roomId: string): Promise<Room> {
        let room = this.rooms.get(roomId);
        if (!room) {
            room = new Room(roomId, Date.now());
            this.rooms.set(roomId, room);
            await messageStore.deleteRoomMessages(roomId);
        }
        return room;
    }

    public async joinRoom(
        roomId: string,
        username: string,
        ws: WebSocket,
        participantId?: string,
        reconnectToken?: string
    ): Promise<JoinResult> {
        const socket = ws as CustomWebSocket;
        const room = await this.getOrCreateRoom(roomId);

        const reconnect = this.getReconnectParticipant(room, username, participantId, reconnectToken);
        const active = this.getActiveParticipant(room, username, participantId, reconnectToken);

        if (!reconnect && !active && room.hasUsername(username)) {
            throw new Error("username already taken");
        }

        let participant: ParticipantRecord;
        let token = reconnectToken || "";
        let reconnected = false;

        if (reconnect) {
            clearTimeout(reconnect.timer);
            room.disconnectedUsers.delete(reconnect.participant.participantId);
            participant = reconnect.participant;
            reconnected = true;
        } else if (active) {
            active.socket!.replaced = true;
            active.socket!.close(1000, "Session replaced");
            participant = active;
            reconnected = true;
        } else {
            token = nanoid(32);
            participant = {
                participantId: nanoid(16),
                username,
                reconnectTokenHash: this.hashReconnectToken(token),
                connected: true,
                lastSeenAt: Date.now(),
                socket: null
            };
        }

        room.addParticipant(participant, socket);
        const history = await messageStore.getMessages(roomId);

        const joinResult = {
            roomId,
            participantId: participant.participantId,
            reconnectToken: token,
            username: participant.username,
            userCount: room.userCount,
            participants: room.getParticipantView(),
            history,
            reconnected,
            historyEnabled: messageStore.isEnabled
        };

        this.broadcastParticipants(room);
        this.broadcastSystem(room, `${participant.username} ${reconnected ? "reconnected" : "joined"}`);
        return joinResult;
    }

    public async leaveRoom(roomId: string, ws: WebSocket): Promise<void> {
        const socket = ws as CustomWebSocket;
        const room = this.rooms.get(roomId);
        if (!room || !socket.participantId) return;

        const participant = room.removeParticipant(socket.participantId);
        socket.roomId = null;
        socket.participantId = null;
        socket.username = null;

        if (participant) {
            this.broadcastSystem(room, `${participant.username} left`);
            this.broadcastParticipants(room);
        }

        await this.deleteRoomIfEmpty(roomId, room);
    }

    public markDisconnected(roomId: string, ws: WebSocket): void {
        const socket = ws as CustomWebSocket;
        if (socket.replaced) return;

        const room = this.rooms.get(roomId);
        if (!room || !socket.participantId) return;

        if (socket.intentionalLeave) {
            void this.leaveRoom(roomId, socket);
            return;
        }

        const participant = room.removeParticipant(socket.participantId);
        if (!participant) return;

        const timer = setTimeout(() => {
            room.disconnectedUsers.delete(participant.participantId);
            this.broadcastParticipants(room);
            void this.deleteRoomIfEmpty(roomId, room);
        }, RECONNECT_GRACE_PERIOD_MS);

        room.disconnectedUsers.set(participant.participantId, {
            participant,
            timer
        });

        this.broadcastSystem(room, `${participant.username} disconnected`);
        this.broadcastParticipants(room);
    }

    public async createMessage(roomId: string, ws: WebSocket, text: string): Promise<ChatMessage> {
        const socket = ws as CustomWebSocket;
        const room = this.rooms.get(roomId);
        if (!room || !socket.participantId) {
            throw new Error("room not joined");
        }

        const participant = room.participants.get(socket.participantId);
        if (!participant) {
            throw new Error("participant not joined");
        }

        const message: ChatMessage = {
            id: crypto.randomUUID(),
            type: "MESSAGE_CREATED",
            participantId: participant.participantId,
            username: participant.username,
            text,
            timestamp: Date.now()
        };

        room.broadcast(message);
        void messageStore.saveMessage(roomId, message);
        return message;
    }

    public sendToUser(ws: WebSocket, payload: ServerPayload): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(payload));
        }
    }

    private getReconnectParticipant(
        room: Room,
        username: string,
        participantId?: string,
        reconnectToken?: string
    ) {
        if (!participantId || !reconnectToken) return null;
        const disconnected = room.disconnectedUsers.get(participantId);
        if (!disconnected) return null;
        if (disconnected.participant.username !== username) return null;
        if (!this.isValidReconnectToken(disconnected.participant, reconnectToken)) return null;
        return disconnected;
    }

    private getActiveParticipant(
        room: Room,
        username: string,
        participantId?: string,
        reconnectToken?: string
    ): ParticipantRecord | null {
        if (!participantId || !reconnectToken) return null;
        const participant = room.participants.get(participantId);
        if (!participant || participant.username !== username) return null;
        if (!this.isValidReconnectToken(participant, reconnectToken)) return null;
        return participant;
    }

    private isValidReconnectToken(participant: ParticipantRecord, reconnectToken: string): boolean {
        return crypto.timingSafeEqual(
            Buffer.from(participant.reconnectTokenHash),
            Buffer.from(this.hashReconnectToken(reconnectToken))
        );
    }

    private hashReconnectToken(token: string): string {
        return crypto.createHash("sha256").update(token).digest("hex");
    }

    private broadcastParticipants(room: Room): void {
        room.broadcast({
            type: "PARTICIPANTS_UPDATED",
            participants: room.getParticipantView(),
            userCount: room.userCount
        });
    }

    private broadcastSystem(room: Room, text: string): void {
        room.broadcast({
            type: "SYSTEM_NOTICE",
            text,
            timestamp: Date.now()
        });
    }

    private async deleteRoomIfEmpty(roomId: string, room: Room): Promise<void> {
        if (!room.isEmpty) return;

        room.clearAllReconnectTimers();
        this.rooms.delete(roomId);
        await messageStore.deleteRoomMessages(roomId);
    }
}

export const roomManager = new RoomManager();
