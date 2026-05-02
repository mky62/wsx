import { ServerResponse, IncomingMessage } from 'http';
import {
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_IMAGE_BYTES,
    ephemeralImageStore
} from '../../services/ephemeralImageStore.js';
import { roomManager } from '../../services/RoomManager.js';
import { sendJson, readRequestBody, getHeader, parsePositiveIntHeader } from '../../utils/http.js';
import { writeCorsHeaders } from '../../middleware/cors.js';

export async function handleImageUpload(
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
    origin: string | undefined,
    roomId: string
): Promise<void> {
    const participantId = getHeader(req, 'x-participant-id');
    const reconnectToken = getHeader(req, 'x-reconnect-token');
    if (!participantId || !reconnectToken) {
        sendJson(res, 401, { error: 'missing participant credentials' }, origin);
        return;
    }

    const participant = roomManager.getActiveParticipantForRequest(roomId, participantId, reconnectToken);
    if (!participant) {
        sendJson(res, 403, { error: 'invalid participant credentials' }, origin);
        return;
    }

    const mimeType = (getHeader(req, 'content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
        sendJson(res, 415, { error: 'unsupported image type' }, origin);
        return;
    }

    if (roomManager.isRateLimited(roomId, participant.participantId)) {
        sendJson(res, 429, { error: 'too many messages; slow down' }, origin);
        return;
    }

    let body: Buffer;
    try {
        body = await readRequestBody(req, MAX_IMAGE_BYTES);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'invalid upload';
        sendJson(res, message === 'payload too large' ? 413 : 400, { error: message }, origin);
        return;
    }

    if (body.byteLength === 0) {
        sendJson(res, 400, { error: 'image cannot be empty' }, origin);
        return;
    }

    const width = parsePositiveIntHeader(req, 'x-image-width');
    const height = parsePositiveIntHeader(req, 'x-image-height');
    const image = ephemeralImageStore.create({
        roomId,
        buffer: body,
        mimeType,
        width,
        height
    });

    roomManager.createImageMessage(roomId, participant.participantId, {
        id: image.id,
        token: image.token,
        url: `/rooms/${encodeURIComponent(roomId)}/images/${encodeURIComponent(image.id)}?token=${encodeURIComponent(image.token)}`,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        width: image.width,
        height: image.height,
        expiresAt: image.expiresAt
    });

    sendJson(res, 201, {
        imageId: image.id,
        expiresAt: image.expiresAt
    }, origin);
}

export function handleImageDownload(
    res: ServerResponse<IncomingMessage>,
    origin: string | undefined,
    roomId: string,
    imageId: string,
    token: string
): void {
    const image = ephemeralImageStore.get(roomId, imageId, token);
    if (!image) {
        sendJson(res, 404, { error: 'image expired or not found' }, origin);
        return;
    }

    writeCorsHeaders(res, origin);
    res.writeHead(200, {
        'content-type': image.mimeType,
        'content-length': image.buffer.byteLength,
        'cache-control': 'no-store, max-age=0'
    });
    res.end(image.buffer);
}
