import WebSocket from "ws";

export interface CustomWebSocket extends WebSocket {
    roomId: string | null;
    participantId: string | null;
    username: string | null;
    intentionalLeave?: boolean;
    replaced?: boolean;
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
    messageTimestamps: number[];
}

export interface DisconnectedUserInfo {
    participant: ParticipantRecord;
    timer: NodeJS.Timeout;
}

export interface TextChatMessage {
    id: string;
    type: "MESSAGE_CREATED";
    participantId: string;
    username: string;
    contentType?: "text";
    text: string;
    timestamp: number;
}

export interface ImageChatMessage {
    id: string;
    type: "MESSAGE_CREATED";
    participantId: string;
    username: string;
    contentType: "image";
    image: {
        id: string;
        token: string;
        url: string;
        mimeType: string;
        sizeBytes: number;
        width?: number;
        height?: number;
        expiresAt: number;
    };
    timestamp: number;
}

export type ChatMessage = TextChatMessage | ImageChatMessage;

export type ServerPayload =
    | {
        type: "JOINED";
        roomId: string;
        participantId: string;
        reconnectToken: string;
        username: string;
        participants: ParticipantView[];
        userCount: number;
        history: TextChatMessage[];
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
