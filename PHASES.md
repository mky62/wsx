# wsx Chat - Development Notes

## Current Product Contract

wsx is an anonymous realtime chat system with:

- no accounts
- no fixed room TTL
- no ownership hierarchy
- no mute or message-delete controls
- equal participant permissions
- WebSocket realtime messaging
- token-based reconnects for reloads and short connection breaks
- encrypted Redis storage for the last 50 active-room messages

Redis history is temporary reconnect history. It is deleted when a room becomes empty after reconnect grace. If `ENCRYPTION_KEY` is missing or invalid, history is disabled instead of falling back to plaintext.

## Current Hardening Priorities

1. Keep client/server protocol types narrow and server-authoritative.
2. Keep reconnect authority tied to participant ID plus reconnect token, not username alone.
3. Keep active room state in memory for v1.
4. Keep Redis limited to encrypted recent messages only.
5. Keep room cleanup tied to connected participants and reconnect grace.
6. Keep rate limits, max payload size, origin allowlists, and validation in the server path.

## Deferred Work

- Multi-server room coordination.
- Durable room recovery after server restart.
- End-to-end encryption.
- Account-based identity.
- Room moderation.
- Message deletion.
