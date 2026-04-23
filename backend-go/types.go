package main

import "time"

type ParticipantView struct {
	ParticipantID string `json:"participantId"`
	Username      string `json:"username"`
	Connected     bool   `json:"connected"`
	LastSeenAt    int64  `json:"lastSeenAt"`
}

type ParticipantRecord struct {
	ParticipantID      string
	Username           string
	Connected          bool
	LastSeenAt         int64
	ReconnectTokenHash string
	Socket             *WSConn
}

type DisconnectedUserInfo struct {
	Participant *ParticipantRecord
	Timer       *time.Timer
}

type ChatMessage struct {
	ID            string `json:"id"`
	Type          string `json:"type"`
	ParticipantID string `json:"participantId"`
	Username      string `json:"username"`
	Text          string `json:"text"`
	Timestamp     int64  `json:"timestamp"`
}

type JoinedPayload struct {
	Type           string            `json:"type"`
	RoomID         string            `json:"roomId"`
	ParticipantID  string            `json:"participantId"`
	ReconnectToken string            `json:"reconnectToken"`
	Username       string            `json:"username"`
	Participants   []ParticipantView `json:"participants"`
	UserCount      int               `json:"userCount"`
	History        []ChatMessage     `json:"history"`
	Reconnected    bool              `json:"reconnected"`
	HistoryEnabled bool              `json:"historyEnabled"`
}

type ParticipantsUpdatedPayload struct {
	Type         string            `json:"type"`
	Participants []ParticipantView `json:"participants"`
	UserCount    int               `json:"userCount"`
}

type SystemNoticePayload struct {
	Type      string `json:"type"`
	Text      string `json:"text"`
	Timestamp int64  `json:"timestamp"`
}

type ErrorPayload struct {
	Type    string `json:"type"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

type joinMessage struct {
	Type           string `json:"type"`
	RoomID         string `json:"roomId"`
	Username       string `json:"username"`
	ParticipantID  string `json:"participantId,omitempty"`
	ReconnectToken string `json:"reconnectToken,omitempty"`
}

type sendMessage struct {
	Type string `json:"type"`
	Text string `json:"text"`
}
