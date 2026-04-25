import { roomManager } from "../services/RoomManager.js";
import { CustomWebSocket } from "../types/room.js";

interface TextMessagePayload {
    type: "SEND_MESSAGE";
    text: string;
}

const MESSAGE_LIMIT = 1000;

export async function handleMessage(ws: CustomWebSocket, payload: TextMessagePayload): Promise<void> {
    if (!ws.roomId || !ws.username || !ws.participantId) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "not_joined",
            message: "join a room before sending messages"
        });
        return;
    }

    if (typeof payload.text !== 'string') {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "invalid_message",
            message: "text must be a string"
        });
        return;
    }

    const text = payload.text.trim();
    if (text.length === 0) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "invalid_message",
            message: "message text cannot be empty"
        });
        return;
    }

    if (roomManager.isRateLimited(ws.roomId, ws.participantId)) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "rate_limited",
            message: "too many messages; slow down"
        });
        return;
    }

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
