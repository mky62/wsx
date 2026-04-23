import { WebSocket } from 'ws';
import { CustomWebSocket } from '../types/room.js';
import { routeMessage } from './messageRouter.js';
import { roomManager } from '../services/RoomManager.js';

export function handleConnection(ws: WebSocket) {
  const socket = ws as CustomWebSocket;
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
