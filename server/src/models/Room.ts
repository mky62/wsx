import WebSocket from "ws";
import {
    CustomWebSocket,
    DisconnectedUserInfo,
    ParticipantRecord,
    ParticipantView,
    ServerPayload
} from "../types/room.js";

export class Room {
    public readonly id: string;
    public participants: Map<string, ParticipantRecord> = new Map();
    public disconnectedUsers: Map<string, DisconnectedUserInfo> = new Map();
    public readonly createdAt: number;

    constructor(id: string, createdAt: number) {
        this.id = id;
        this.createdAt = createdAt;
    }

    public broadcast(payload: ServerPayload): void {
        const msg = JSON.stringify(payload);
        for (const participant of this.participants.values()) {
            const client = participant.socket;
            if (client && client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        }
    }

    public sendToUser(ws: WebSocket | CustomWebSocket, payload: ServerPayload): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(payload));
        }
    }

    public addParticipant(participant: ParticipantRecord, socket: CustomWebSocket): void {
        socket.roomId = this.id;
        socket.participantId = participant.participantId;
        socket.username = participant.username;

        participant.connected = true;
        participant.lastSeenAt = Date.now();
        participant.socket = socket;
        this.participants.set(participant.participantId, participant);
    }

    public removeParticipant(participantId: string): ParticipantRecord | null {
        const participant = this.participants.get(participantId);
        if (!participant) return null;

        this.participants.delete(participantId);
        participant.connected = false;
        participant.lastSeenAt = Date.now();
        participant.socket = null;
        return participant;
    }

    public hasUsername(username: string): boolean {
        for (const participant of this.participants.values()) {
            if (participant.username === username) return true;
        }
        for (const disconnected of this.disconnectedUsers.values()) {
            if (disconnected.participant.username === username) return true;
        }
        return false;
    }

    public getParticipantBySocket(socket: CustomWebSocket): ParticipantRecord | null {
        if (!socket.participantId) return null;
        return this.participants.get(socket.participantId) || null;
    }

    public getParticipantView(): ParticipantView[] {
        return [...this.participants.values()]
            .map(({ participantId, username, connected, lastSeenAt }) => ({
                participantId,
                username,
                connected,
                lastSeenAt
            }))
            .sort((a, b) => a.username.localeCompare(b.username));
    }

    public get userCount(): number {
        return this.participants.size;
    }

    public get isEmpty(): boolean {
        return this.participants.size === 0 && this.disconnectedUsers.size === 0;
    }

    public clearAllReconnectTimers(): void {
        for (const info of this.disconnectedUsers.values()) {
            clearTimeout(info.timer);
        }
    }
}
