export interface ChatMessage {
  id: string;
  type: "MESSAGE_CREATED";
  participantId: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface SystemChatMessage {
  id: string;
  type: "SYSTEM";
  text: string;
  timestamp: number;
}

export type ChatEntry = ChatMessage | SystemChatMessage;

type ChatAction =
  | { type: "ADD_MESSAGE"; payload: ChatEntry }
  | { type: "SET_HISTORY"; payload: ChatMessage[] };

export function chatReducer(state: ChatEntry[], action: ChatAction): ChatEntry[] {
  switch (action.type) {
    case "ADD_MESSAGE":
      return [...state, action.payload];

    case "SET_HISTORY": {
      // Create a Set of existing message IDs for O(1) lookup
      const existingIds = new Set(state.map(msg => msg.id));

      // Filter out history messages that are already in state
      const uniqueHistory = action.payload.filter(msg => !existingIds.has(msg.id));

      // Prepend unique history to state
      return [...uniqueHistory, ...state];
    }

    default:
      return state;
  }
}
