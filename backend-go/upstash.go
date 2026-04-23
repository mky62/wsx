package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type UpstashResponse struct {
	Result json.RawMessage `json:"result"`
	Error  string          `json:"error"`
}

type UpstashClient struct {
	baseURL string
	token   string
	client  *http.Client
}

func NewUpstashClient(baseURL, token string) *UpstashClient {
	return &UpstashClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   token,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *UpstashClient) Configured() bool {
	return c != nil && c.baseURL != "" && c.token != ""
}

func (c *UpstashClient) command(parts ...string) (json.RawMessage, error) {
	if !c.Configured() {
		return nil, fmt.Errorf("redis not configured")
	}

	escaped := make([]string, 0, len(parts))
	for _, part := range parts {
		escaped = append(escaped, url.PathEscape(part))
	}

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/"+strings.Join(escaped, "/"), bytes.NewReader(nil))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("upstash %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var parsed UpstashResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	if parsed.Error != "" {
		return nil, errors.New(parsed.Error)
	}
	return parsed.Result, nil
}

func (c *UpstashClient) LPush(key, value string) error {
	_, err := c.command("lpush", key, value)
	return err
}

func (c *UpstashClient) LTrim(key string, start, stop int) error {
	_, err := c.command("ltrim", key, fmt.Sprint(start), fmt.Sprint(stop))
	return err
}

func (c *UpstashClient) LRange(key string, start, stop int) ([]string, error) {
	raw, err := c.command("lrange", key, fmt.Sprint(start), fmt.Sprint(stop))
	if err != nil {
		return nil, err
	}
	var result []string
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *UpstashClient) Del(key string) error {
	_, err := c.command("del", key)
	return err
}

func (c *UpstashClient) Ping() (bool, error) {
	raw, err := c.command("ping")
	if err != nil {
		return false, err
	}
	var result string
	if err := json.Unmarshal(raw, &result); err != nil {
		return false, err
	}
	return result == "PONG", nil
}
