# WebSocket Protocol

## Overview

xMy uses a JSON-based WebSocket protocol for real-time communication. The protocol is identical between the Node.js and Go backend implementations.

## Connection

### Handshake

Upgrade HTTP connection to WebSocket:

```http
GET / HTTP/1.1
Host: localhost:8080
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: <random-key>
Sec-WebSocket-Version: 13
Origin: <allowed-origin>
```

**Origin Validation:**
- Must match an origin in `ALLOWED_ORIGINS` env var
- Comma-separated list: `http://localhost:5173,https://yourdomain.com`

**Response (101 Switching Protocols):**
```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: <accept-key>
```

### Heartbeat

**Node.js:**
- Server sends `PING` frame every 30 seconds
- Client must respond with `PONG` frame
- 10-second timeout before connection termination

**Go:**
- Server sends `PING` frame every 30 seconds
- Read deadline set to 40 seconds, reset on each `PONG`
- Read deadline expiration triggers connection close

### Close Codes

| Code | Description |
|------|-------------|
| 1000 | Normal close (client sent LEAVE_ROOM) |
| 1001 | Going away (server shutdown) |
| 1008 | Policy violation (origin not allowed) |
| 1011 | Internal error |

## Message Format

All messages are JSON-encoded:

```json
{
  "type": "MESSAGE_TYPE",
  "field": "value"
}
```

**Common Fields:**
- `type` (required): Message type identifier
- Additional fields depend on message type

## Client → Server Messages

### JOIN_ROOM

Join or rejoin a chat room.

**Request:**
```json
{
  "type": "JOIN_ROOM",
  "roomId": "abc123xyz9",
  "username": "Echo_01",
  "participantId": "xyz789abc123",
  "reconnectToken": "random-16-char-token"
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"JOIN_ROOM"` |
| `roomId` | string | Yes | Room ID to join (5-35 chars, `[a-zA-Z0-9_-]`) |
| `username` | string | Yes | Display name (5-25 chars, `[a-zA-Z0-9_]`) |
| `participantId` | string | No | Previous participant ID for reconnection |
| `reconnectToken` | string | No | Reconnect token for session recovery |

**Validation Rules:**
- Room ID regex: `/^[a-zA-Z0-9_-]{5,35}$/`
- Username regex: `/^[a-zA-Z0-9_]{5,25}$/`
- Reconnect: Token SHA-256 hash must match stored hash
- Grace period: Reconnect only valid within 30 seconds of disconnect

