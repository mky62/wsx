import { getRedisClient, isRedisConfigured } from './redisClient.js';
import { TextChatMessage } from '../types/room.js';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''; // Must be 32 bytes (64 hex characters)
// Fail closed: invalid or missing keys disable history instead of storing plaintext.
const encryptionKeyBuffer = /^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY)
    ? Buffer.from(ENCRYPTION_KEY, 'hex')
    : null;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;


const MESSAGE_LIMIT = 50; // Maximum messages to store per room

export type HistoryStatus = "enabled" | "disabled";

export class MessageStore {
    /**
     * Get Redis key for room messages
     */
    private getRoomKey(roomId: string): string {
        return `room:${roomId}:messages`;
    }

    public get status(): HistoryStatus {
        return encryptionKeyBuffer && isRedisConfigured() ? "enabled" : "disabled";
    }

    public get isEnabled(): boolean {
        return Boolean(encryptionKeyBuffer && isRedisConfigured());
    }

    private encrypt(text: string): string | null {
        if (!encryptionKeyBuffer) return null;
        try {
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKeyBuffer, iv, {
                authTagLength: AUTH_TAG_LENGTH
            });
            const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
            const authTag = cipher.getAuthTag();
            return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
        } catch (error) {
            // Log encryption errors for debugging
            if (process.env.DEBUG) {
                console.error("[Encryption Error]", error);
            }
            return null;
        }
    }

    private decrypt(text: string): string | null {
        if (!encryptionKeyBuffer) return null;
        try {
            const textParts = text.split(':');
            if (textParts.length !== 3) return null; // Not encrypted format

            const iv = Buffer.from(textParts[0], 'hex');
            const authTag = Buffer.from(textParts[1], 'hex');
            const encryptedText = Buffer.from(textParts[2], 'hex');
            const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKeyBuffer, iv, {
                authTagLength: AUTH_TAG_LENGTH
            });
            decipher.setAuthTag(authTag);
            const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
            return decrypted.toString();
        } catch (error) {
            if (process.env.DEBUG) {
                console.error("[Decryption Error]", error);
            }
            return null;
        }
    }

    /**
     * Save a message to Redis
     * @param roomId - The room ID
     * @param message - The message payload
     */
    async saveMessage(
        roomId: string,
        message: TextChatMessage
    ): Promise<void> {
        if (!this.isEnabled) {
            return;
        }

        try {
            const redis = getRedisClient();
            if (!redis) return;
            const key = this.getRoomKey(roomId);
            const messageStr = JSON.stringify(message);
            const encryptedMessage = this.encrypt(messageStr);
            if (!encryptedMessage) return;

            // Add message to the beginning of the list
            await redis.lpush(key, encryptedMessage);

            // Trim list to keep only the most recent messages
            await redis.ltrim(key, 0, MESSAGE_LIMIT - 1);
        } catch (error) {
            // Log critical errors for monitoring
            if (process.env.DEBUG) {
                console.error("[MessageService] Failed to save message", { error });
            }
        }
    }

    /**
     * Get messages for a room
     * @param roomId - The room ID
     * @param limit - Maximum number of messages to retrieve
     * @returns Array of messages (newest first)
     */
    async getMessages(
        roomId: string,
        limit: number = MESSAGE_LIMIT
    ): Promise<TextChatMessage[]> {
        if (!this.isEnabled) {
            return [];
        }

        try {
            const redis = getRedisClient();
            if (!redis) return [];
            const key = this.getRoomKey(roomId);

            // Get messages from Redis (0 to limit-1, newest first)
            const messages = await redis.lrange(key, 0, limit - 1) as string[];

            if (!messages || messages.length === 0) {
                return [];
            }

            // Parse and reverse to get chronological order (oldest first)
            return messages
                .map((msg: string) => {
                    try {
                        const decryptedMsg = this.decrypt(msg);
                        return decryptedMsg ? JSON.parse(decryptedMsg) : null;
                    } catch (e) {
                        if (process.env.DEBUG) {
                            console.error("[MessageService] Failed to parse message", { error: e });
                        }
                        return null;
                    }
                })
                .filter((msg): msg is TextChatMessage => isChatMessage(msg))
                .reverse();
        } catch (error) {
            if (process.env.DEBUG) {
                console.error("[MessageService] Failed to retrieve messages", { error });
            }
            return [];
        }
    }

    /**
     * Delete all messages for a room
     * @param roomId - The room ID
     */
    async deleteRoomMessages(roomId: string): Promise<void> {
        if (!isRedisConfigured()) {
            return;
        }

        try {
            const redis = getRedisClient();
            if (!redis) return;
            const key = this.getRoomKey(roomId);
            await redis.del(key);
        } catch (error) {
            if (process.env.DEBUG) {
                console.error("[MessageService] Failed to delete room messages", { error });
            }
        }
    }

    /**
     * Check if Redis is connected
     */
    async healthCheck(): Promise<boolean> {
        if (!this.isEnabled) {
            return false;
        }

        try {
            const redis = getRedisClient();
            if (!redis) return false;
            const result = await redis.ping();
            return result === 'PONG';
        } catch (error) {
            if (process.env.DEBUG) {
                console.error("[MessageService] Redis health check failed", { error });
            }
            return false;
        }
    }
}

function isChatMessage(value: unknown): value is TextChatMessage {
    if (!value || typeof value !== "object") return false;
    const msg = value as Partial<TextChatMessage>;
    return msg.type === "MESSAGE_CREATED"
        && typeof msg.id === "string"
        && typeof msg.participantId === "string"
        && typeof msg.username === "string"
        && typeof msg.text === "string"
        && typeof msg.timestamp === "number";
}

export const messageStore = new MessageStore();
