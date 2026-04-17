import { ExtendedWebSocket } from './connection.js';
import { handleJoin } from '../handlers/joinHandler.js';
import { handleMessage } from '../handlers/messageHandlers.js';
import { handleLeave } from '../handlers/leaveHandler.js';
import { roomManager } from '../services/RoomManager.js';

type MessageType =
    | "JOIN_ROOM"
    | "SEND_MESSAGE"
    | "LEAVE_ROOM";

export interface MessagePayload {
    type: MessageType;
    [key: string]: any; //allow addtional properties
}

type MessageHandler = (ws: ExtendedWebSocket, message: any) => void | Promise<void>;

const handlers: Record<MessageType, MessageHandler> = {
    "JOIN_ROOM": handleJoin as MessageHandler,
    "SEND_MESSAGE": handleMessage as MessageHandler,
    "LEAVE_ROOM": handleLeave as MessageHandler,
};

function isMessageType(type: unknown): type is MessageType {
    return typeof type === "string" && type in handlers;
}

export async function routeMessage(ws: ExtendedWebSocket, message: any) {
    const type = message?.type;
    if (!isMessageType(type)) {
        // Send error response to client instead of silent fail
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "unknown_message_type",
            message: `Unknown message type: ${String(type)}`
        });
        return;
    }

    try {
        await handlers[type](ws, message);
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        roomManager.sendToUser(ws, {
            type: "ERROR",
            code: "handler_failed",
            message: errorMsg
        });
    }
}