**Response (JOINED):**
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
  "code": "error_code",
  "message": "Human-readable error"
}
```

**Error Codes:**
| Code | Description |
|------|-------------|
| `invalid_join` | Missing required fields |
| `invalid_room_id` | Room ID format invalid |
| `invalid_username` | Username format invalid |
| `username_taken` | Username already in room (not reconnecting) |
| `room_full` | Room at capacity (50 participants) |
| `server_at_capacity` | Server at room limit (1000 rooms) |

### SEND_MESSAGE

Send a chat message to the room.

**Request:**
```json
{
  "type": "SEND_MESSAGE",
  "text": "Hello world"
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"SEND_MESSAGE"` |
| `text` | string | Yes | Message content (max 1000 chars) |

**Validation Rules:**
- User must have joined a room first
- Not rate-limited (20 messages / 10 seconds)
- Message not empty after trimming
- Message length ≤ 1000 characters

**Server Broadcast (MESSAGE_CREATED):**
```json
{
  "type": "MESSAGE_CREATED",
  "id": "msg-uuid-v4",
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
  "code": "error_code",
  "message": "Human-readable error"
}
```

**Error Codes:**
| Code | Description |
|------|-------------|
| `not_joined` | User hasn't joined a room |
| `rate_limited` | Too many messages (20 / 10s) |
| `message_too_long` | Message exceeds 1000 characters |
| `handler_failed` | Server error processing message |

### LEAVE_ROOM

Leave the current room gracefully.

**Request:**
```json
{
  "type": "LEAVE_ROOM"
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"LEAVE_ROOM"` |

**Behavior:**
- Server marks participant as intentionally left
- Server removes participant from room
- Server closes WebSocket with code 1000
- No response sent (connection closes immediately)

## Server → Client Messages

### JOINED

Sent after successful room join or reconnection.

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
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"JOINED"` |
| `roomId` | string | Room ID |
| `username` | string | Your username |
| `participantId` | string | Your unique participant ID |
| `reconnectToken` | string | Token for session recovery (store in sessionStorage) |
| `userCount` | number | Total participants in room |
| `participants` | array | All participants in room |
| `participants[].participantId` | string | Participant's unique ID |
| `participants[].username` | string | Participant's username |
| `participants[].connected` | boolean | Currently connected (true) or in grace period (false) |
| `history` | array | Recent messages (max 50, oldest first) |
| `reconnected` | boolean | `true` if this was a reconnection |

**Client Handling:**
- Store `participantId` and `reconnectToken` in sessionStorage
- Display participant list
- Display historical messages (if any)
- If `reconnected: true`, indicate session was restored

### MESSAGE_CREATED

Broadcast when any participant sends a message.

```json
{
  "type": "MESSAGE_CREATED",
  "id": "msg-uuid-v4",
  "participantId": "xyz789abc123",
  "username": "Echo_01",
  "text": "Hello world",
  "timestamp": 1713987600000
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"MESSAGE_CREATED"` |
| `id` | string | Unique message ID (UUID v4) |
| `participantId` | string | Sender's participant ID |
| `username` | string | Sender's username |
| `text` | string | Message content |
| `timestamp` | number | Unix timestamp (milliseconds) |

**Client Handling:**
- Deduplicate by `id` (in case of race with SET_HISTORY)
- Display in chat UI
- Highlight if `participantId` matches your ID

### PARTICIPANTS_UPDATED

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
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"PARTICIPANTS_UPDATED"` |
| `userCount` | number | Total participants |
| `participants` | array | Updated participant list |
| `participants[].participantId` | string | Participant's unique ID |
| `participants[].username` | string | Participant's username |
| `participants[].connected` | boolean | Connected status |

**Client Handling:**
- Update participant list UI
- Update user count display
- Show visual indicator for connected/disconnected

### SYSTEM_NOTICE

Broadcast for system events.

```json
{
  "type": "SYSTEM_NOTICE",
  "message": "Echo_01 joined the room"
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"SYSTEM_NOTICE"` |
| `message` | string | Human-readable notice text |

**Notice Types:**
- `"{username} joined the room"` - New participant joined
- `"{username} left the room"` - Participant left
- `"{username} reconnected"` - Participant reconnected after disconnect

**Client Handling:**
- Display as system message (italic, gray, centered)
- Add to message history

### ERROR

Sent when a client request fails.

```json
{
  "type": "ERROR",
  "code": "error_code",
  "message": "Human-readable error message"
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"ERROR"` |
| `code` | string | Machine-readable error code |
| `message` | string | Human-readable description |

**Error Codes:**
| Code | Description |
|------|-------------|
| `invalid_json` | Message not valid JSON |
| `unknown_message_type` | Invalid `type` field |
| `invalid_join` | Missing required fields in JOIN_ROOM |
| `invalid_room_id` | Room ID format invalid |
| `invalid_username` | Username format invalid |
| `username_taken` | Username already in room |
| `room_full` | Room at capacity |
| `server_at_capacity` | Server at room limit |
| `not_joined` | Not joined a room |
| `rate_limited` | Too many messages |
| `message_too_long` | Message too long |
| `handler_failed` | Server error |

**Client Handling:**
- Display error to user
- For rate limiting, show countdown
- For validation errors, guide user to fix input

## Message Flow Diagrams

### Join Flow

```
Client                    Server
  |                         |
  |--- JOIN_ROOM ---------->|
  |                         |
  |<----- JOINED -----------|
  |                         |
  |<-- PARTICIPANTS_UPDATED-|
  |<---- SYSTEM_NOTICE -----|
  |                         |
```

### Message Flow

```
Client                    Server
  |                         |
  |--- SEND_MESSAGE ------->|
  |                         |
  |<---- MESSAGE_CREATED ---| (broadcast to all)
  |                         |
```

### Leave Flow

```
Client                    Server
  |                         |
  |--- LEAVE_ROOM -------->|
  |                         |
  |<-- CLOSE (1000) --------|
  |                         |
  |<-- PARTICIPANTS_UPDATED| (broadcast to others)
  |<---- SYSTEM_NOTICE -----| (broadcast to others)
  |                         |
```

### Reconnect Flow

```
Client                    Server
  |                         |
  |--- JOIN_ROOM ---------->| (with participantId + reconnectToken)
  |                         |
  |<----- JOINED -----------| (reconnected: true)
  |                         |
  |<-- PARTICIPANTS_UPDATED-|
  |<---- SYSTEM_NOTICE -----| (username reconnected)
  |                         |
```

## Rate Limiting

**Limit:** 20 messages per 10 seconds per connection

**Implementation:** Sliding window with message timestamps

**Behavior:**
- Client sends SEND_MESSAGE
- Server checks timestamps in last 10 seconds
- If ≥ 20 messages, return ERROR with `rate_limited` code
- Timestamps reset after 10-second window

## Reconnect Token Security

**Token Generation:**
- 16 characters using `[a-zA-Z0-9_-]` alphabet
- Cryptographically secure random
- Unique per participant per session

**Server Storage:**
- SHA-256 hash stored (not raw token)
- Hash compared using timing-safe comparison
- Prevents timing attacks

**Client Storage:**
- Store in `sessionStorage` (cleared on tab close)
- Send with JOIN_ROOM for reconnection

**Grace Period:**
- 30 seconds after disconnect
- Token only valid within grace period
- After grace period, username freed for new joins

## Message Deduplication

**Client-Side:**
- Maintain Set of message IDs
- On MESSAGE_CREATED: check if ID exists
- If exists, ignore (duplicate)
- On SET_HISTORY: filter out existing IDs

**Race Condition Handling:**
- SET_HISTORY and MESSAGE_CREATED can arrive in any order
- Both paths check for duplicate IDs
- Ensures no duplicate messages in UI

## State Management

### Client Session Storage

```javascript
sessionStorage.setItem('participantId', participantId);
sessionStorage.setItem('reconnectToken', reconnectToken);
sessionStorage.setItem('username', username);
```

**Keys:**
- `participantId`: Your unique participant ID
- `reconnectToken`: Token for reconnection
- `username`: Your display name

**Lifecycle:**
- Set on successful JOINED
- Cleared on page close (sessionStorage)
- Used for reconnection on page reload

## Testing

### Example Join Sequence

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'JOIN_ROOM',
    roomId: 'abc123xyz9',
    username: 'Echo_01'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'JOINED':
      console.log('Joined as', message.participantId);
      sessionStorage.setItem('participantId', message.participantId);
      sessionStorage.setItem('reconnectToken', message.reconnectToken);
      break;
    case 'MESSAGE_CREATED':
      console.log('Message from', message.username, ':', message.text);
      break;
    case 'ERROR':
      console.error('Error:', message.message);
      break;
  }
};
```

### Example Reconnect Sequence

```javascript
const participantId = sessionStorage.getItem('participantId');
const reconnectToken = sessionStorage.getItem('reconnectToken');
const username = sessionStorage.getItem('username');

const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'JOIN_ROOM',
    roomId: 'abc123xyz9',
    username: username,
    participantId: participantId,
    reconnectToken: reconnectToken
  }));
};
```

## Compatibility

Both Node.js and Go backends implement this protocol identically. The frontend works with either backend without modification.
