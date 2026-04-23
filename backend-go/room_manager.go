package main

import (
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	reconnectGracePeriod   = 30 * time.Second
	messageLimit           = 1000
	rateLimitWindowMS      = int64(10_000)
	rateLimitMaxMessages   = 20
	maxWSPayloadBytes      = 16 * 1024
	maxParticipantsPerRoom = 50
	maxRooms               = 1000
)

var (
	usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_]{5,25}$`)
	roomPattern     = regexp.MustCompile(`^[a-zA-Z0-9_-]{5,35}$`)
)

type RoomManager struct {
	mu           sync.RWMutex
	rooms        map[string]*Room
	messageStore *MessageStore
}

type JoinResult struct {
	RoomID         string
	ParticipantID  string
	ReconnectToken string
	Username       string
	UserCount      int
	Participants   []ParticipantView
	History        []ChatMessage
	Reconnected    bool
	HistoryEnabled bool
}

func NewRoomManager(messageStore *MessageStore) *RoomManager {
	return &RoomManager{
		rooms:        make(map[string]*Room),
		messageStore: messageStore,
	}
}

func (m *RoomManager) CreateRoomID() string {
	return newRoomID()
}

func (m *RoomManager) getOrCreateRoom(roomID string) (*Room, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, ok := m.rooms[roomID]
	if ok {
		return room, nil
	}

	if len(m.rooms) >= maxRooms {
		return nil, fmt.Errorf("server at capacity; try again later")
	}

	room = NewRoom(roomID, time.Now().UnixMilli())
	m.rooms[roomID] = room
	m.messageStore.DeleteRoomMessages(roomID)
	return room, nil
}

func (m *RoomManager) JoinRoom(roomID, username string, socket *WSConn, participantID, reconnectToken string) (*JoinResult, error) {
	if !roomPattern.MatchString(roomID) {
		return nil, fmt.Errorf("invalid room id")
	}
	if !usernamePattern.MatchString(username) {
		return nil, fmt.Errorf("invalid username")
	}

	room, err := m.getOrCreateRoom(roomID)
	if err != nil {
		return nil, err
	}

	var participant *ParticipantRecord
	token := reconnectToken
	reconnected := false
	var previousSocket *WSConn

	room.mu.Lock()
	reconnect := m.getReconnectParticipantLocked(room, username, participantID, reconnectToken)
	active := m.getActiveParticipantLocked(room, username, participantID, reconnectToken)

	if reconnect == nil && active == nil && room.hasUsername(username) {
		room.mu.Unlock()
		return nil, fmt.Errorf("username already taken")
	}

	if room.userCount() >= maxParticipantsPerRoom && reconnect == nil && active == nil {
		room.mu.Unlock()
		return nil, fmt.Errorf("room is full")
	}

	if reconnect != nil {
		if reconnect.Timer != nil {
			reconnect.Timer.Stop()
		}
		delete(room.disconnectedUsers, reconnect.Participant.ParticipantID)
		participant = reconnect.Participant
		reconnected = true
	} else if active != nil {
		previousSocket = active.Socket
		participant = active
		reconnected = true
	} else {
		token = newReconnectToken()
		participant = &ParticipantRecord{
			ParticipantID:      newParticipantID(),
			Username:           username,
			ReconnectTokenHash: hashReconnectToken(token),
		}
	}

	room.addParticipant(participant, socket)
	result := &JoinResult{
		RoomID:         roomID,
		ParticipantID:  participant.ParticipantID,
		ReconnectToken: token,
		Username:       participant.Username,
		UserCount:      room.userCount(),
		Participants:   room.getParticipantView(),
		Reconnected:    reconnected,
		HistoryEnabled: m.messageStore.IsEnabled(),
	}
	room.mu.Unlock()

	if previousSocket != nil {
		previousSocket.MarkReplaced()
		_ = previousSocket.Close()
	}

	result.History = m.messageStore.GetMessages(roomID, historyMessageLimit)

	m.broadcastParticipants(room)
	var action string
	if reconnected {
		action = "reconnected"
	} else {
		action = "joined"
	}
	m.broadcastSystem(room, fmt.Sprintf("%s %s", participant.Username, action))
	return result, nil
}

func (m *RoomManager) LeaveRoom(roomID string, socket *WSConn) {
	room := m.getRoom(roomID)
	if room == nil {
		return
	}

	_, participantID, _, _, _ := socket.Metadata()
	if participantID == "" {
		return
	}

	var username string
	room.mu.Lock()
	participant := room.removeParticipant(participantID)
	socket.ClearParticipant()
	if participant != nil {
		username = participant.Username
	}
	room.mu.Unlock()

	if participant != nil {
		m.broadcastSystem(room, fmt.Sprintf("%s left", username))
		m.broadcastParticipants(room)
	}

	m.deleteRoomIfEmpty(roomID, room)
}

func (m *RoomManager) MarkDisconnected(roomID string, socket *WSConn) {
	room := m.getRoom(roomID)
	if room == nil {
		return
	}

	_, participantID, _, intentionalLeave, replaced := socket.Metadata()
	if replaced || participantID == "" {
		return
	}
	if intentionalLeave {
		m.LeaveRoom(roomID, socket)
		return
	}

	var participant *ParticipantRecord
	room.mu.Lock()
	participant = room.removeParticipant(participantID)
	if participant != nil {
		p := participant
		timer := time.AfterFunc(reconnectGracePeriod, func() {
			room.mu.Lock()
			delete(room.disconnectedUsers, p.ParticipantID)
			room.mu.Unlock()
			m.broadcastParticipants(room)
			m.deleteRoomIfEmpty(roomID, room)
		})
		room.disconnectedUsers[p.ParticipantID] = &DisconnectedUserInfo{
			Participant: p,
			Timer:       timer,
		}
	}
	room.mu.Unlock()

	if participant == nil {
		return
	}

	m.broadcastSystem(room, fmt.Sprintf("%s disconnected", participant.Username))
	m.broadcastParticipants(room)
}

func (m *RoomManager) CreateMessage(roomID string, socket *WSConn, text string) (*ChatMessage, error) {
	if len(text) == 0 {
		return nil, nil
	}
	if len(text) > messageLimit {
		return nil, fmt.Errorf("message too long (max %d characters)", messageLimit)
	}

	room := m.getRoom(roomID)
	if room == nil {
		return nil, fmt.Errorf("room not joined")
	}

	_, participantID, _, _, _ := socket.Metadata()
	if participantID == "" {
		return nil, fmt.Errorf("participant not joined")
	}

	room.mu.RLock()
	participant := room.participants[participantID]
	room.mu.RUnlock()
	if participant == nil {
		return nil, fmt.Errorf("participant not joined")
	}

	message := &ChatMessage{
		ID:            newUUIDv4(),
		Type:          "MESSAGE_CREATED",
		ParticipantID: participant.ParticipantID,
		Username:      participant.Username,
		Text:          text,
		Timestamp:     time.Now().UnixMilli(),
	}

	m.broadcastJSON(room, message)
	go m.messageStore.SaveMessage(roomID, *message)
	return message, nil
}

func (m *RoomManager) ValidateAndHandleMessage(socket *WSConn, payload sendMessage) *ErrorPayload {
	roomID, participantID, username, _, _ := socket.Metadata()
	if roomID == "" || participantID == "" || username == "" {
		return &ErrorPayload{Type: "ERROR", Code: "not_joined", Message: "join a room before sending messages"}
	}

	if rateLimited(socket) {
		return &ErrorPayload{Type: "ERROR", Code: "rate_limited", Message: "too many messages; slow down"}
	}

	text := strings.TrimSpace(payload.Text)
	if text == "" {
		return nil
	}
	if len(text) > messageLimit {
		return &ErrorPayload{Type: "ERROR", Code: "message_too_long", Message: fmt.Sprintf("message too long (max %d characters)", messageLimit)}
	}

	if _, err := m.CreateMessage(roomID, socket, text); err != nil {
		return &ErrorPayload{Type: "ERROR", Code: "handler_failed", Message: err.Error()}
	}
	return nil
}

func (m *RoomManager) getRoom(roomID string) *Room {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.rooms[roomID]
}

func (m *RoomManager) deleteRoomIfEmpty(roomID string, room *Room) {
	room.mu.RLock()
	empty := room.isEmpty()
	room.mu.RUnlock()
	if !empty {
		return
	}

	room.mu.Lock()
	room.clearAllReconnectTimers()
	room.mu.Unlock()

	m.mu.Lock()
	delete(m.rooms, roomID)
	m.mu.Unlock()
	m.messageStore.DeleteRoomMessages(roomID)
}

func (m *RoomManager) getReconnectParticipantLocked(room *Room, username, participantID, reconnectToken string) *DisconnectedUserInfo {
	if participantID == "" || reconnectToken == "" {
		return nil
	}
	disconnected := room.disconnectedUsers[participantID]
	if disconnected == nil {
		return nil
	}
	if disconnected.Participant.Username != username {
		return nil
	}
	if !validReconnectToken(disconnected.Participant, reconnectToken) {
		return nil
	}
	return disconnected
}

func (m *RoomManager) getActiveParticipantLocked(room *Room, username, participantID, reconnectToken string) *ParticipantRecord {
	if participantID == "" || reconnectToken == "" {
		return nil
	}
	participant := room.participants[participantID]
	if participant == nil || participant.Username != username {
		return nil
	}
	if !validReconnectToken(participant, reconnectToken) {
		return nil
	}
	return participant
}

func (m *RoomManager) broadcastParticipants(room *Room) {
	room.mu.RLock()
	payload := ParticipantsUpdatedPayload{
		Type:         "PARTICIPANTS_UPDATED",
		Participants: room.getParticipantView(),
		UserCount:    room.userCount(),
	}
	sockets := activeSocketsLocked(room)
	room.mu.RUnlock()
	sendToSockets(sockets, payload)
}

func (m *RoomManager) broadcastSystem(room *Room, text string) {
	room.mu.RLock()
	payload := SystemNoticePayload{
		Type:      "SYSTEM_NOTICE",
		Text:      text,
		Timestamp: time.Now().UnixMilli(),
	}
	sockets := activeSocketsLocked(room)
	room.mu.RUnlock()
	sendToSockets(sockets, payload)
}

func (m *RoomManager) broadcastJSON(room *Room, payload any) {
	room.mu.RLock()
	sockets := activeSocketsLocked(room)
	room.mu.RUnlock()
	sendToSockets(sockets, payload)
}

func activeSocketsLocked(room *Room) []*WSConn {
	sockets := make([]*WSConn, 0, len(room.participants))
	for _, participant := range room.participants {
		if participant.Socket != nil {
			sockets = append(sockets, participant.Socket)
		}
	}
	return sockets
}

func sendToSockets(sockets []*WSConn, payload any) {
	for _, socket := range sockets {
		_ = socket.SendJSON(payload)
	}
}

func rateLimited(socket *WSConn) bool {
	now := time.Now().UnixMilli()
	window := socket.RateLimitWindow()
	recent := make([]int64, 0, len(window)+1)
	for _, ts := range window {
		if now-ts < rateLimitWindowMS {
			recent = append(recent, ts)
		}
	}
	if len(recent) >= rateLimitMaxMessages {
		socket.SetRateLimitWindow(recent)
		return true
	}
	recent = append(recent, now)
	socket.SetRateLimitWindow(recent)
	return false
}
