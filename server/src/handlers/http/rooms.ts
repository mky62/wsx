import { ServerResponse, IncomingMessage } from 'http';
import { roomManager } from '../../services/RoomManager.js';
import { sendJson } from '../../utils/http.js';

export function handleCreateRoom(
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
    origin?: string
): void {
    sendJson(res, 201, {
        roomId: roomManager.createRoomId()
    }, origin);
}
