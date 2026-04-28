export interface TextChatMessage {
  id: string;
  type: "MESSAGE_CREATED";
  participantId: string;
  username: string;
  contentType?: "text";
  text: string;
  timestamp: number;
}

export interface ImageChatMessage {
  id: string;
  type: "MESSAGE_CREATED";
  participantId: string;
  username: string;
  contentType: "image";
  image: {
    id: string;
    token: string;
    url: string;
    dataUrl?: string;
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    expiresAt: number;
  };
  timestamp: number;
}

export type ChatMessage = TextChatMessage | ImageChatMessage;

export interface SystemChatMessage {
  id: string;
  type: "SYSTEM";
  text: string;
  timestamp: number;
}

export type ChatEntry = ChatMessage | SystemChatMessage;

type ChatAction =
  | { type: "ADD_MESSAGE"; payload: ChatEntry }
  | { type: "UPDATE_MESSAGE"; payload: ChatEntry }
  | { type: "SET_HISTORY"; payload: ChatMessage[] };

export function chatReducer(state: ChatEntry[], action: ChatAction): ChatEntry[] {
  switch (action.type) {
    case "ADD_MESSAGE": {
      const existingIds = new Set(state.map(msg => msg.id));
      if (existingIds.has(action.payload.id)) {
        return state;
      }
      return [...state, action.payload];
    }

    case "UPDATE_MESSAGE": {
      const existing = state.some(msg => msg.id === action.payload.id);
      if (!existing) {
        return sortEntries([...state, action.payload]);
      }

      return state.map(msg => msg.id === action.payload.id ? action.payload : msg);
    }

    case "SET_HISTORY": {
      // Create a Set of existing message IDs for O(1) lookup
      const existingIds = new Set(state.map(msg => msg.id));

      // Filter out history messages that are already in state
      const uniqueHistory = action.payload.filter(msg => !existingIds.has(msg.id));

      // Prepend unique history to state
      return sortEntries([...uniqueHistory, ...state]);
    }

    default:
      return state;
  }
}

function sortEntries(entries: ChatEntry[]): ChatEntry[] {
  return [...entries].sort((a, b) => a.timestamp - b.timestamp);
}
