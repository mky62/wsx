import type { CSSProperties } from "react";

export type Phase = "identity" | "session";

export interface State {
  phase: Phase;
  alias: string;
  roomId: string;
  isGenerating: boolean;
  isSettling: boolean;
  error: string | null;
  isNavigating: boolean;
}

export type Action =
  | { type: "GENERATE_ALIAS_START" }
  | { type: "GENERATE_ALIAS_COMPLETE"; payload: string }
  | { type: "SET_SETTLE"; payload: boolean }
  | { type: "SET_PHASE"; payload: Phase }
  | { type: "SET_ROOM_ID"; payload: string }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_NAVIGATING"; payload: boolean };

export type CubeStyle = CSSProperties & Record<
  "--cube-shift-x" | "--cube-shift-y" | "--cube-tilt" | "--cube-scale" | "--cube-tint",
  string
>;
