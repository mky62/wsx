import { useEffect, useReducer, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import ChatTop from "../components/chat/ChatTop";
import ChatBottom from "../components/chat/ChatBottom";
import MessageBubble from "../components/chat/MessageBubble";
import SystemMessage from "../components/chat/SystemMessage";
import { chatReducer } from "../state/chatReducer";
import { useChatSocket } from "../hooks/useChatSocket";
import type { ChatSocketMessage, ParticipantView } from "../hooks/useChatSocket";

interface LocationState {
  username: string;
}

interface StoredChatSession {
  username: string;
  participantId?: string;
  reconnectToken?: string;
}

function readStoredSession(roomId: string): StoredChatSession | null {
  try {
    const stored = sessionStorage.getItem(`chat_session_${roomId}`);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<StoredChatSession>;
    if (typeof parsed.username !== "string") return null;

    return {
      username: parsed.username,
      participantId: typeof parsed.participantId === "string" ? parsed.participantId : undefined,
      reconnectToken: typeof parsed.reconnectToken === "string" ? parsed.reconnectToken : undefined,
    };
  } catch {
    return null;
  }
}

function ChatView() {
  const [messages, dispatch] = useReducer(chatReducer, []);
  const [participants, setParticipants] = useState<ParticipantView[]>([]);
  const [joinConfirmed, setJoinConfirmed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { roomId: routeRoomId } = useParams<{ roomId: string }>();
  const { state } = useLocation() as { state: LocationState | null };
  const navigate = useNavigate();
  const roomId = routeRoomId ?? "";

  const [session, setSession] = useState<StoredChatSession>(() => {
    const stored = roomId ? readStoredSession(roomId) : null;
    const username = state?.username || stored?.username || "";
    const canReuseReconnect = stored?.username === username;

    return {
      username,
      participantId: canReuseReconnect ? stored?.participantId : undefined,
      reconnectToken: canReuseReconnect ? stored?.reconnectToken : undefined,
    };
  });

  useEffect(() => {
    if (!roomId || !session.username) return;
    sessionStorage.setItem(`chat_session_${roomId}`, JSON.stringify(session));
  }, [roomId, session]);

  useEffect(() => {
    if (!session.username || !roomId) {
      navigate("/", { replace: true });
    }
  }, [navigate, roomId, session.username]);

  const { socketRef, isConnected } = useChatSocket({
    roomId,
    username: session.username,
    participantId: session.participantId,
    reconnectToken: session.reconnectToken,
    onMessage: (data: ChatSocketMessage) => {
      if (data.type === "ERROR") {
        setError(data.message);
        return;
      }

      setError(null);

      if (data.type === "JOINED") {
        setSession({
          username: data.username,
          participantId: data.participantId,
          reconnectToken: data.reconnectToken,
        });
        setParticipants(data.participants);
        if (data.history && Array.isArray(data.history)) {
          dispatch({ type: "SET_HISTORY", payload: data.history });
        }
        setJoinConfirmed(true);
        return;
      }

      if (data.type === "PARTICIPANTS_UPDATED") {
        setParticipants(data.participants);
        return;
      }

      if (data.type === "SYSTEM_NOTICE") {
        dispatch({
          type: "ADD_MESSAGE",
          payload: {
            id: `system-${data.timestamp}`,
            type: "SYSTEM",
            text: data.text,
            timestamp: data.timestamp,
          },
        });
        return;
      }

      if (data.type === "MESSAGE_CREATED") {
        dispatch({ type: "ADD_MESSAGE", payload: data });
      }
    },
  });

  if (!session.username || !roomId) {
    return null;
  }

  const handleLeave = (): void => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "LEAVE_ROOM" }));
      socketRef.current.close(1000, "Intentional leave");
    }
    sessionStorage.removeItem(`chat_session_${roomId}`);
    navigate("/", { replace: true });
  };

  return (
    <div className="relative h-dvh w-full">
      <div className="absolute inset-0 bg-cover bg-center bg-[#cfa913] bg-[linear-gradient(15deg,rgba(207,169,19,0.99)_6%,rgba(0,181,157,0.95)_100%)]" />
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 flex flex-col h-full">
        <ChatTop
          roomId={roomId}
          userCount={participants.length}
          onLeave={handleLeave}
        />

        {error && (
          <div className="mx-4 mt-3 rounded-md border border-red-300/50 bg-red-950/80 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!joinConfirmed ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white text-lg">Joining room...</div>
            </div>
          ) : (
            messages.map((m) =>
              m.type === "SYSTEM" ? (
                <SystemMessage key={m.id} text={m.text} />
              ) : (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isSelf={m.participantId === session.participantId}
                />
              )
            )
          )}
        </div>

        <ChatBottom
          socketRef={socketRef}
          isConnected={isConnected && joinConfirmed}
        />
      </div>
    </div>
  );
}

export default ChatView;
