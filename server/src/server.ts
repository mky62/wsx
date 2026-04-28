import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import { handleConnection } from './ws/connection.js';
import { roomManager } from './services/RoomManager.js';
import { messageStore } from './services/messageService.js';
import {
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_IMAGE_BYTES,
    ephemeralImageStore
} from './services/ephemeralImageStore.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const MAX_WS_PAYLOAD_BYTES = 16 * 1024;

const server = createServer(async (req, res) => {
    const origin = req.headers.origin;

    try {
        if (req.method === 'OPTIONS') {
            writeCorsHeaders(res, origin);
            res.writeHead(204);
            res.end();
            return;
        }

        if (origin && !isAllowedOrigin(origin)) {
            sendJson(res, 403, { error: 'origin not allowed' }, origin);
            return;
        }

        const url = new URL(req.url || '/', 'http://localhost');

        if (req.method === 'GET' && url.pathname === '/health') {
            const redis = await messageStore.healthCheck();
            sendJson(res, 200, {
                ok: true,
                history: messageStore.status,
                redis
            }, origin);
            return;
        }

        if (req.method === 'POST' && url.pathname === '/rooms') {
            sendJson(res, 201, {
                roomId: roomManager.createRoomId()
            }, origin);
            return;
        }

        const uploadMatch = url.pathname.match(/^\/rooms\/([^/]+)\/images$/);
        if (req.method === 'POST' && uploadMatch) {
            await handleImageUpload(req, res, origin, decodeURIComponent(uploadMatch[1]));
            return;
        }

        const imageMatch = url.pathname.match(/^\/rooms\/([^/]+)\/images\/([^/]+)$/);
        if (req.method === 'GET' && imageMatch) {
            handleImageDownload(
                res,
                origin,
                decodeURIComponent(imageMatch[1]),
                decodeURIComponent(imageMatch[2]),
                url.searchParams.get('token') || ''
            );
            return;
        }

        sendJson(res, 404, { error: 'not found' }, origin);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'internal server error';
        const statusCode = message === 'server at capacity; try again later'
            || message === 'failed to allocate room id; try again'
            ? 503
            : 500;

        sendJson(res, statusCode, { error: message }, origin);
    }
});

const wss = new WebSocketServer({
    server,
    maxPayload: MAX_WS_PAYLOAD_BYTES,
    verifyClient: ({ origin }, done) => {
        done(isAllowedOrigin(origin), 403, 'origin not allowed');
    }
});

wss.on('connection', handleConnection);

server.listen(PORT, () => {
    if (process.env.DEBUG) {
        console.log(`HTTP/WebSocket server running on port ${PORT}`);
    }
});

function sendJson(
    res: ServerResponse<IncomingMessage>,
    statusCode: number,
    payload: unknown,
    origin?: string
): void {
    writeCorsHeaders(res, origin);
    res.writeHead(statusCode, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
}

function writeCorsHeaders(res: ServerResponse<IncomingMessage>, origin?: string): void {
    if (origin && isAllowedOrigin(origin)) {
        res.setHeader('access-control-allow-origin', origin);
        res.setHeader('vary', 'Origin');
    }
    res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
    res.setHeader(
        'access-control-allow-headers',
        'content-type,x-participant-id,x-reconnect-token,x-image-width,x-image-height'
    );
}

async function handleImageUpload(
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

function handleImageDownload(
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

async function readRequestBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let total = 0;

    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.byteLength;
        if (total > maxBytes) {
            throw new Error('payload too large');
        }
        chunks.push(buffer);
    }

    return Buffer.concat(chunks);
}

function getHeader(req: IncomingMessage, name: string): string | null {
    const value = req.headers[name];
    return typeof value === 'string' ? value : null;
}

function parsePositiveIntHeader(req: IncomingMessage, name: string): number | undefined {
    const value = getHeader(req, name);
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function isAllowedOrigin(origin?: string): boolean {
    if (!origin) return true;

    const configured = process.env.ALLOWED_ORIGINS
        ?.split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    const allowedOrigins = configured && configured.length > 0
        ? configured
        : [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:4173',
            'http://127.0.0.1:4173'
        ];

    return allowedOrigins.includes(origin);
}
