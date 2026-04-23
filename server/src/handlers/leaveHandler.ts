import { CustomWebSocket } from '../types/room.js';
import { roomManager } from '../services/RoomManager.js';

interface LeavePayload {
    type: "LEAVE_ROOM";
}

export function handleLeave(ws: CustomWebSocket, payload: LeavePayload): void {
    void payload;

    // Mark as intentional leave - this will be handled in connection close
    ws.intentionalLeave = true;
    if (ws.roomId) {
        void roomManager.leaveRoom(ws.roomId, ws);
    }

    // Close the connection
    ws.close(1000, "Intentional leave");
}
