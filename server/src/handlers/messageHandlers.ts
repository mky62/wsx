import { roomManager } from "../services/RoomManager.js";
import { CustomWebSocket } from "../types/room.js";

interface TextMessagePayload {
    type: "SEND_MESSAGE";
    text: string;
}

const MESSAGE_LIMIT = 1000;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_MESSAGES = 20;

export async function handleMessage(ws: CustomWebSocket, payload: TextMessagePayload): Promise<void> {
    if (!ws.roomId || !ws.username || !ws.participantId) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "not_joined",
            message: "join a room before sending messages"
        });
        return;
    }

    if (isRateLimited(ws)) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "rate_limited",
            message: "too many messages; slow down"
        });
        return;
    }

    if (!payload.text || typeof payload.text !== 'string' || payload.text.trim().length === 0) {
        return;
    }

    const text = payload.text.trim();
    if (text.length > MESSAGE_LIMIT) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "message_too_long",
            message: `message too long (max ${MESSAGE_LIMIT} characters)`
        });
        return;
    }

    await roomManager.createMessage(ws.roomId, ws, text);
}

function isRateLimited(ws: CustomWebSocket): boolean {
    const now = Date.now();
    const timestamps = ws.messageTimestamps || [];
    const recent = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX_MESSAGES) {
        ws.messageTimestamps = recent;
        return true;
    }

    recent.push(now);
    ws.messageTimestamps = recent;
    return false;
}
