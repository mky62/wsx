import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { roomManager } from "../src/services/RoomManager.js";
import type { CustomWebSocket } from "../src/types/room.js";

function createSocket(): CustomWebSocket {
    const sent: string[] = [];
    return {
        roomId: null,
        participantId: null,
        username: null,
        intentionalLeave: false,
        replaced: false,
        messageTimestamps: [],
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
    assert.equal(message.text, "hello");
});
