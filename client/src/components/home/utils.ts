import { USERNAME_PRESETS } from "../../utils/presets";
import { MIN_ROOM_ID_LENGTH, MAX_ROOM_ID_LENGTH } from "./constants";

export function generateRandomAlias(): string {
  const preset = USERNAME_PRESETS[Math.floor(Math.random() * USERNAME_PRESETS.length)];
  const timestamp = Date.now().toString(36);
  const random = Math.floor(Math.random() * 100).toString(36);
  return `${preset}_${timestamp}${random}`;
}

export function sanitizeRoomId(id: string): string {
  return id
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function sanitizeUsername(username: string): string {
  return username
    .replace(/[<>'&]/g, "")
    .trim()
    .slice(0, 25);
}

export function validateRoomId(roomId: string): string | null {
  if (!roomId) {
    return "Session ID is required";
  }
  if (roomId.length < MIN_ROOM_ID_LENGTH) {
    return `Session ID must be at least ${MIN_ROOM_ID_LENGTH} characters`;
  }
  if (roomId.length > MAX_ROOM_ID_LENGTH) {
    return `Session ID cannot exceed ${MAX_ROOM_ID_LENGTH} characters`;
  }
  if (!/^[a-z0-9-]{5,35}$/.test(roomId)) {
    return "Session ID can only contain lowercase letters, numbers, and hyphens";
  }
  return null;
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, "");

  const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (wsUrl) return wsUrl.replace(/^ws/, "http").replace(/\/$/, "");

  return "http://localhost:8080";
}
