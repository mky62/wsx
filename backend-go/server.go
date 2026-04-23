package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
)

type Server struct {
	roomManager    *RoomManager
	messageStore   *MessageStore
	allowedOrigins []string
	debug          bool
}

func NewServer() *Server {
	debug := os.Getenv("DEBUG") != ""
	redis := NewUpstashClient(os.Getenv("UPSTASH_REDIS_REST_URL"), os.Getenv("UPSTASH_REDIS_REST_TOKEN"))
	messageStore := NewMessageStore(redis, os.Getenv("ENCRYPTION_KEY"), debug)

	allowedOrigins := []string{
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"http://localhost:4173",
		"http://127.0.0.1:4173",
	}
	if configured := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS")); configured != "" {
		allowedOrigins = nil
		for _, value := range strings.Split(configured, ",") {
			value = strings.TrimSpace(value)
			if value != "" {
				allowedOrigins = append(allowedOrigins, value)
			}
		}
	}

	return &Server{
		roomManager:    NewRoomManager(messageStore),
		messageStore:   messageStore,
		allowedOrigins: allowedOrigins,
		debug:          debug,
	}
}

func (s *Server) Handler() http.Handler {
	return http.HandlerFunc(s.handle)
}

func (s *Server) handle(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if r.Method == http.MethodOptions {
		s.writeCORSHeaders(w, origin)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if origin != "" && !s.isAllowedOrigin(origin) {
		s.sendJSON(w, http.StatusForbidden, ErrorPayload{
			Type:    "ERROR",
			Code:    "origin_not_allowed",
			Message: "origin not allowed",
		}, origin)
		return
	}

	if isWebSocketRequest(r) {
		s.handleWebSocket(w, r)
		return
	}

	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/health":
		s.sendJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"history": s.messageStore.Status(),
			"redis":   s.messageStore.HealthCheck(),
		}, origin)
	case r.Method == http.MethodPost && r.URL.Path == "/rooms":
		s.sendJSON(w, http.StatusCreated, map[string]string{
			"roomId": s.roomManager.CreateRoomID(),
		}, origin)
	default:
		s.sendJSON(w, http.StatusNotFound, map[string]string{"error": "not found"}, origin)
	}
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	if origin := r.Header.Get("Origin"); origin != "" && !s.isAllowedOrigin(origin) {
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return
	}

	socket, err := upgradeWebSocket(w, r)
	if err != nil {
		http.Error(w, "websocket upgrade failed", http.StatusBadRequest)
		return
	}

	go s.serveSocket(socket)
}

func (s *Server) serveSocket(socket *WSConn) {
	defer func() {
		roomID, _, _, _, _ := socket.Metadata()
		if roomID != "" {
			s.roomManager.MarkDisconnected(roomID, socket)
		}
		_ = socket.Close()
	}()

	for {
		var envelope map[string]any
		if err := socket.ReadJSON(&envelope, maxWSPayloadBytes); err != nil {
			return
		}

		msgType, _ := envelope["type"].(string)
		switch msgType {
		case "JOIN_ROOM":
			raw, _ := json.Marshal(envelope)
			var payload joinMessage
			if err := json.Unmarshal(raw, &payload); err != nil {
				_ = socket.SendJSON(ErrorPayload{Type: "ERROR", Code: "invalid_json", Message: "Invalid JSON format"})
				continue
			}
			if payload.RoomID == "" || payload.Username == "" {
				_ = socket.SendJSON(ErrorPayload{Type: "ERROR", Code: "invalid_join", Message: "roomId and username are required"})
				continue
			}
			result, err := s.roomManager.JoinRoom(payload.RoomID, payload.Username, socket, payload.ParticipantID, payload.ReconnectToken)
			if err != nil {
				code := "join_failed"
				switch err.Error() {
				case "invalid room id":
					code = "invalid_room_id"
				case "invalid username":
					code = "invalid_username"
				}
				_ = socket.SendJSON(ErrorPayload{Type: "ERROR", Code: code, Message: err.Error()})
				continue
			}
			_ = socket.SendJSON(JoinedPayload{
				Type:           "JOINED",
				RoomID:         result.RoomID,
				ParticipantID:  result.ParticipantID,
				ReconnectToken: result.ReconnectToken,
				Username:       result.Username,
				Participants:   result.Participants,
				UserCount:      result.UserCount,
				History:        result.History,
				Reconnected:    result.Reconnected,
				HistoryEnabled: result.HistoryEnabled,
			})
		case "SEND_MESSAGE":
			raw, _ := json.Marshal(envelope)
			var payload sendMessage
			if err := json.Unmarshal(raw, &payload); err != nil {
				_ = socket.SendJSON(ErrorPayload{Type: "ERROR", Code: "invalid_json", Message: "Invalid JSON format"})
				continue
			}
			if payload.Text == "" {
				continue
			}
			if errPayload := s.roomManager.ValidateAndHandleMessage(socket, payload); errPayload != nil {
				_ = socket.SendJSON(errPayload)
			}
		case "LEAVE_ROOM":
			socket.MarkIntentionalLeave()
			roomID, _, _, _, _ := socket.Metadata()
			if roomID != "" {
				s.roomManager.LeaveRoom(roomID, socket)
			}
			return
		default:
			_ = socket.SendJSON(ErrorPayload{
				Type:    "ERROR",
				Code:    "unknown_message_type",
				Message: "Unknown message type: " + msgType,
			})
		}
	}
}

func (s *Server) sendJSON(w http.ResponseWriter, statusCode int, payload any, origin string) {
	s.writeCORSHeaders(w, origin)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func (s *Server) writeCORSHeaders(w http.ResponseWriter, origin string) {
	if origin != "" && s.isAllowedOrigin(origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
	}
	w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "content-type")
}

func (s *Server) isAllowedOrigin(origin string) bool {
	if origin == "" {
		return true
	}
	for _, allowed := range s.allowedOrigins {
		if origin == allowed {
			return true
		}
	}
	return false
}

func isWebSocketRequest(r *http.Request) bool {
	return headerContainsToken(r.Header, "Connection", "Upgrade") && strings.EqualFold(r.Header.Get("Upgrade"), "websocket")
}

func serverPort() string {
	if value := strings.TrimSpace(os.Getenv("PORT")); value != "" {
		if _, err := strconv.Atoi(value); err == nil {
			return value
		}
	}
	return "8080"
}

func run() error {
	server := NewServer()
	addr := ":" + serverPort()
	if server.debug {
		log.Printf("HTTP/WebSocket server running on port %s", serverPort())
	}
	return http.ListenAndServe(addr, server.Handler())
}
