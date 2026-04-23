package main

import (
	"testing"
)

func newTestManager() *RoomManager {
	store := NewMessageStore(nil, "", false)
	return NewRoomManager(store)
}

func newTestSocket() *WSConn {
	return &WSConn{}
}

func TestJoinCreatesEqualParticipantState(t *testing.T) {
	manager := newTestManager()
	result, err := manager.JoinRoom("room-a", "Echo_01", newTestSocket(), "", "")
	if err != nil {
		t.Fatalf("join failed: %v", err)
	}

	if result.RoomID != "room-a" {
		t.Fatalf("unexpected room id: %s", result.RoomID)
	}
	if result.Username != "Echo_01" {
		t.Fatalf("unexpected username: %s", result.Username)
	}
	if result.UserCount != 1 {
		t.Fatalf("unexpected user count: %d", result.UserCount)
	}
	if result.Reconnected {
		t.Fatal("expected fresh join, got reconnect")
	}
}

func TestDuplicateUsernamesRejectedWithoutReconnectToken(t *testing.T) {
	manager := newTestManager()
	if _, err := manager.JoinRoom("room-a", "Echo_01", newTestSocket(), "", ""); err != nil {
		t.Fatalf("initial join failed: %v", err)
	}

	if _, err := manager.JoinRoom("room-a", "Echo_01", newTestSocket(), "", ""); err == nil {
		t.Fatal("expected duplicate username error")
	}
}

func TestValidReconnectRestoresParticipant(t *testing.T) {
	manager := newTestManager()
	firstSocket := newTestSocket()
	firstJoin, err := manager.JoinRoom("room-a", "Echo_01", firstSocket, "", "")
	if err != nil {
		t.Fatalf("initial join failed: %v", err)
	}

	manager.MarkDisconnected("room-a", firstSocket)

	secondJoin, err := manager.JoinRoom("room-a", "Echo_01", newTestSocket(), firstJoin.ParticipantID, firstJoin.ReconnectToken)
	if err != nil {
		t.Fatalf("reconnect join failed: %v", err)
	}

	if !secondJoin.Reconnected {
		t.Fatal("expected reconnect to be marked")
	}
	if secondJoin.ParticipantID != firstJoin.ParticipantID {
		t.Fatal("expected same participant id after reconnect")
	}
}

func TestInvalidReconnectCannotClaimUsername(t *testing.T) {
	manager := newTestManager()
	firstSocket := newTestSocket()
	firstJoin, err := manager.JoinRoom("room-a", "Echo_01", firstSocket, "", "")
	if err != nil {
		t.Fatalf("initial join failed: %v", err)
	}

	manager.MarkDisconnected("room-a", firstSocket)

	if _, err := manager.JoinRoom("room-a", "Echo_01", newTestSocket(), firstJoin.ParticipantID, "bad-token"); err == nil {
		t.Fatal("expected invalid reconnect token to fail")
	}
}

func TestMessagesAreServerAuthored(t *testing.T) {
	manager := newTestManager()
	socket := newTestSocket()
	join, err := manager.JoinRoom("room-a", "Echo_01", socket, "", "")
	if err != nil {
		t.Fatalf("join failed: %v", err)
	}

	message, err := manager.CreateMessage("room-a", socket, "hello")
	if err != nil {
		t.Fatalf("create message failed: %v", err)
	}
	if message.Type != "MESSAGE_CREATED" {
		t.Fatalf("unexpected message type: %s", message.Type)
	}
	if message.ParticipantID != join.ParticipantID {
		t.Fatal("message should use join participant id")
	}
	if message.Username != "Echo_01" || message.Text != "hello" {
		t.Fatal("message payload mismatch")
	}
}
