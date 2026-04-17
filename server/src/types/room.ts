import WebSocket from "ws";

export interface CustomWebSocket extends WebSocket {
    roomId: string | null;
    participantId: string | null;
    username: string | null;
    intentionalLeave?: boolean;
    replaced?: boolean;
    messageTimestamps: number[];
}

export interface ParticipantView {
    participantId: string;
    username: string;
    connected: boolean;
    lastSeenAt: number;
}

export interface ParticipantRecord extends ParticipantView {
    reconnectTokenHash: string;
    socket: CustomWebSocket | null;
}

export interface DisconnectedUserInfo {
    participant: ParticipantRecord;
    timer: NodeJS.Timeout;
}

export interface ChatMessage {
    id: string;
    type: "MESSAGE_CREATED";
    participantId: string;
    username: string;
    text: string;
    timestamp: number;
}

export type ServerPayload =
    | {
        type: "JOINED";
        roomId: string;
        participantId: string;
        reconnectToken: string;
        username: string;
        participants: ParticipantView[];
        userCount: number;
        history: ChatMessage[];
        reconnected: boolean;
        historyEnabled: boolean;
    }
    | ChatMessage
    | {
        type: "PARTICIPANTS_UPDATED";
        participants: ParticipantView[];
        userCount: number;
    }
    | { type: "SYSTEM_NOTICE"; text: string; timestamp: number }
    | { type: "ERROR"; code: string; message: string };
