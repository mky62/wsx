import React, { useCallback } from "react";

interface UseChatSenderParams {
    socketRef: React.RefObject<WebSocket | null>;
    isConnected: boolean;
}

export function useChatSender({
    socketRef,
    isConnected,
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

    return {
        canSend,
        sendMessage,
    };
}
