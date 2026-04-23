package main

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	websocketGUID      = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	opcodeText         = 0x1
	opcodeClose        = 0x8
	opcodePing         = 0x9
	opcodePong         = 0xA
	closeNormalClosure = 1000
	pingInterval       = 30 * time.Second
	pongWait           = 40 * time.Second
)

type WSConn struct {
	conn              net.Conn
	reader            *bufio.Reader
	writeMu           sync.Mutex
	metaMu            sync.RWMutex
	closeOnce         sync.Once
	roomID            string
	username          string
	participantID     string
	intentionalLeave  bool
	replaced          bool
	messageTimestamps []int64
}

func upgradeWebSocket(w http.ResponseWriter, r *http.Request) (*WSConn, error) {
	if !headerContainsToken(r.Header, "Connection", "Upgrade") || !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		return nil, fmt.Errorf("not a websocket upgrade")
	}
	key := strings.TrimSpace(r.Header.Get("Sec-WebSocket-Key"))
	if key == "" {
		return nil, fmt.Errorf("missing websocket key")
	}

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return nil, fmt.Errorf("response writer does not support hijacking")
	}
	conn, rw, err := hijacker.Hijack()
	if err != nil {
		return nil, err
	}

	accept := websocketAccept(key)
	response := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
	if _, err := rw.WriteString(response); err != nil {
		conn.Close()
		return nil, err
	}
	if err := rw.Flush(); err != nil {
		conn.Close()
		return nil, err
	}

	return &WSConn{
		conn:   conn,
		reader: rw.Reader,
	}, nil
}

func websocketAccept(key string) string {
	hash := sha1.Sum([]byte(key + websocketGUID))
	return base64.StdEncoding.EncodeToString(hash[:])
}

func headerContainsToken(header http.Header, name, want string) bool {
	for _, part := range header.Values(name) {
		for _, token := range strings.Split(part, ",") {
			if strings.EqualFold(strings.TrimSpace(token), want) {
				return true
			}
		}
	}
	return false
}

func (c *WSConn) SetParticipant(roomID, participantID, username string) {
	c.metaMu.Lock()
	defer c.metaMu.Unlock()
	c.roomID = roomID
	c.participantID = participantID
	c.username = username
}

func (c *WSConn) ClearParticipant() {
	c.metaMu.Lock()
	defer c.metaMu.Unlock()
	c.roomID = ""
	c.participantID = ""
	c.username = ""
}

func (c *WSConn) Metadata() (roomID, participantID, username string, intentionalLeave, replaced bool) {
	c.metaMu.RLock()
	defer c.metaMu.RUnlock()
	return c.roomID, c.participantID, c.username, c.intentionalLeave, c.replaced
}

func (c *WSConn) MarkIntentionalLeave() {
	c.metaMu.Lock()
	defer c.metaMu.Unlock()
	c.intentionalLeave = true
}

func (c *WSConn) MarkReplaced() {
	c.metaMu.Lock()
	defer c.metaMu.Unlock()
	c.replaced = true
}

func (c *WSConn) RateLimitWindow() []int64 {
	c.metaMu.RLock()
	defer c.metaMu.RUnlock()
	return append([]int64(nil), c.messageTimestamps...)
}

func (c *WSConn) SetRateLimitWindow(values []int64) {
	c.metaMu.Lock()
	defer c.metaMu.Unlock()
	c.messageTimestamps = values
}

// StartHeartbeat sends periodic pings and sets a read deadline.
// Must be called once after the WebSocket handshake completes.
func (c *WSConn) StartHeartbeat() {
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))

	go func() {
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()
		for range ticker.C {
			if err := c.writeFrame(opcodePing, nil); err != nil {
				return
			}
		}
	}()
}

func (c *WSConn) ReadJSON(v any, maxPayload int64) error {
	for {
		opcode, payload, err := c.readFrame(maxPayload)
		if err != nil {
			return err
		}

		switch opcode {
		case opcodeText:
			return json.Unmarshal(payload, v)
		case opcodePing:
			if err := c.writeFrame(opcodePong, payload); err != nil {
				return err
			}
		case opcodeClose:
			_ = c.writeClose(closeNormalClosure, "")
			return io.EOF
		case opcodePong:
			_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
			continue
		default:
			return fmt.Errorf("unsupported websocket opcode %d", opcode)
		}
	}
}

func (c *WSConn) SendJSON(v any) error {
	payload, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return c.writeFrame(opcodeText, payload)
}

func (c *WSConn) Close() error {
	var err error
	c.closeOnce.Do(func() {
		_ = c.writeClose(closeNormalClosure, "")
		err = c.conn.Close()
	})
	return err
}

func (c *WSConn) writeClose(code uint16, reason string) error {
	payload := make([]byte, 2+len(reason))
	binary.BigEndian.PutUint16(payload[:2], code)
	copy(payload[2:], []byte(reason))
	return c.writeFrame(opcodeClose, payload)
}

func (c *WSConn) readFrame(maxPayload int64) (byte, []byte, error) {
	header := make([]byte, 2)
	if _, err := io.ReadFull(c.reader, header); err != nil {
		return 0, nil, err
	}

	fin := header[0]&0x80 != 0
	opcode := header[0] & 0x0f
	masked := header[1]&0x80 != 0
	payloadLen := int64(header[1] & 0x7f)

	if !fin {
		return 0, nil, fmt.Errorf("fragmented frames are not supported")
	}
	if !masked {
		return 0, nil, fmt.Errorf("client frame must be masked")
	}

	switch payloadLen {
	case 126:
		extended := make([]byte, 2)
		if _, err := io.ReadFull(c.reader, extended); err != nil {
			return 0, nil, err
		}
		payloadLen = int64(binary.BigEndian.Uint16(extended))
	case 127:
		extended := make([]byte, 8)
		if _, err := io.ReadFull(c.reader, extended); err != nil {
			return 0, nil, err
		}
		payloadLen = int64(binary.BigEndian.Uint64(extended))
	}

	if maxPayload > 0 && payloadLen > maxPayload {
		return 0, nil, fmt.Errorf("payload too large")
	}

	maskKey := make([]byte, 4)
	if _, err := io.ReadFull(c.reader, maskKey); err != nil {
		return 0, nil, err
	}

	payload := make([]byte, payloadLen)
	if _, err := io.ReadFull(c.reader, payload); err != nil {
		return 0, nil, err
	}
	for i := range payload {
		payload[i] ^= maskKey[i%4]
	}
	return opcode, payload, nil
}

func (c *WSConn) writeFrame(opcode byte, payload []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()

	if c.conn == nil {
		return nil
	}

	frame := []byte{0x80 | opcode}
	payloadLen := len(payload)
	switch {
	case payloadLen <= 125:
		frame = append(frame, byte(payloadLen))
	case payloadLen <= 65535:
		frame = append(frame, 126)
		extended := make([]byte, 2)
		binary.BigEndian.PutUint16(extended, uint16(payloadLen))
		frame = append(frame, extended...)
	default:
		frame = append(frame, 127)
		extended := make([]byte, 8)
		binary.BigEndian.PutUint64(extended, uint64(payloadLen))
		frame = append(frame, extended...)
	}
	frame = append(frame, payload...)

	_, err := c.conn.Write(frame)
	return err
}
