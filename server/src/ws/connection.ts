import { WebSocket } from 'ws';
import { CustomWebSocket } from '../types/room.js';
import { routeMessage } from './messageRouter.js';
import { roomManager } from '../services/RoomManager.js';

const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;

export function handleConnection(ws: WebSocket) {
  const socket = ws as CustomWebSocket;
  socket.roomId = null;
  socket.participantId = null;
  socket.username = null;
  socket.messageTimestamps = [];

  let pongTimeout: ReturnType<typeof setTimeout> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;

  function startHeartbeat() {
    pingInterval = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        stopHeartbeat();
        return;
      }

      pongTimeout = setTimeout(() => {
        socket.terminate();
      }, PONG_TIMEOUT_MS);

      socket.ping();
    }, PING_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (pingInterval) clearInterval(pingInterval);
    if (pongTimeout) clearTimeout(pongTimeout);
    pingInterval = null;
    pongTimeout = null;
  }

  socket.on("pong", () => {
    if (pongTimeout) clearTimeout(pongTimeout);
    pongTimeout = null;
  });

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
    stopHeartbeat();
    if (!socket.roomId) return;

    // Use markDisconnected for reconnect handling
    roomManager.markDisconnected(socket.roomId, socket);
  });

  startHeartbeat();
}
