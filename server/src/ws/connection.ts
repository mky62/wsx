import { WebSocket } from 'ws';
import { routeMessage } from './messageRouter.js';
import { roomManager } from '../services/RoomManager.js';

export interface ExtendedWebSocket extends WebSocket {
  roomId: string | null;
  participantId: string | null;
  username: string | null;
  intentionalLeave?: boolean;
  replaced?: boolean;
  messageTimestamps: number[];
}

export function handleConnection(ws: WebSocket) {
  const socket = ws as ExtendedWebSocket;
  socket.roomId = null;
  socket.participantId = null;
  socket.username = null;
  socket.messageTimestamps = [];

  socket.on("message", async (raw: Buffer) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch (error) {
      // Send error response to client
      roomManager.sendToUser(socket, {
        type: "ERROR",
        code: "invalid_json",
        message: "Invalid JSON format"
      });
      return;
    }

    await routeMessage(socket, msg);
  });

  socket.on("close", () => {
    if (!socket.roomId) return;

    // Use markDisconnected for reconnect handling
    roomManager.markDisconnected(socket.roomId, socket);
  });
}
