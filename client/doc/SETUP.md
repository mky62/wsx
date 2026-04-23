# Setup Guide

## Prerequisites

### Required Software

- **Node.js**: v18 or higher
- **npm**: v9 or higher (comes with Node.js)
- **Go**: v1.25 or higher (only for Go backend)

### Optional Software

- **Git**: For cloning the repository

## Installation

### Clone Repository

```bash
git clone <repository-url>
cd wsx
```

### Install Dependencies

```bash
npm install
```

This installs dependencies for:
- Root package (concurrently for dev script)
- Client (React, Vite, TailwindCSS)
- Server (Node.js, ws, Upstash Redis)

## Configuration

### Environment Variables

Create a `.env` file in the `server/` directory for the Node.js backend:

```bash
cd server
touch .env
```

Add the following variables:

```bash
# Server Configuration
PORT=8080
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# Encryption (Required for message history)
ENCRYPTION_KEY=64-character-hex-string-here

# Upstash Redis (Required for message history)
UPSTASH_REDIS_REST_URL=https://your-upstash-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# Debug Logging
DEBUG=true
```

#### Generate Encryption Key

Generate a cryptographically secure 64-character hex string:

**Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Go:**
```bash
go run -c 'package main; import ("crypto/rand"; "encoding/hex"; "fmt"); func main() { b := make([]byte, 32); rand.Read(b); fmt.Println(hex.EncodeToString(b)) }'
```

**Online Tool:** Use a secure random hex generator

#### Upstash Redis Setup

1. Go to [Upstash Console](https://console.upstash.com)
2. Create a new Redis database
3. Copy the REST URL and token
4. Add to `.env` file

### Go Backend Environment

For the Go backend, create a `.env` file in the `backend-go/` directory or export variables:

```bash
cd backend-go
export PORT=8080
export ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
export ENCRYPTION_KEY=64-character-hex-string-here
export UPSTASH_REDIS_REST_URL=https://your-upstash-url.upstash.io
export UPSTASH_REDIS_REST_TOKEN=your-upstash-token
export DEBUG=true
```

Or create a `.env` file and use a library like `godotenv` (not included by default).

## Running the Application

### Development Mode (Both Client and Server)

Run both the React client and Node.js server concurrently:

```bash
npm run dev
```

This starts:
- **Client**: http://localhost:5173 (Vite dev server)
- **Server**: http://localhost:8080 (HTTP + WebSocket)

### Client Only

```bash
cd client
npm run dev
```

Runs on http://localhost:5173

### Node.js Server Only

```bash
cd server
npm run dev
```

Runs on http://localhost:8080

### Go Backend Only

```bash
cd backend-go
go run .
```

Runs on http://localhost:8080

### Production Build

**Client:**
```bash
cd client
npm run build
```

Output in `client/dist/`

**Node.js Server:**
```bash
cd server
npm run build
npm start
```

Output in `server/dist/`

**Go Backend:**
```bash
cd backend-go
go build -o wsx-server .
./wsx-server
```

## Development Workflow

### Recommended Workflow

1. Start the server in one terminal:
```bash
cd server
npm run dev
```

2. Start the client in another terminal:
```bash
cd client
npm run dev
```

3. Open http://localhost:5173

### Hot Reload

- **Client**: Vite provides hot module replacement
- **Server**: `tsx watch` automatically restarts on file changes
- **Go**: Rebuild manually or use a tool like `air`

## Testing

### Node.js Server Tests

```bash
cd server
npm test
```

Tests cover:
- Room joining
- Username validation
- Reconnect token validation
- Message creation

### Go Backend Tests

```bash
cd backend-go
go test ./...
```

Tests cover:
- Room joining
- Duplicate username rejection
- Reconnect validation
- Message authoring

## Troubleshooting

### Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::8080`

**Solution:** Change the port in `.env`:
```bash
PORT=8081
```

### Redis Connection Failed

**Error:** `⚠️ Redis credentials not configured. Temporary reconnect history will not work.`

**Solution:**
1. Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env`
2. Check Upstash database status
3. Test connection:
```bash
curl https://your-upstash-url/ping -H "Authorization: Bearer your-token"
```

### Invalid Encryption Key

**Error:** History disabled despite Redis being configured

**Solution:**
- Ensure `ENCRYPTION_KEY` is exactly 64 hexadecimal characters
- Regenerate key if needed
- No spaces or special characters

### CORS Errors

**Error:** `Access-Control-Allow-Origin` header missing or blocked

**Solution:**
- Add your frontend URL to `ALLOWED_ORIGINS`
- Format: `http://localhost:5173,https://yourdomain.com`
- No trailing slashes

### WebSocket Connection Failed

**Error:** WebSocket connection fails

**Solution:**
- Verify server is running
- Check `ALLOWED_ORIGINS` includes your frontend URL
- Check browser console for specific error
- Ensure no firewall blocking WebSocket

### Build Errors

**Error:** TypeScript compilation errors

**Solution:**
```bash
cd server
npm run build
```

Check TypeScript errors and fix type issues.

### Go Build Errors

**Error:** Go compilation errors

**Solution:**
```bash
cd backend-go
go build .
```

Check Go version compatibility (requires 1.25+)

## IDE Setup

### VS Code

Recommended extensions:
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Go (for Go backend)

### VS Code Settings

Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "tailwindCSS.experimental.classRegex": [
    ["className=\"([^`]*)\"", "\"([^\"]*)\""]
  ]
}
```

## File Structure

```
wsx/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── state/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── server/              # Node.js backend
│   ├── src/
│   │   ├── handlers/
│   │   ├── services/
│   │   ├── types/
│   │   ├── ws/
│   │   └── models/
│   ├── test/
│   ├── .env             # Environment variables
│   ├── package.json
│   └── tsconfig.json
├── backend-go/          # Go backend
│   ├── main.go
│   ├── server.go
│   ├── websocket.go
│   ├── room_manager.go
│   ├── message_store.go
│   └── upstash.go
├── package.json         # Root package
└── README.md
```

## Performance Tuning

### Client

- Enable production build for deployment
- Use code splitting for large apps
- Optimize images

### Server (Node.js)

- Increase WebSocket max payload if needed (default 16KB)
- Adjust rate limits for high-traffic scenarios
- Use clustering for multi-core servers

### Server (Go)

- Adjust heartbeat intervals for different network conditions
- Tune goroutine limits for high concurrency
- Use connection pooling for Redis

## Security Checklist

- [ ] Set strong `ENCRYPTION_KEY` (64 hex chars)
- [ ] Configure `ALLOWED_ORIGINS` to restrict access
- [ ] Use HTTPS in production
- [ ] Keep dependencies updated
- [ ] Enable rate limiting (default: 20 msg / 10s)
- [ ] Monitor Redis for unauthorized access
- [ ] Use environment-specific configs (dev/staging/prod)
- [ ] Never commit `.env` files
- [ ] Rotate encryption keys periodically
- [ ] Enable debug logging only in development

## Next Steps

After setup:

1. Read [Architecture](./ARCHITECTURE.md) for system design
2. Review [API Reference](./API.md) for endpoints
3. Study [WebSocket Protocol](./WEBSOCKET_PROTOCOL.md) for messaging
4. See [Deployment Guide](./DEPLOYMENT.md) for production
