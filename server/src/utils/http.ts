import { ServerResponse, IncomingMessage } from 'http';
import { writeCorsHeaders } from '../middleware/cors.js';

export function sendJson(
    res: ServerResponse<IncomingMessage>,
    statusCode: number,
    payload: unknown,
    origin?: string
): void {
    writeCorsHeaders(res, origin);
    res.writeHead(statusCode, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
}

export async function readRequestBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
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

export function getHeader(req: IncomingMessage, name: string): string | null {
    const value = req.headers[name];
    return typeof value === 'string' ? value : null;
}

export function parsePositiveIntHeader(req: IncomingMessage, name: string): number | undefined {
    const value = getHeader(req, name);
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
