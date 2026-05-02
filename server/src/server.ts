import 'dotenv/config';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { handleConnection } from './ws/connection.js';
import { isAllowedOrigin, writeCorsHeaders } from './middleware/cors.js';
import { sendJson } from './utils/http.js';
import { handleHealth } from './handlers/http/health.js';
import { handleCreateRoom } from './handlers/http/rooms.js';
import { handleImageUpload, handleImageDownload } from './handlers/http/images.js';

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
            await handleHealth(req, res, origin);
            return;
        }

        if (req.method === 'POST' && url.pathname === '/rooms') {
            handleCreateRoom(req, res, origin);
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
