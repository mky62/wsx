import React, { useCallback } from "react";
import { getApiBaseUrl } from "../utils/api";

interface UseChatSenderParams {
    socketRef: React.RefObject<WebSocket | null>;
    isConnected: boolean;
    roomId: string;
    participantId?: string;
    reconnectToken?: string;
}

interface ImageDimensions {
    width?: number;
    height?: number;
}

interface UploadImageResult {
    ok: boolean;
    imageId?: string;
    expiresAt?: number;
    error?: string;
}

export function useChatSender({
    socketRef,
    isConnected,
    roomId,
    participantId,
    reconnectToken,
}: UseChatSenderParams) {
    const canSend = isConnected;

    const sendMessage = useCallback(
        (rawText: string): boolean => {
            const text = rawText.trim();
            if (!text) return false;

            const socket = socketRef.current;
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                console.warn("websocket not ready");
                return false;
            }

            socket.send(
                JSON.stringify({
                    type: "SEND_MESSAGE",
                    text,
                })
            );
            return true;
        },
        [socketRef]
    );

    const uploadImage = useCallback(
        async (file: File, dimensions: ImageDimensions = {}): Promise<UploadImageResult> => {
            if (!participantId || !reconnectToken) {
                return { ok: false, error: "Session is not ready yet" };
            }

            const headers: Record<string, string> = {
                "content-type": file.type,
                "x-participant-id": participantId,
                "x-reconnect-token": reconnectToken,
            };

            if (dimensions.width) headers["x-image-width"] = String(dimensions.width);
            if (dimensions.height) headers["x-image-height"] = String(dimensions.height);

            const response = await fetch(`${getApiBaseUrl()}/rooms/${encodeURIComponent(roomId)}/images`, {
                method: "POST",
                headers,
                body: file,
            });

            if (response.ok) {
                const payload = await response.json() as { imageId?: string; expiresAt?: number };
                return {
                    ok: true,
                    imageId: payload.imageId,
                    expiresAt: payload.expiresAt,
                };
            }

            let error = "Could not send image";
            try {
                const payload = await response.json() as { error?: string };
                if (payload.error) error = payload.error;
            } catch {
                // Keep the generic error when the server response is not JSON.
            }

            return { ok: false, error };
        },
        [participantId, reconnectToken, roomId]
    );

    return {
        canSend,
        sendMessage,
        uploadImage,
    };
}
