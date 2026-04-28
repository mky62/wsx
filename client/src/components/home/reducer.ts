import type { State, Action } from "./types";

export function homeReducer(state: State, action: Action): State {
  switch (action.type) {
    case "GENERATE_ALIAS_START":
      return { ...state, isGenerating: true, alias: "", error: null };
    case "GENERATE_ALIAS_COMPLETE":
      return { ...state, isGenerating: false, alias: action.payload };
    case "SET_SETTLE":
      return { ...state, isSettling: action.payload };
    case "SET_PHASE":
      return { ...state, phase: action.payload, error: null };
    case "SET_ROOM_ID":
      return { ...state, roomId: action.payload, error: null };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_NAVIGATING":
      return { ...state, isNavigating: action.payload };
    default:
      return state;
  }
}
