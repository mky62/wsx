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
    <div className="shrink-0 flex h-16 items-center gap-2 px-4 py-3 bg-neutral-900/60 border-neutral-700">
      <input
        ref={inputRef}
        type="text"
        value={message}
        placeholder="Type a message…"
        className="grow bg-neutral-800 text-neutral-100 placeholder-neutral-400
                   rounded-full px-4 py-2 text-base sm:text-sm
                   focus:outline-none focus:ring-2 focus:ring-amber-400"
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <button
        onClick={handleSend}
        disabled={!message.trim() || !canSend}
        className="flex items-center justify-center
                   h-11 w-11 rounded-full
                   bg-amber-400 hover:bg-amber-500
                   disabled:bg-neutral-500 disabled:cursor-not-allowed
                   transition"
      >
        <img src={sendIcon} alt="Send" className="w-5 h-5" />
      </button>
    </div>
  );
}

export default ChatBottom;
