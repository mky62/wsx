# Architecture

## Overview

xMy is a real-time anonymous chat application with two backend implementations (Node.js and Go) sharing the same WebSocket protocol, and a React 19 SPA frontend.

## System Design

### Core Principles

1. **No Accounts**: Users are identified by randomly generated aliases
2. **Equal Participants**: No owners, admins, or special permissions
3. **Temporary Rooms**: Rooms exist only while participants are active
4. **Encrypted History**: Messages encrypted at rest in Redis
5. **Session Recovery**: Reconnect tokens enable session restoration

## Components

### Frontend (React)

```
client/src/
├── pages/
│   ├── Home.tsx          # Landing page (identity generation, room creation/join)
│   └── ChatView.tsx      # Chat interface
├── components/chat/
│   ├── ChatTop.tsx       # Room header (room ID, user count, members panel)
│   ├── ChatBottom.tsx    # Message input and send button
│   ├── MessageBubble.tsx # Individual message display
│   ├── RoomMembersPanel.tsx # Participants list
│   └── SystemMessage.tsx # System notice display
├── hooks/
│   ├── useChatSocket.tsx # WebSocket connection management
│   ├── useChatSender.tsx # Message sending
│   └── useScrollToggle.ts # Scroll lock toggle
├── state/
│   └── chatReducer.ts    # Chat message state management
└── tempStorage/
    └── globalSession.tsx # Temporary session state (username)
```

**Key Patterns:**
- `useReducer` for complex state (Home page, chat messages)
- Custom hooks for WebSocket logic
- Session storage for reconnect tokens
- In-memory session for username between pages

### Backend (Node.js)

```
server/src/
├── server.ts             # HTTP + WebSocket server entry point
├── handlers/
│   ├── joinHandler.ts    # JOIN_ROOM message handling
│   ├── messageHandlers.ts # SEND_MESSAGE handling
│   └── leaveHandler.ts   # LEAVE_ROOM handling
├── services/
│   ├── RoomManager.ts    # Room/participant state management (singleton)
│   ├── messageService.ts # Message encryption/decryption + Redis operations
│   └── redisClient.ts    # Upstash Redis client
├── ws/
│   ├── connection.ts     # WebSocket connection handling + heartbeat
│   └── messageRouter.ts  # Message type routing
├── types/
│   └── room.ts           # TypeScript interfaces (CustomWebSocket, payloads)
└── models/
    └── Room.ts           # Room class (participants, broadcast)
```

**Key Patterns:**
- Singleton `RoomManager` for in-memory room state
- Fail-closed encryption (history disabled if key invalid)
- Timing-safe token comparison
- Heartbeat (30s ping, 10s pong timeout) for zombie detection

### Backend (Go)

```
backend-go/
├── main.go               # Entry point
├── server.go             # HTTP + WebSocket server
├── websocket.go          # Custom WebSocket implementation (RFC 6455)
├── room.go               # Room struct
├── room_manager.go       # Room/participant management
├── message_store.go      # Encryption/decryption + Redis operations
├── upstash.go            # Custom Upstash REST client
├── types.go              # Struct definitions (payloads, models)
├── id.go                 # ID generation (cryptographically secure)
└── util.go               # Utilities
```

**Key Patterns:**
- Zero external dependencies (pure stdlib)
- Custom WebSocket implementation with full RFC 6455 support
- `sync.RWMutex` for concurrent access
- Heartbeat with read deadline (30s ping, 40s timeout)
- Protocol-compatible with Node.js backend

## Data Flow

### Room Creation Flow

1. Client sends HTTP POST `/rooms` to server
2. Server generates room ID (10 chars, nanoid)
3. Server returns room ID
4. Client navigates to `/rooms/{roomId}`

### Join Room Flow

1. Client establishes WebSocket connection
2. Client sends `JOIN_ROOM` message with:
   - `roomId`
   - `username`
   - `participantId` (if reconnecting)
   - `reconnectToken` (if reconnecting)
3. Server validates room ID and username
4. Server checks for existing participant (reconnect or active)
5. Server adds participant to room
6. Server sends `JOINED` response with:
   - `roomId`, `username`, `participantId`
   - `reconnectToken`, `userCount`
   - `participants` array
   - `history` (encrypted messages)
7. Client stores `participantId` and `reconnectToken` in sessionStorage

### Message Flow

1. Client sends `SEND_MESSAGE` message with `text`
2. Server validates:
   - User has joined a room
   - Not rate-limited (20 msg / 10s)
   - Message not empty
   - Message length ≤ 1000 chars
3. Server creates message object with:
   - `id` (UUID v4)
   - `participantId`, `username`
   - `text`, `timestamp`
