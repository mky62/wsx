import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { roomManager } from "../src/services/RoomManager.js";
import type { CustomWebSocket } from "../src/types/room.js";
import { handleJoin } from "../src/handlers/joinHandler.js";
import { handleMessage } from "../src/handlers/messageHandlers.js";
import { Room } from "../src/models/Room.js";

function createSocket(): CustomWebSocket {
    const sent: string[] = [];
    return {
        roomId: null,
        participantId: null,
        username: null,
        intentionalLeave: false,
        replaced: false,
        readyState: WebSocket.OPEN,
        send(data: string) {
            sent.push(data);
        },
        close() {
            this.readyState = WebSocket.CLOSED;
        },
        sent
    } as unknown as CustomWebSocket & { sent: string[] };
}

test.beforeEach(() => {
    for (const room of roomManager.rooms.values()) {
        room.clearAllReconnectTimers();
    }
    roomManager.rooms.clear();
    roomManager.clearPendingRoomReservations();
    roomManager.setRoomIdGeneratorForTesting();
});

test("join creates equal participant state without roles or admin", async () => {
    const socket = createSocket();
    const result = await roomManager.joinRoom("room-a", "Echo_01", socket);

    assert.equal(result.roomId, "room-a");
    assert.equal(result.username, "Echo_01");
    assert.equal(result.userCount, 1);
    assert.equal(result.reconnected, false);
    assert.equal("role" in result, false);
    assert.equal("admin" in result, false);
});

test("duplicate usernames are rejected without a reconnect token", async () => {
    await roomManager.joinRoom("room-a", "Echo_01", createSocket());

    await assert.rejects(
        () => roomManager.joinRoom("room-a", "Echo_01", createSocket()),
        /username already taken/
    );
});

test("valid reconnect token restores the same participant", async () => {
    const firstSocket = createSocket();
    const firstJoin = await roomManager.joinRoom("room-a", "Echo_01", firstSocket);

    roomManager.markDisconnected("room-a", firstSocket);

    const secondSocket = createSocket();
    const secondJoin = await roomManager.joinRoom(
        "room-a",
        "Echo_01",
        secondSocket,
        firstJoin.participantId,
        firstJoin.reconnectToken
    );

    assert.equal(secondJoin.reconnected, true);
    assert.equal(secondJoin.participantId, firstJoin.participantId);
    assert.equal(secondJoin.userCount, 1);
});

test("invalid reconnect token cannot claim a disconnected username", async () => {
    const firstSocket = createSocket();
    const firstJoin = await roomManager.joinRoom("room-a", "Echo_01", firstSocket);

    roomManager.markDisconnected("room-a", firstSocket);

    await assert.rejects(
        () => roomManager.joinRoom("room-a", "Echo_01", createSocket(), firstJoin.participantId, "bad-token"),
        /username already taken/
    );
});

test("messages are server-authored and use the create event type", async () => {
    const socket = createSocket();
    const join = await roomManager.joinRoom("room-a", "Echo_01", socket);
    const message = await roomManager.createMessage("room-a", socket, "hello");

    assert.equal(message.type, "MESSAGE_CREATED");
    assert.equal(message.participantId, join.participantId);
    assert.equal(message.username, "Echo_01");
    assert.equal(message.contentType, "text");
    assert.equal(message.text, "hello");
});

test("image messages are broadcast without text history shape", async () => {
    const socket = createSocket() as CustomWebSocket & { sent: string[] };
    const join = await roomManager.joinRoom("room-a", "Echo_01", socket);
    socket.sent.length = 0;

    const message = roomManager.createImageMessage("room-a", join.participantId, {
        id: "image-1",
        token: "image-token",
        url: "/rooms/room-a/images/image-1?token=image-token",
        mimeType: "image/png",
        sizeBytes: 123,
        width: 640,
        height: 480,
        expiresAt: Date.now() + 60_000
    });

    assert.equal(message.type, "MESSAGE_CREATED");
    assert.equal(message.contentType, "image");
    assert.equal(message.participantId, join.participantId);
    assert.equal(message.username, "Echo_01");
    assert.equal(message.image.id, "image-1");
    assert.equal(socket.sent.length, 1);
    assert.equal(JSON.parse(socket.sent[0]).contentType, "image");
});

