package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
)

const (
	historyMessageLimit = 50
	ivLength            = 12
	authTagLength       = 16
)

var encryptionKeyPattern = regexp.MustCompile(`(?i)^[0-9a-f]{64}$`)

type MessageStore struct {
	redis         *UpstashClient
	encryptionKey []byte
	debug         bool
}

func NewMessageStore(redis *UpstashClient, encryptionKey string, debug bool) *MessageStore {
	var key []byte
	if encryptionKeyPattern.MatchString(encryptionKey) {
		key = make([]byte, hex.DecodedLen(len(encryptionKey)))
		if _, err := hex.Decode(key, []byte(encryptionKey)); err != nil {
			key = nil
		}
	}

	return &MessageStore{
		redis:         redis,
		encryptionKey: key,
		debug:         debug,
	}
}

func (s *MessageStore) roomKey(roomID string) string {
	return fmt.Sprintf("room:%s:messages", roomID)
}

func (s *MessageStore) Status() string {
	if s.IsEnabled() {
		return "enabled"
	}
	return "disabled"
}

func (s *MessageStore) IsEnabled() bool {
	return len(s.encryptionKey) == 32 && s.redis != nil && s.redis.Configured()
}

func (s *MessageStore) SaveMessage(roomID string, message ChatMessage) {
	if !s.IsEnabled() {
		return
	}

	raw, err := json.Marshal(message)
	if err != nil {
		return
	}

	encrypted, err := s.encrypt(string(raw))
	if err != nil {
		if s.debug {
			log.Printf("[backend-go] encrypt save message failed: %v", err)
		}
		return
	}

	key := s.roomKey(roomID)
	if err := s.redis.LPush(key, encrypted); err != nil && s.debug {
		log.Printf("[backend-go] lpush failed: %v", err)
	}
	if err := s.redis.LTrim(key, 0, historyMessageLimit-1); err != nil && s.debug {
		log.Printf("[backend-go] ltrim failed: %v", err)
	}
}

func (s *MessageStore) GetMessages(roomID string, limit int) []ChatMessage {
	if !s.IsEnabled() {
		return []ChatMessage{}
	}
	if limit <= 0 {
		limit = historyMessageLimit
	}

	values, err := s.redis.LRange(s.roomKey(roomID), 0, limit-1)
	if err != nil {
		if s.debug {
			log.Printf("[backend-go] lrange failed: %v", err)
		}
		return []ChatMessage{}
	}

	out := make([]ChatMessage, 0, len(values))
	for _, value := range values {
		decrypted, err := s.decrypt(value)
		if err != nil {
			if s.debug {
				log.Printf("[backend-go] decrypt failed: %v", err)
			}
			continue
		}

		var msg ChatMessage
		if err := json.Unmarshal([]byte(decrypted), &msg); err != nil {
			if s.debug {
				log.Printf("[backend-go] unmarshal history failed: %v", err)
			}
			continue
		}
		if msg.Type != "MESSAGE_CREATED" {
			continue
		}
		out = append(out, msg)
	}

	slicesReverse(out)
	return out
}

func (s *MessageStore) DeleteRoomMessages(roomID string) {
	if s.redis == nil || !s.redis.Configured() {
		return
	}
	if err := s.redis.Del(s.roomKey(roomID)); err != nil && s.debug {
		log.Printf("[backend-go] del room messages failed: %v", err)
	}
}

func (s *MessageStore) HealthCheck() bool {
	if !s.IsEnabled() {
		return false
	}
	ok, err := s.redis.Ping()
	if err != nil {
		if s.debug {
			log.Printf("[backend-go] redis ping failed: %v", err)
		}
		return false
	}
	return ok
}

func (s *MessageStore) encrypt(text string) (string, error) {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCMWithTagSize(block, authTagLength)
	if err != nil {
		return "", err
	}

	iv := make([]byte, ivLength)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}

	cipherText := gcm.Seal(nil, iv, []byte(text), nil)
	split := len(cipherText) - authTagLength
	if split <= 0 {
		return "", fmt.Errorf("invalid ciphertext length")
	}

	encrypted := cipherText[:split]
	authTag := cipherText[split:]
	return strings.Join([]string{
		hex.EncodeToString(iv),
		hex.EncodeToString(authTag),
		hex.EncodeToString(encrypted),
	}, ":"), nil
}

func (s *MessageStore) decrypt(text string) (string, error) {
	parts := strings.Split(text, ":")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid encrypted payload")
	}

	iv, err := hex.DecodeString(parts[0])
	if err != nil {
		return "", err
	}
	authTag, err := hex.DecodeString(parts[1])
	if err != nil {
		return "", err
	}
	encrypted, err := hex.DecodeString(parts[2])
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCMWithTagSize(block, authTagLength)
	if err != nil {
		return "", err
	}

	combined := make([]byte, len(encrypted)+len(authTag))
	copy(combined, encrypted)
	copy(combined[len(encrypted):], authTag)
	plain, err := gcm.Open(nil, iv, combined, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func hashReconnectToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func validReconnectToken(participant *ParticipantRecord, reconnectToken string) bool {
	left, err := hex.DecodeString(participant.ReconnectTokenHash)
	if err != nil {
		return false
	}
	right, err := hex.DecodeString(hashReconnectToken(reconnectToken))
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare(left, right) == 1
}

func slicesReverse(values []ChatMessage) {
	for i, j := 0, len(values)-1; i < j; i, j = i+1, j-1 {
		values[i], values[j] = values[j], values[i]
	}
}
