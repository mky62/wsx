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
    <div className={`flex w-full ${isSelf ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[92%] rounded-lg px-3 py-2 sm:max-w-[75%] sm:min-w-0 sm:px-4 ${
          isSelf ? "min-w-[68%] sm:min-w-0" : "min-w-[62%] sm:min-w-0"
        } ${
          isSelf ? "bg-blue-500 text-white" : "bg-white text-black"
        }`}
      >
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-semibold opacity-75">
          <span className="min-w-0 flex-1 truncate">{message.username}</span>
          <time dateTime={messageDate.toISOString()} className="shrink-0 tabular-nums">
            {messageDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>

        <p className="break-words text-sm leading-5 sm:text-[15px]">{message.text}</p>
      </div>
    </div>
  );
});

export default MessageBubble;