test("room manager rejects invalid join inputs even when called directly", async () => {
    await assert.rejects(
        () => roomManager.joinRoom("bad room", "Echo_01", createSocket()),
        /invalid room id/
    );

    await assert.rejects(
        () => roomManager.joinRoom("room-a", "no", createSocket()),
        /invalid username/
    );
});

test("join handler sends JOINED before participant and system broadcasts", async () => {
    const socket = createSocket() as CustomWebSocket & { sent: string[] };

    await handleJoin(socket, {
        type: "JOIN_ROOM",
        roomId: "room-a",
        username: "Echo_01"
    });

    assert.equal(socket.sent.length, 3);
    assert.equal(JSON.parse(socket.sent[0]).type, "JOINED");
    assert.equal(JSON.parse(socket.sent[1]).type, "PARTICIPANTS_UPDATED");
    assert.equal(JSON.parse(socket.sent[2]).type, "SYSTEM_NOTICE");
});

test("invalid message payload sends an error and does not consume rate limit budget", async () => {
    const socket = createSocket() as CustomWebSocket & { sent: string[] };
    const join = await roomManager.joinRoom("room-a", "Echo_01", socket);
    roomManager.finalizeJoin(join.roomId, join.username, join.reconnected);
    socket.sent.length = 0;

    await handleMessage(socket, {
        type: "SEND_MESSAGE",
        text: "   "
    });

    const room = roomManager.rooms.get("room-a");
    const participant = room?.participants.get(join.participantId);

    assert.ok(participant);
    assert.equal(participant.messageTimestamps.length, 0);
    assert.equal(socket.sent.length, 1);
    assert.equal(JSON.parse(socket.sent[0]).code, "invalid_message");
});

test("rate limit state survives active session replacement", async () => {
    const firstSocket = createSocket();
    const firstJoin = await roomManager.joinRoom("room-a", "Echo_01", firstSocket);
    roomManager.finalizeJoin(firstJoin.roomId, firstJoin.username, firstJoin.reconnected);

    const room = roomManager.rooms.get("room-a");
    const participant = room?.participants.get(firstJoin.participantId);
    assert.ok(participant);

    const now = Date.now();
    participant.messageTimestamps = Array.from({ length: 20 }, (_, index) => now - index);

    const secondSocket = createSocket() as CustomWebSocket & { sent: string[] };
    const secondJoin = await roomManager.joinRoom(
        "room-a",
        "Echo_01",
        secondSocket,
        firstJoin.participantId,
        firstJoin.reconnectToken
    );
    roomManager.finalizeJoin(secondJoin.roomId, secondJoin.username, secondJoin.reconnected);
    secondSocket.sent.length = 0;

    await handleMessage(secondSocket, {
        type: "SEND_MESSAGE",
        text: "hello again"
    });

    assert.equal(secondSocket.sent.length, 1);
    assert.equal(JSON.parse(secondSocket.sent[0]).code, "rate_limited");
});

test("room id generation retries when the first candidate is already taken", () => {
    roomManager.rooms.set("taken-room", new Room("taken-room", Date.now()));

    const generatedIds = ["taken-room", "fresh-room"];
    roomManager.setRoomIdGeneratorForTesting(() => generatedIds.shift() ?? "fallback-id");

    assert.equal(roomManager.createRoomId(), "fresh-room");
});

test("room id generation fails fast when room capacity is already reached", () => {
    for (let index = 0; index < 1000; index += 1) {
        roomManager.rooms.set(`room-${index}`, new Room(`room-${index}`, Date.now()));
    }

    assert.throws(
        () => roomManager.createRoomId(),
        /server at capacity; try again later/
    );
});