4. Server encrypts message with AES-256-GCM
5. Server stores in Redis (`LPUSH`, `LTRIM` to 50)
6. Server broadcasts `MESSAGE_CREATED` to all participants in room
7. Client displays message

### Reconnect Flow

1. Client detects WebSocket close
2. Client attempts reconnect with exponential backoff
3. Client sends `JOIN_ROOM` with stored `participantId` and `reconnectToken`
4. Server validates reconnect token (SHA-256 hash comparison)
5. Server checks if within 30s grace period
6. Server restores participant state
7. Server sends `JOINED` with `reconnected: true`
8. Client receives historical messages

### Grace Period Flow

1. Participant disconnects (close without LEAVE_ROOM)
2. Server marks participant as `disconnected` with timer (30s)
3. Username blocked for new joins during grace period
4. On timer expiry, participant removed from room
5. If room becomes empty, room is deleted

## Security Architecture

### Encryption

- **Algorithm**: AES-256-GCM
- **Key**: 32 bytes (64 hex chars) from `ENCRYPTION_KEY` env var
- **IV**: 12 random bytes per message
- **Auth Tag**: 16 bytes
- **Storage**: `iv:authTag:encrypted` (hex-encoded)
- **Fail-Closed**: History disabled if key missing/invalid

### Token Security

- **Reconnect Tokens**: Random 16-char string
- **Storage**: SHA-256 hash stored server-side
- **Comparison**: Timing-safe (`crypto.timingSafeEqual` / `subtle.ConstantTimeCompare`)
- **Lifecycle**: Single-use per session, expires after 30s grace

### Rate Limiting

- **Per-connection**: 20 messages per 10 seconds
- **Implementation**: Sliding window with timestamps array
- **Enforcement**: Server-side only

### Origin Validation

- **HTTP**: CORS headers + origin check
- **WebSocket**: `verifyClient` callback checks `Origin` header
- **Configuration**: `ALLOWED_ORIGINS` env var (comma-separated)

### Input Validation

- **Room ID**: `/^[a-zA-Z0-9_-]{5,35}$/`
- **Username**: `/^[a-zA-Z0-9_]{5,25}$/`
- **Message**: Max 1000 characters
- **WebSocket Payload**: Max 16 KB

## Capacity Limits

- **Max Rooms**: 1000 concurrent rooms
- **Max Participants per Room**: 50 (reconnects bypass)
- **Message History**: 50 messages per room
- **Rate Limit**: 20 messages / 10 seconds per participant

## State Management

### Server-Side (In-Memory)

- **RoomManager**: Singleton `Map<roomId, Room>`
- **Room**: Participants map + disconnected users map
- **ParticipantRecord**: Socket, username, reconnect token hash
- **DisconnectedUserInfo**: Timer, participant data

### Client-Side

- **Chat Messages**: `useReducer` with `chatReducer`
- **Participants**: `useState` in ChatView
- **Session**: `sessionStorage` for `participantId`, `reconnectToken`
- **Username**: In-memory `globalSession` (between Home → ChatView)

## Redis Schema

### Key Format

```
room:{roomId}:messages
```

### Data Type

- **Type**: List
- **Operations**: `LPUSH` (add), `LTRIM` (limit to 50), `LRANGE` (retrieve), `DEL` (clear)
- **Values**: Encrypted message strings

### Encryption

Each message is encrypted individually:
```
iv:authTag:encrypted
```

## Heartbeat Mechanism

### Node.js

- **Ping Interval**: 30 seconds
- **Pong Timeout**: 10 seconds
- **Implementation**: `ws.ping()` + `ws.on('pong')` handler
- **Zombie Detection**: Timeout terminates connection

### Go

- **Ping Interval**: 30 seconds
- **Read Deadline**: 40 seconds
- **Implementation**: `SetReadDeadline` reset on each pong
- **Zombie Detection**: Read deadline expires triggers close

## Error Handling

### Client-Side

- WebSocket errors trigger reconnect with exponential backoff
- HTTP errors display in error banner
- Validation errors show inline

### Server-Side

- Invalid JSON → `ERROR` response with `invalid_json` code
- Unknown message type → `ERROR` response with `unknown_message_type` code
- Handler failures → `ERROR` response with `handler_failed` code
- Redis errors → Logged, history operation fails gracefully
- Encryption errors → Logged, history disabled

## Deployment Architecture

### Frontend (Vercel)

- Static React build
- SPA fallback (404.html)
- Environment variables at build time

### Backend (Railway)

- Node.js or Go binary
- HTTP + WebSocket on same port
- Environment variables at runtime
- Upstash Redis integration

## Backward Compatibility

- Both backends implement identical WebSocket protocol
- Frontend works with either backend
- Go backend designed as drop-in replacement for Node.js
