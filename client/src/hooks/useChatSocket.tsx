import React, { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../state/chatReducer";

export interface ParticipantView {
  participantId: string;
  username: string;
  connected: boolean;
  lastSeenAt: number;
}

type ChatSocketMeta = {
  userCount?: number;
  participants?: ParticipantView[];
};

export type ChatSocketMessage = ChatSocketMeta & (
  | {
      type: "JOINED";
      roomId: string;
      participantId: string;
      reconnectToken: string;
      username: string;
      userCount: number;
      participants: ParticipantView[];
      history?: ChatMessage[];
      reconnected: boolean;
      historyEnabled: boolean;
    }
  | { type: "ERROR"; code: string; message: string }
  | { type: "SYSTEM_NOTICE"; text: string; timestamp: number }
  | ChatMessage
  | {
      type: "PARTICIPANTS_UPDATED";
      participants: ParticipantView[];
      userCount: number;
    }
);

interface UseChatSocketParams {
  roomId: string;
  username: string;
  participantId?: string;
  reconnectToken?: string;
  onMessage: (data: ChatSocketMessage) => void;
}

interface UseChatSocketReturn {
  socketRef: React.RefObject<WebSocket | null>;
  isConnected: boolean;
}

export function useChatSocket({
  roomId,
  username,
  participantId,
  reconnectToken,
  onMessage
}: UseChatSocketParams): UseChatSocketReturn {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const participantIdRef = useRef(participantId);
  const reconnectTokenRef = useRef(reconnectToken);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    participantIdRef.current = participantId;
    reconnectTokenRef.current = reconnectToken;
  }, [participantId, reconnectToken]);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!roomId || !username) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let shouldReconnect = true;
    let retryCount = 0;

    const connect = () => {
      const socket = new WebSocket(import.meta.env.VITE_WS_URL || "ws://localhost:8080");
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        retryCount = 0;
        socket.send(JSON.stringify({
          type: "JOIN_ROOM",
          roomId,
          username,
          participantId: participantIdRef.current,
          reconnectToken: reconnectTokenRef.current
        }));
      };

      socket.onclose = (event: CloseEvent) => {
        setIsConnected(false);
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        if (!shouldReconnect || event.code === 1000) return;

        const delay = Math.min(1000 * 2 ** retryCount, 5000);
        retryCount += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        setIsConnected(false);
      };

      socket.onmessage = (e: MessageEvent) => {
        let data: ChatSocketMessage;
        try {
          data = JSON.parse(e.data) as ChatSocketMessage;
        } catch {
          onMessageRef.current({
            type: "ERROR",
            code: "invalid_server_message",
            message: "Received an invalid server message",
          });
          return;
        }

        if (data.type === "JOINED") {
          participantIdRef.current = data.participantId;
          reconnectTokenRef.current = data.reconnectToken;
        }

        onMessageRef.current(data);
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close(1000, "Component unmounted");
      socketRef.current = null;
    };
  }, [roomId, username]);

  return { socketRef, isConnected };
}
