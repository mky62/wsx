import React, { useState, useRef, useEffect, useCallback } from "react";
import { ImagePlus, X } from "lucide-react";
import sendIcon from "../../assets/send.svg";
import { useChatSender } from "../../hooks/useChatSender";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

interface ChatBottomProps {
  socketRef: React.RefObject<WebSocket | null>;
  isConnected: boolean;
  roomId: string;
  participantId?: string;
  reconnectToken?: string;
}

interface SelectedImage {
  file: File;
  dataUrl: string;
  width?: number;
  height?: number;
}

function ChatBottom({
  socketRef,
  isConnected,
  roomId,
  participantId,
  reconnectToken,
}: ChatBottomProps) {
  const [message, setMessage] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { canSend, sendMessage, uploadImage } = useChatSender({
    socketRef,
    isConnected,
    roomId,
    participantId,
    reconnectToken,
  })

  // Auto-focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const clearSelectedImage = useCallback(() => {
    setSelectedImage(null);
    setLocalError(null);
  }, []);

  const handleSend = useCallback(async () => {
    setLocalError(null);

    if (selectedImage) {
      setIsSending(true);
      const result = await uploadImage(selectedImage.file, {
        width: selectedImage.width,
        height: selectedImage.height,
      });
      setIsSending(false);

      if (!result.ok) {
        setLocalError(result.error || "Could not send image");
        return;
      }

      setSelectedImage(null);
      setMessage("");
      inputRef.current?.focus();
      return;
    }

    const success = sendMessage(message);
    if (!success) return;

    setMessage("");
    inputRef.current?.focus();
  }, [message, selectedImage, sendMessage, uploadImage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleImagePick = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setLocalError(null);

    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      setLocalError("Use a photo image file");
      return;
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      setLocalError("Image must be 20 MB or smaller");
      return;
    }

    try {
      setSelectedImage(await prepareImageForSend(file));
    } catch {
      setLocalError("Could not read that image");
    }
  }, []);

  return (
    <div className="shrink-0 border-t border-neutral-700/60 bg-neutral-900/72 px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.7rem)] sm:px-4">
      {selectedImage && (
        <div className="mb-2 flex max-w-sm items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-950/75 p-2 text-neutral-100">
          <img
            src={selectedImage.dataUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-md object-cover"
          />
          <div className="min-w-0 grow">
            <div className="truncate text-xs font-semibold">{selectedImage.file.name}</div>
            <div className="text-xs text-neutral-400">
              {(selectedImage.file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
          <button
            type="button"
            onClick={clearSelectedImage}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
            aria-label="Remove image"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {localError && (
        <div className="mb-2 text-xs font-medium text-red-200">{localError}</div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImagePick}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canSend || isSending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-neutral-100 transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-600 disabled:text-neutral-400"
          aria-label="Add image"
        >
          <ImagePlus size={19} />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={message}
          placeholder={selectedImage ? "Image ready to send" : "Type a message…"}
          className="min-w-0 grow rounded-full bg-neutral-800/95 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <button
          onClick={handleSend}
          disabled={(!message.trim() && !selectedImage) || !canSend || isSending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-neutral-500"
        >
          <img src={sendIcon} alt="Send" className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
}

async function prepareImageForSend(file: File): Promise<SelectedImage> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const imageSize = await loadImageSize(sourceUrl);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(imageSize.width, imageSize.height));
    const width = Math.max(1, Math.round(imageSize.width * scale));
    const height = Math.max(1, Math.round(imageSize.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("canvas unavailable");
    }

    const image = await loadImageElement(sourceUrl);
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error("prepared image too large");
    }

    return {
      file: new File([blob], normalizeImageFileName(file.name), { type: "image/jpeg" }),
      dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return loadImageElement(src).then((image) => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("image conversion failed"));
      }
    }, type, quality);
  });
}

function normalizeImageFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return `${base}.jpg`;
}

export default ChatBottom;
