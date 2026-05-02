import { ServerResponse, IncomingMessage } from 'http';
import { messageStore } from '../../services/messageService.js';
import { sendJson } from '../../utils/http.js';

export async function handleHealth(
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
    origin?: string
): Promise<void> {
    const redis = await messageStore.healthCheck();
    sendJson(res, 200, {
        ok: true,
        history: messageStore.status,
        redis
    }, origin);
}
