# API Reference

## HTTP Endpoints

### POST /rooms

Create a new room ID.

**Request:**
```http
POST /rooms
Content-Type: application/json
Origin: <allowed-origin>
```

**Response (200 OK):**
```json
{
  "roomId": "abc123xyz9"
}
```

**Response (403 Forbidden):**
- Origin not in allowlist

**Response (500 Internal Server Error):**
- Server error

**Notes:**
- Room IDs are 10 characters using `[a-z0-9-]` alphabet
- Generated using cryptographically secure random
- No authentication required
- Room is not created until first participant joins

### GET /health

Health check endpoint for monitoring.

**Request:**
```http
GET /health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "redis": "connected",
  "history": "enabled"
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "degraded",
  "redis": "disconnected",
  "history": "disabled"
}
```

**Notes:**
- `redis`: `"connected"` if Upstash Redis is configured and responding
- `history`: `"enabled"` if encryption key is valid and Redis is connected
- Used for load balancer health checks

### OPTIONS /rooms

CORS preflight request.

**Request:**
```http
OPTIONS /rooms
Origin: <allowed-origin>
Access-Control-Request-Method: POST
```

**Response (204 No Content):**
```http
Access-Control-Allow-Origin: <allowed-origin>
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## WebSocket Connection

### Upgrade Request

Upgrade HTTP connection to WebSocket.

**Request:**
```http
GET / HTTP/1.1
Host: localhost:8080
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: <random-key>
Sec-WebSocket-Version: 13
Origin: <allowed-origin>
```

**Response (101 Switching Protocols):**
```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: <accept-key>
```

**Notes:**
- Origin must be in `ALLOWED_ORIGINS` env var
- WebSocket max payload: 16 KB
- Heartbeat: Server sends ping every 30s, expects pong within 10s (Node.js) or 40s (Go)

### Connection Close

**Normal Close (1000):**
- Client sends `LEAVE_ROOM` before closing
- Server acknowledges and closes cleanly

**Abnormal Close:**
- Connection lost without `LEAVE_ROOM`
- Server marks participant as disconnected with 30s grace period
- Participant can reconnect with token within grace period

## WebSocket Messages

All messages are JSON-encoded with a `type` field.

### Client → Server

#### JOIN_ROOM

Join or rejoin a room.

```json
{
  "type": "JOIN_ROOM",
  "roomId": "abc123xyz9",
  "username": "Echo_01",
  "participantId": "optional-existing-id",
  "reconnectToken": "optional-token"
}
```

**Fields:**
- `type` (required): `"JOIN_ROOM"`
- `roomId` (required): Room ID to join
- `username` (required): Display name (5-25 chars, `[a-zA-Z0-9_]`)
- `participantId` (optional): Previous participant ID for reconnection
- `reconnectToken` (optional): Reconnect token for session recovery

**Validation:**
- Room ID: `/^[a-zA-Z0-9_-]{5,35}$/`
- Username: `/^[a-zA-Z0-9_]{5,25}$/`
- Reconnect token: Valid SHA-256 hash match if provided

**Server Response (JOINED):**
```json
{
  "type": "JOINED",
  "roomId": "abc123xyz9",
  "username": "Echo_01",
  "participantId": "xyz789abc123",
  "reconnectToken": "random-16-char-token",
  "userCount": 3,
  "participants": [
    {
      "participantId": "xyz789abc123",
      "username": "Echo_01",
      "connected": true
    }
  ],
  "history": [
    {
      "id": "msg-uuid",
      "type": "MESSAGE_CREATED",
      "participantId": "xyz789abc123",
      "username": "Echo_01",
      "text": "Hello",
      "timestamp": 1713987600000
    }
  ],
  "reconnected": false
}
```

**Error Response:**
```json
{
  "type": "ERROR",
  "code": "invalid_join",
  "message": "roomId and username are required"
}
```

**Error Codes:**
- `invalid_join`: Missing required fields
- `invalid_room_id`: Room ID format invalid
- `invalid_username`: Username format invalid
- `username_taken`: Username already taken in room
- `room_full`: Room at capacity (50 participants)
- `server_at_capacity`: Server at room limit (1000 rooms)

#### SEND_MESSAGE

Send a chat message to the room.

```json
{
  "type": "SEND_MESSAGE",
  "text": "Hello world"
}
```

**Fields:**
- `type` (required): `"SEND_MESSAGE"`
- `text` (required): Message content (max 1000 chars)

**Validation:**
- User must have joined a room
- Not rate-limited (20 messages / 10 seconds)
- Message not empty
- Message length ≤ 1000 characters

**Server Broadcast (MESSAGE_CREATED):**
```json
{
  "type": "MESSAGE_CREATED",
  "id": "msg-uuid",
  "participantId": "xyz789abc123",
  "username": "Echo_01",
  "text": "Hello world",
  "timestamp": 1713987600000
}
```

**Error Response:**
```json
{
  "type": "ERROR",
  "code": "not_joined",
  "message": "join a room before sending messages"
}
```

**Error Codes:**
- `not_joined`: User hasn't joined a room
- `rate_limited`: Too many messages (20 / 10s)
- `message_too_long`: Message exceeds 1000 characters
- `handler_failed`: Server error processing message

#### LEAVE_ROOM

Leave the current room.

```json
{
  "type": "LEAVE_ROOM"
}
```

**Fields:**
- `type` (required): `"LEAVE_ROOM"`

**Behavior:**
- Server marks participant as intentionally left
- Server removes participant from room
- Server closes WebSocket with code 1000
- No response sent (connection closes)

### Server → Client

#### JOINED

Sent after successful room join.

```json
{
  "type": "JOINED",
  "roomId": "abc123xyz9",
  "username": "Echo_01",
  "participantId": "xyz789abc123",
  "reconnectToken": "random-16-char-token",
  "userCount": 3,
  "participants": [
    {
      "participantId": "xyz789abc123",
      "username": "Echo_01",
      "connected": true
    }
  ],
  "history": [],
  "reconnected": false
}
```

**Fields:**
- `type`: `"JOINED"`
- `roomId`: Room ID
- `username`: Your username
- `participantId`: Your unique participant ID
- `reconnectToken`: Token for session recovery (store in sessionStorage)
- `userCount`: Total participants in room
- `participants`: Array of all participants
  - `participantId`: Unique ID
  - `username`: Display name
  - `connected`: Currently connected (true) or in grace period (false)
- `history`: Array of recent messages (max 50, oldest first)
- `reconnected`: `true` if this was a reconnection with existing token

#### MESSAGE_CREATED

Broadcast when a message is sent.

```json
{
  "type": "MESSAGE_CREATED",
  "id": "msg-uuid",
  "participantId": "xyz789abc123",
  "username": "Echo_01",
  "text": "Hello world",
  "timestamp": 1713987600000
}
```

**Fields:**
- `type`: `"MESSAGE_CREATED"`
- `id`: Unique message ID (UUID v4)
- `participantId`: Sender's participant ID
- `username`: Sender's username
- `text`: Message content
- `timestamp`: Unix timestamp (milliseconds)

#### PARTICIPANTS_UPDATED

Broadcast when participant list changes (join, leave, disconnect, reconnect).

```json
{
  "type": "PARTICIPANTS_UPDATED",
  "userCount": 4,
  "participants": [
    {
      "participantId": "xyz789abc123",
      "username": "Echo_01",
      "connected": true
    }
  ]
}
```

**Fields:**
- `type`: `"PARTICIPANTS_UPDATED"`
- `userCount`: Total participants
- `participants`: Updated participant array

#### SYSTEM_NOTICE

Broadcast for system events (user joined, left, reconnected).

```json
{
  "type": "SYSTEM_NOTICE",
  "message": "Echo_01 joined the room"
}
```

**Fields:**
- `type`: `"SYSTEM_NOTICE"`
- `message`: Human-readable notice text

#### ERROR

Sent when a request fails.

```json
{
  "type": "ERROR",
  "code": "error_code",
  "message": "Human-readable error message"
}
```

**Fields:**
- `type`: `"ERROR"`
- `code`: Machine-readable error code
- `message`: Human-readable description

## Rate Limiting

**Per-connection limit**: 20 messages per 10 seconds

**Implementation**: Sliding window with message timestamps

**Behavior**: Exceeded limit returns `ERROR` with `rate_limited` code

## CORS Configuration

**Allowed Origins**: Set via `ALLOWED_ORIGINS` env var (comma-separated)

**Example:**
```bash
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
```

**Headers:**
- `Access-Control-Allow-Origin`: Request origin if in allowlist
- `Access-Control-Allow-Methods`: `GET, POST, OPTIONS`
- `Access-Control-Allow-Headers`: `Content-Type`

## Error Handling

### HTTP Errors

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Bad request (invalid JSON, validation error) |
| 403 | Origin not allowed |
| 404 | Endpoint not found |
| 500 | Internal server error |
| 503 | Service unavailable (Redis disconnected) |

### WebSocket Errors

**Close Codes:**
- 1000: Normal close
- 1001: Going away
- 1008: Policy violation (origin not allowed)
- 1011: Internal error

**Error Messages:**
- `invalid_json`: Message not valid JSON
- `unknown_message_type`: Invalid `type` field
- `handler_failed`: Error processing message

## Environment Variables

### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 8080 | HTTP/WebSocket port |
| `ALLOWED_ORIGINS` | Yes | - | Comma-separated allowed origins |
| `DEBUG` | No | false | Enable debug logging |
| `ENCRYPTION_KEY` | No | - | 64-char hex for AES-256-GCM (required for history) |
| `UPSTASH_REDIS_REST_URL` | No | - | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | No | - | Upstash Redis REST token |

**Notes:**
- `ALLOWED_ORIGINS` is required for CORS and WebSocket validation
- History is disabled if `ENCRYPTION_KEY` is missing or invalid
- History is disabled if Redis credentials are missing
