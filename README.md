# wsx - Anonymous Realtime Chat

wsx is a **real-time anonymous chat application** with equal participants and temporary encrypted reconnect history.

## System Architecture

- **Anonymous by design** — no accounts, no registration
- **No fixed room TTL** — rooms stay active while participants are connected or reconnectable
- **Temporary encrypted history** — Redis stores the last 50 messages while a room is active
- **Equal participants** — no owner, admin, mute, or message-delete hierarchy
- **Token-based reconnects** — browser reloads and short connection breaks restore the same participant

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + TailwindCSS
- **Backend:** Node.js + HTTP health/room endpoints + WebSocket (ws)
- **History:** Upstash Redis with AES-256-GCM encrypted values
- **Deployment:** Vercel static frontend + Railway HTTP/WebSocket server

## Quick Start

```bash
# Install dependencies
npm install
cd client && npm ci
cd ../server && npm ci
cd ..

# Run both client and server
npm run dev

# Or run individually
npm run client  # http://localhost:5173
npm run server  # http://localhost:8080 and ws://localhost:8080
```

The client defaults to `http://localhost:8080` for room creation and `ws://localhost:8080` for realtime chat. For production, set:

- `VITE_API_URL` to the Railway HTTP URL
- `VITE_WS_URL` to the Railway WebSocket URL
- `ALLOWED_ORIGINS` on the server to the Vercel frontend origin

## Development Phases

See [PHASES.md](./PHASES.md) for detailed development roadmap and security hardening plan.

## Deployment

Deploy the frontend on Vercel:
- Root Directory: `/`
- Framework Preset: `Other`
- Build Command: `cd client && npm install && npm run build`
- Output Directory: `client/dist`

Deploy the WebSocket server on Railway using `railway.json`.

## Security & Privacy

- No accounts or user registration
- Room-based isolation
- Server-assigned participant identity and message metadata
- Reconnect tokens are stored in browser `sessionStorage` and hashed server-side
- Redis history is active-room reconnect history, not a durable archive
- Set `ENCRYPTION_KEY` to a 64-character hex key to enable encrypted Redis history
- The server never falls back to plaintext history. If `ENCRYPTION_KEY` is missing or invalid, history is disabled and messages are not persisted.
- When a room becomes empty after reconnect grace, the server deletes the room and `room:${roomId}:messages`

## License

MIT
