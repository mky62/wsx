# wsx Documentation

wsx is an anonymous, real-time chat application with no accounts, no ownership hierarchy, and equal participant permissions.

## Quick Start

```bash
# Install dependencies
npm install

# Run development (both client and server)
npm run dev

# Run client only
cd client && npm run dev

# Run server only
cd server && npm run dev

# Run Go backend
cd backend-go && go run .
```

## Documentation

- [Architecture](./ARCHITECTURE.md) - System design and component overview
- [Setup Guide](./SETUP.md) - Installation and configuration
- [API Reference](./API.md) - HTTP endpoints and WebSocket protocol
- [WebSocket Protocol](./WEBSOCKET_PROTOCOL.md) - Message schemas and flow
- [Deployment](./DEPLOYMENT.md) - Production deployment guide

## Key Features

- **Anonymous**: No accounts, no login, no tracking
- **Equal Participants**: No owners, admins, or special permissions
- **Temporary Rooms**: Rooms disappear when all participants leave
- **Encrypted History**: AES-256-GCM encrypted message history in Redis
- **Reconnect Tokens**: Session recovery on page reload or connection loss
- **Rate Limiting**: 20 messages per 10 seconds per participant
- **Origin Allowlist**: CORS and WebSocket origin validation

## Tech Stack

### Frontend
- React 19 + TypeScript
- Vite
- TailwindCSS v4
- React Router

### Backend (Node.js)
- Node.js + TypeScript
- WebSocket (ws library)
- Upstash Redis (REST API)
- AES-256-GCM encryption

### Backend (Go)
- Go 1.25+
- Custom WebSocket implementation (RFC 6455)
- Custom Upstash REST client
- Zero external dependencies

## Project Structure

```
wsx/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── state/
│   └── doc/         # Documentation (this directory)
├── server/          # Node.js backend
│   ├── src/
│   │   ├── handlers/
│   │   ├── services/
│   │   ├── types/
│   │   ├── ws/
│   │   └── models/
│   └── test/
└── backend-go/      # Go backend
    ├── main.go
    ├── server.go
    ├── websocket.go
    ├── room_manager.go
    ├── message_store.go
    └── upstash.go
```

## Security

- **Encryption at Rest**: Messages encrypted with AES-256-GCM before storage
- **Timing-Safe Token Comparison**: Prevents timing attacks on reconnect tokens
- **Origin Validation**: Both HTTP and WebSocket origins checked against allowlist
- **Rate Limiting**: Per-connection message rate limiting
- **Input Validation**: Room IDs and usernames validated with regex patterns
- **No Plaintext Fallback**: History disabled if encryption key is invalid or missing

## Environment Variables

### Server (Node.js)
```bash
PORT=8080
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
ENCRYPTION_KEY=64-character-hex-string
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
DEBUG=true
```

### Backend (Go)
```bash
PORT=8080
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
ENCRYPTION_KEY=64-character-hex-string
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
DEBUG=true
```

## Development

The project uses a monorepo structure with `concurrently` to run both client and server in development.

```bash
# Install all dependencies
npm install

# Start both client and server
npm run dev
```

Client runs on `http://localhost:5173`
Server runs on `http://localhost:8080` (HTTP + WebSocket)

## License

See project repository for license information.
