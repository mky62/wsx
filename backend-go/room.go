package main

import (
	"slices"
	"sync"
	"time"
)

type Room struct {
	ID                string
	CreatedAt         int64
	mu                sync.RWMutex
	participants      map[string]*ParticipantRecord
	disconnectedUsers map[string]*DisconnectedUserInfo
}

func NewRoom(id string, createdAt int64) *Room {
	return &Room{
		ID:                id,
		CreatedAt:         createdAt,
		participants:      make(map[string]*ParticipantRecord),
		disconnectedUsers: make(map[string]*DisconnectedUserInfo),
	}
}

func (r *Room) addParticipant(participant *ParticipantRecord, socket *WSConn) {
	now := time.Now().UnixMilli()
	socket.SetParticipant(r.ID, participant.ParticipantID, participant.Username)
	participant.Connected = true
	participant.LastSeenAt = now
	participant.Socket = socket
	r.participants[participant.ParticipantID] = participant
}

func (r *Room) removeParticipant(participantID string) *ParticipantRecord {
	participant, ok := r.participants[participantID]
	if !ok {
		return nil
	}

	delete(r.participants, participantID)
	participant.Connected = false
	participant.LastSeenAt = time.Now().UnixMilli()
	participant.Socket = nil
	return participant
}

func (r *Room) hasUsername(username string) bool {
	for _, participant := range r.participants {
		if participant.Username == username {
			return true
		}
	}
	for _, disconnected := range r.disconnectedUsers {
		if disconnected.Participant.Username == username {
			return true
		}
	}
	return false
}

func (r *Room) getParticipantView() []ParticipantView {
	views := make([]ParticipantView, 0, len(r.participants))
	for _, participant := range r.participants {
		views = append(views, ParticipantView{
			ParticipantID: participant.ParticipantID,
			Username:      participant.Username,
			Connected:     participant.Connected,
			LastSeenAt:    participant.LastSeenAt,
		})
	}
	slices.SortFunc(views, func(a, b ParticipantView) int {
		switch {
		case a.Username < b.Username:
			return -1
		case a.Username > b.Username:
			return 1
		default:
			return 0
		}
	})
	return views
}

func (r *Room) userCount() int {
	return len(r.participants)
}

func (r *Room) isEmpty() bool {
	return len(r.participants) == 0 && len(r.disconnectedUsers) == 0
}

func (r *Room) clearAllReconnectTimers() {
	for _, info := range r.disconnectedUsers {
		if info.Timer != nil {
			info.Timer.Stop()
		}
	}
}
