package main

import (
	"crypto/rand"
	"fmt"
)

const (
	roomIDAlphabet  = "abcdefghijklmnopqrstuvwxyz0123456789-"
	tokenAlphabet   = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"
	messageAlphabet = "0123456789abcdef"
)

func randomString(length int, alphabet string) string {
	if length <= 0 {
		return ""
	}

	alphaLen := len(alphabet)
	// rejectionLimit is the largest multiple of alphaLen <= 256.
	// Bytes >= rejectionLimit are discarded to avoid modulo bias.
	rejectionLimit := 256 / alphaLen * alphaLen
	if rejectionLimit == 0 {
		rejectionLimit = 1
	}

	out := make([]byte, length)
	for i := 0; i < length; {
		var buf [8]byte
		if _, err := rand.Read(buf[:]); err != nil {
			panic(fmt.Errorf("failed generating random id: %w", err))
		}
		for _, b := range buf {
			if int(b) < rejectionLimit {
				out[i] = alphabet[int(b)%alphaLen]
				i++
				if i == length {
					break
				}
			}
		}
	}
	return string(out)
}

func newRoomID() string {
	return randomString(10, roomIDAlphabet)
}

func newParticipantID() string {
	return randomString(16, tokenAlphabet)
}

func newReconnectToken() string {
	return randomString(32, tokenAlphabet)
}

func newUUIDv4() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Errorf("failed generating uuid: %w", err))
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
