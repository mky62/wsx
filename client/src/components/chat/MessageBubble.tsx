import React from "react";

interface Message {
  username: string;
  text: string;
  timestamp: number;
}

interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
}

const MessageBubble = React.memo(function MessageBubble({
  message,
  isSelf,
}: MessageBubbleProps) {
  const messageDate = new Date(message.timestamp);

  return (
    <div className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[85%] sm:max-w-xs rounded-lg px-4 py-2 ${
          isSelf ? "bg-blue-500 text-white" : "bg-white text-black"
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-4 text-xs font-semibold opacity-75">
          <span className="truncate">{message.username}</span>
          <time dateTime={messageDate.toISOString()} className="shrink-0 tabular-nums">
            {messageDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>

        <p>{message.text}</p>
      </div>
    </div>
  );
});

export default MessageBubble;
