import { WebSocket } from 'ws';
import { roomManager } from '../services/RoomManager.js';

interface ExtendedWebSocket extends WebSocket {
    roomId?: string | null;
    intentionalLeave?: boolean;
}

interface LeavePayload {
    type: "LEAVE_ROOM";
}

export function handleLeave(ws: WebSocket, payload: LeavePayload): void {
    const socket = ws as ExtendedWebSocket;
    void payload;

    // Mark as intentional leave - this will be handled in connection close
    socket.intentionalLeave = true;
    if (socket.roomId) {
        void roomManager.leaveRoom(socket.roomId, socket);
    }

    // Close the connection
    socket.close(1000, "Intentional leave");
}
