import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import { handleConnection } from './ws/connection.js';
import { roomManager } from './services/RoomManager.js';
import { messageStore } from './services/messageService.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const MAX_WS_PAYLOAD_BYTES = 16 * 1024;

const server = createServer(async (req, res) => {
    const origin = req.headers.origin;

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

    if (req.method === 'GET' && req.url === '/health') {
        const redis = await messageStore.healthCheck();
        sendJson(res, 200, {
            ok: true,
            history: messageStore.status,
            redis
        }, origin);
        return;
    }

    if (req.method === 'POST' && req.url === '/rooms') {
        sendJson(res, 201, {
            roomId: roomManager.createRoomId()
        }, origin);
        return;
    }

    sendJson(res, 404, { error: 'not found' }, origin);
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
    res.setHeader('access-control-allow-headers', 'content-type');
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
