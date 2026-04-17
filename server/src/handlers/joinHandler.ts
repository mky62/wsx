import { WebSocket } from 'ws';
import { roomManager } from '../services/RoomManager.js'

interface JoinPayload {
    type: "JOIN_ROOM";
    roomId?: string;
    username?: string;
    participantId?: string;
    reconnectToken?: string;
}

export async function handleJoin(ws: WebSocket, payload: JoinPayload): Promise<void> {
    if (!payload.roomId || !payload.username) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "invalid_join",
            message: "roomId and username are required"
        });
        return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]{5,25}$/;
    const roomRegex = /^[a-zA-Z0-9_-]{5,35}$/;

    if (!usernameRegex.test(payload.username)) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "invalid_username",
            message: "invalid username"
        });
        return;
    }

    if (!roomRegex.test(payload.roomId)) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "invalid_room_id",
            message: "invalid room id"
        });
        return;
    }

    let result: Awaited<ReturnType<typeof roomManager.joinRoom>>;
    try {
        result = await roomManager.joinRoom(
            payload.roomId,
            payload.username,
            ws,
            payload.participantId,
            payload.reconnectToken
        );
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : "unknown error";
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "join_failed",
            message: errorMessage
        });
        return;
    }

    roomManager.sendToUser(ws, {
        type: "JOINED",
        ...result
    });
}
