import { nanoid } from "nanoid";

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TTL_MS = 2 * 60 * 1000;

export interface EphemeralImageRecord {
    id: string;
    token: string;
    roomId: string;
    buffer: Buffer;
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    expiresAt: number;
}

interface CreateImageParams {
    roomId: string;
    buffer: Buffer;
    mimeType: string;
    width?: number;
    height?: number;
}

class EphemeralImageStore {
    private images = new Map<string, EphemeralImageRecord>();

    public create({ roomId, buffer, mimeType, width, height }: CreateImageParams): EphemeralImageRecord {
        const id = nanoid(24);
        const token = nanoid(32);
        const expiresAt = Date.now() + IMAGE_TTL_MS;
        const key = this.key(roomId, id);

        const record: EphemeralImageRecord = {
            id,
            token,
            roomId,
            buffer,
            mimeType,
            sizeBytes: buffer.byteLength,
            width,
            height,
            expiresAt
        };

        this.images.set(key, record);
        setTimeout(() => {
            this.images.delete(key);
        }, IMAGE_TTL_MS).unref();

        return record;
    }

    public get(roomId: string, imageId: string, token: string): EphemeralImageRecord | null {
        const record = this.images.get(this.key(roomId, imageId));
        if (!record || record.token !== token || record.expiresAt <= Date.now()) {
            return null;
        }

        return record;
    }

    private key(roomId: string, imageId: string): string {
        return `${roomId}:${imageId}`;
    }
}

export const ephemeralImageStore = new EphemeralImageStore();
