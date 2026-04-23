# backend-go

Go implementation of the existing chat backend.

## Features

- `POST /rooms` creates a room id
- `GET /health` reports HTTP health and Redis/history status
- WebSocket protocol compatible with the current frontend
- Anonymous equal participants, no roles
- Reconnect tokens for reload recovery
- Rate limiting and message length validation
- Optional encrypted reconnect history via Upstash Redis REST

## Run

```bash
go run .
```

Server defaults to `:8080`.

## Environment

- `PORT`
- `ALLOWED_ORIGINS`
- `DEBUG`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `ENCRYPTION_KEY` - 64 hex chars for AES-256-GCM

If Redis credentials or a valid `ENCRYPTION_KEY` are missing, history is disabled.
