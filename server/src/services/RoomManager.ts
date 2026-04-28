import WebSocket from "ws";
import { customAlphabet, nanoid } from "nanoid";
import crypto from "crypto";
import { CustomWebSocket, ImageChatMessage, ParticipantRecord, ServerPayload, TextChatMessage } from "../types/room.js";
import { Room } from "../models/Room.js";
import { messageStore } from "./messageService.js";

const RECONNECT_GRACE_PERIOD_MS = 30 * 1000;
const MAX_PARTICIPANTS_PER_ROOM = 50;
const MAX_ROOMS = 1000;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_MESSAGES = 20;
const ROOM_ID_RESERVATION_MS = 30 * 1000;
const ROOM_ID_GENERATION_ATTEMPTS = 5;
const defaultCreateRoomId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789-", 10);
const USERNAME_REGEX = /^[a-zA-Z0-9_]{5,25}$/;
const ROOM_REGEX = /^[a-zA-Z0-9_-]{5,35}$/;

interface JoinResult {
    roomId: string;
    participantId: string;
    reconnectToken: string;
    username: string;
    userCount: number;
    participants: ReturnType<Room["getParticipantView"]>;
    history: TextChatMessage[];
    reconnected: boolean;
    historyEnabled: boolean;
}

class RoomManager {
    public rooms: Map<string, Room> = new Map();
    private pendingRoomReservations: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private roomIdGenerator: () => string = defaultCreateRoomId;

    public createRoomId(): string {
        if (this.rooms.size + this.pendingRoomReservations.size >= MAX_ROOMS) {
            throw new Error("server at capacity; try again later");
        }

        for (let attempt = 0; attempt < ROOM_ID_GENERATION_ATTEMPTS; attempt += 1) {
            const roomId = this.roomIdGenerator();
            if (this.rooms.has(roomId) || this.pendingRoomReservations.has(roomId)) {
                continue;
            }

            const timer = setTimeout(() => {
                this.pendingRoomReservations.delete(roomId);
            }, ROOM_ID_RESERVATION_MS);

            this.pendingRoomReservations.set(roomId, timer);
            return roomId;
        }

        throw new Error("failed to allocate room id; try again");
    }

    private async getOrCreateRoom(roomId: string): Promise<Room> {
        let room = this.rooms.get(roomId);
        if (!room) {
            const hasReservation = this.pendingRoomReservations.has(roomId);
            if (this.rooms.size + this.pendingRoomReservations.size >= MAX_ROOMS && !hasReservation) {
                throw new Error("server at capacity; try again later");
            }

            this.releasePendingRoomReservation(roomId);
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
        if (!ROOM_REGEX.test(roomId)) {
            throw new Error("invalid room id");
        }

        if (!USERNAME_REGEX.test(username)) {
            throw new Error("invalid username");
        }

        const socket = ws as CustomWebSocket;
        const room = await this.getOrCreateRoom(roomId);

        const reconnect = this.getReconnectParticipant(room, username, participantId, reconnectToken);
        const active = this.getActiveParticipant(room, username, participantId, reconnectToken);

        if (room.userCount >= MAX_PARTICIPANTS_PER_ROOM && !reconnect && !active) {
            throw new Error("room is full");
        }

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
                socket: null,
                messageTimestamps: []
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

        return joinResult;
    }

    public finalizeJoin(roomId: string, username: string, reconnected: boolean): void {
        const room = this.rooms.get(roomId);
        if (!room) return;

        this.broadcastParticipants(room);
        this.broadcastSystem(room, `${username} ${reconnected ? "reconnected" : "joined"}`);
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

    public async createMessage(roomId: string, ws: WebSocket, text: string): Promise<TextChatMessage> {
        const socket = ws as CustomWebSocket;
        const room = this.rooms.get(roomId);
        if (!room || !socket.participantId) {
            throw new Error("room not joined");
        }

        const participant = room.participants.get(socket.participantId);
        if (!participant) {
            throw new Error("participant not joined");
        }

        const message: TextChatMessage = {
            id: crypto.randomUUID(),
            type: "MESSAGE_CREATED",
            participantId: participant.participantId,
            username: participant.username,
            contentType: "text",
            text,
            timestamp: Date.now()
        };

        room.broadcast(message);
        void messageStore.saveMessage(roomId, message);
        return message;
    }

    public createImageMessage(
        roomId: string,
        participantId: string,
        image: ImageChatMessage["image"]
    ): ImageChatMessage {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error("room not joined");
        }

        const participant = room.participants.get(participantId);
        if (!participant) {
            throw new Error("participant not joined");
        }

        const message: ImageChatMessage = {
            id: crypto.randomUUID(),
            type: "MESSAGE_CREATED",
            participantId: participant.participantId,
            username: participant.username,
            contentType: "image",
            image,
            timestamp: Date.now()
        };

        room.broadcast(message);
        return message;
    }

    public sendToUser(ws: WebSocket, payload: ServerPayload): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(payload));
        }
    }

    public isRateLimited(roomId: string, participantId: string): boolean {
        const room = this.rooms.get(roomId);
        const participant = room?.participants.get(participantId);
        if (!participant) {
            return false;
        }

        const now = Date.now();
        const recent = participant.messageTimestamps.filter(
            (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
        );

        if (recent.length >= RATE_LIMIT_MAX_MESSAGES) {
            participant.messageTimestamps = recent;
            return true;
        }

        recent.push(now);
        participant.messageTimestamps = recent;
        return false;
    }

    public getActiveParticipantForRequest(
        roomId: string,
        participantId: string,
        reconnectToken: string
    ): ParticipantRecord | null {
        const room = this.rooms.get(roomId);
        const participant = room?.participants.get(participantId);
        if (!participant || !this.isValidReconnectToken(participant, reconnectToken)) {
            return null;
        }

        return participant;
    }

    public clearPendingRoomReservations(): void {
        for (const timer of this.pendingRoomReservations.values()) {
            clearTimeout(timer);
        }
        this.pendingRoomReservations.clear();
    }

    public setRoomIdGeneratorForTesting(generator?: () => string): void {
        this.roomIdGenerator = generator ?? defaultCreateRoomId;
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

    private releasePendingRoomReservation(roomId: string): void {
        const timer = this.pendingRoomReservations.get(roomId);
        if (timer) {
            clearTimeout(timer);
            this.pendingRoomReservations.delete(roomId);
        }
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
