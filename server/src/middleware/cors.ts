import { ServerResponse, IncomingMessage } from 'http';

export function isAllowedOrigin(origin?: string): boolean {
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

export function writeCorsHeaders(res: ServerResponse<IncomingMessage>, origin?: string): void {
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
