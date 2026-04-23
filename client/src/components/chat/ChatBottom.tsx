import React, { useState, useRef, useEffect, useCallback } from "react";
import sendIcon from "../../assets/send.svg";
import { useChatSender } from "../../hooks/useChatSender";


interface ChatBottomProps {
  socketRef: React.RefObject<WebSocket | null>;
  isConnected: boolean;
}

function ChatBottom({
  socketRef,
  isConnected,
}: ChatBottomProps) {
  const [message, setMessage] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { canSend, sendMessage } = useChatSender({
    socketRef,
    isConnected,
  })

  // Auto-focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    const success = sendMessage(message);
    if (!success) return;

    setMessage("");
    inputRef.current?.focus();
  }, [message, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-neutral-700/60 bg-neutral-900/72 px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.7rem)] sm:px-4">
      <input
        ref={inputRef}
        type="text"
        value={message}
        placeholder="Type a message…"
        className="min-w-0 grow rounded-full bg-neutral-800/95 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <button
        onClick={handleSend}
        disabled={!message.trim() || !canSend}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-neutral-500"
      >
        <img src={sendIcon} alt="Send" className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}

export default ChatBottom;
