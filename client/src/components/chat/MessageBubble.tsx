import React, { useEffect, useState } from "react";
import type { ChatMessage, ImageChatMessage } from "../../state/chatReducer";
import { getApiBaseUrl } from "../../utils/api";

interface MessageBubbleProps {
  message: ChatMessage;
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

        {message.contentType === "image" ? (
          <EphemeralImage image={message.image} />
        ) : (
          <p className="break-words text-sm leading-5 sm:text-[15px]">{message.text}</p>
        )}
      </div>
    </div>
  );
});

function EphemeralImage({ image }: { image: ImageChatMessage["image"] }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    if (image.dataUrl) {
      setObjectUrl(null);
      setFailed(false);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    async function loadImage() {
      setFailed(false);
      setObjectUrl(null);

      try {
        const response = await fetch(`${getApiBaseUrl()}${image.url}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("image unavailable");
        }

        const blob = await response.blob();
        createdUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(createdUrl);
          return;
        }

        setObjectUrl(createdUrl);
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    }

    void loadImage();

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [image.dataUrl, image.url]);

  if (failed) {
    return <div className="text-sm opacity-80">Image expired</div>;
  }

  const imageSrc = image.dataUrl || objectUrl;

  if (!imageSrc) {
    return <div className="h-36 w-56 animate-pulse rounded-md bg-black/15" />;
  }

  return (
    <img
      src={imageSrc}
      alt="Shared"
      width={image.width}
      height={image.height}
      className="max-h-72 max-w-full rounded-md object-contain"
    />
  );
}

export default MessageBubble;
