import { useEffect, useReducer, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import ChatTop from "../components/chat/ChatTop";
import ChatBottom from "../components/chat/ChatBottom";
import MessageBubble from "../components/chat/MessageBubble";
import RoomMembersPanel from "../components/chat/RoomMembersPanel";
import SystemMessage from "../components/chat/SystemMessage";
import { chatReducer } from "../state/chatReducer";
import { useChatSocket } from "../hooks/useChatSocket";
import { getApiBaseUrl } from "../utils/api";
import type { ImageChatMessage } from "../state/chatReducer";
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

function getStoredImageKey(roomId: string): string {
  return `chat_images_${roomId}`;
}

function readStoredImages(roomId: string): ImageChatMessage[] {
  try {
    const stored = sessionStorage.getItem(getStoredImageKey(roomId));
    if (!stored) return [];

    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isStoredImageMessage);
  } catch {
    return [];
  }
}

function writeStoredImage(roomId: string, message: ImageChatMessage): void {
  try {
    const current = readStoredImages(roomId).filter((stored) => stored.id !== message.id);
    const next = [...current, message].sort((a, b) => a.timestamp - b.timestamp);
    sessionStorage.setItem(getStoredImageKey(roomId), JSON.stringify(next));
  } catch {
    // sessionStorage quota is browser-defined; live delivery still works if caching fails.
  }
}

function isStoredImageMessage(value: unknown): value is ImageChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ImageChatMessage>;
  return message.type === "MESSAGE_CREATED"
    && message.contentType === "image"
    && typeof message.id === "string"
    && typeof message.participantId === "string"
    && typeof message.username === "string"
    && typeof message.timestamp === "number"
    && Boolean(message.image)
    && typeof message.image?.id === "string"
    && typeof message.image?.dataUrl === "string";
}

async function fetchImageDataUrl(imageUrl: string): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}${imageUrl}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("image unavailable");
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function ChatView() {
  const viewportStyle = useLockedVisualViewport();
  const [messages, dispatch] = useReducer(chatReducer, []);
  const [participants, setParticipants] = useState<ParticipantView[]>([]);
  const [joinConfirmed, setJoinConfirmed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isMembersOpen, setIsMembersOpen] = useState<boolean>(false);

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

  useEffect(() => {
    if (!isMembersOpen) return;

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setIsMembersOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isMembersOpen]);

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
        for (const imageMessage of readStoredImages(roomId)) {
          dispatch({ type: "UPDATE_MESSAGE", payload: imageMessage });
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
        if (data.contentType === "image") {
          dispatch({ type: "ADD_MESSAGE", payload: data });

          void fetchImageDataUrl(data.image.url)
            .then((dataUrl) => {
              const cachedMessage: ImageChatMessage = {
                ...data,
                image: {
                  ...data.image,
                  dataUrl,
                },
              };
              writeStoredImage(roomId, cachedMessage);
              dispatch({ type: "UPDATE_MESSAGE", payload: cachedMessage });
            })
            .catch(() => {
              // The message can still render via the direct fetch fallback while the server TTL is active.
            });
          return;
        }

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
    sessionStorage.removeItem(getStoredImageKey(roomId));
    navigate("/", { replace: true });
  };

  return (
    <div
      className="fixed inset-x-0 top-0 w-full overflow-hidden bg-neutral-950"
      style={viewportStyle}
    >
      <div className="absolute inset-0 bg-cover bg-center bg-[#cfa913] bg-[linear-gradient(15deg,rgba(207,169,19,0.99)_6%,rgba(0,181,157,0.95)_100%)]" />
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 flex h-full min-h-0 flex-col overflow-hidden">
        <ChatTop
          roomId={roomId}
          userCount={participants.length}
          onViewMembers={() => setIsMembersOpen(true)}
          onLeave={handleLeave}
        />

        {error && (
          <div className="mx-3 mt-3 rounded-md border border-red-300/50 bg-red-950/80 px-3 py-2 text-sm text-red-100 sm:mx-4">
            {error}
          </div>
        )}

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 lg:px-8">
          {!joinConfirmed ? (
            <div className="flex h-full w-full items-center justify-center px-4 text-center">
              <div className="text-base text-white sm:text-lg">Joining room...</div>
            </div>
          ) : (
            <div className="w-full space-y-2 lg:px-2">
              {messages.map((m) =>
                m.type === "SYSTEM" ? (
                  <SystemMessage key={m.id} text={m.text} />
                ) : (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isSelf={m.participantId === session.participantId}
                  />
                )
              )}
            </div>
          )}
        </div>

        <ChatBottom
          socketRef={socketRef}
          isConnected={isConnected && joinConfirmed}
          roomId={roomId}
          participantId={session.participantId}
          reconnectToken={session.reconnectToken}
        />
      </div>

      <RoomMembersPanel
        isOpen={isMembersOpen}
        participants={participants}
        onClose={() => setIsMembersOpen(false)}
      />
    </div>
  );
}

function useLockedVisualViewport(): React.CSSProperties {
  const [viewport, setViewport] = useState(() => getVisualViewportSize());

  useEffect(() => {
    const updateViewport = (): void => {
      setViewport(getVisualViewportSize());
    };

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyWidth = document.body.style.width;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.width = previousBodyWidth;
    };
  }, []);

  return {
    height: `${viewport.height}px`,
    transform: `translateY(${viewport.offsetTop}px)`,
  };
}

function getVisualViewportSize(): { height: number; offsetTop: number } {
  const visualViewport = window.visualViewport;
  return {
    height: Math.round(visualViewport?.height ?? window.innerHeight),
    offsetTop: Math.round(visualViewport?.offsetTop ?? 0),
  };
}

export default ChatView;
