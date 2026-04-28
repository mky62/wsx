import { inMemorySession } from "../../tempStorage/globalSession";
import { CreateRoomCard } from "./CreateRoomCard";
import { JoinRoomCard } from "./JoinRoomCard";
import { SystemNotice } from "./SystemNotice";
import type { State } from "./types";

interface SessionPhaseProps {
  state: State;
  onBack: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onRoomIdChange: (value: string) => void;
  onRoomIdKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function SessionPhase({
  state,
  onBack,
  onCreate,
  onJoin,
  onRoomIdChange,
  onRoomIdKeyPress,
}: SessionPhaseProps) {
  return (
    <div className="grid gap-6 font-mono lg:h-full lg:content-center lg:gap-8">
      {/* Identity Badge */}
      <div className="relative">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-black/10 via-transparent to-black/10 blur-sm opacity-50"></div>
        <div className="relative flex flex-col items-start gap-4 border-2 border-black bg-[#faf9f6] p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">your identity</div>
            <div className="mt-1 break-all text-base tracking-tight text-black sm:text-lg">
              {inMemorySession.username}
            </div>
          </div>
          <button
            onClick={onBack}
            disabled={state.isNavigating}
            className="w-full shrink-0 border border-[#d6d4cc] bg-[#f0efe9] px-3 py-2 text-xs uppercase tracking-wide text-[#6b6b6b] hover:border-black hover:bg-black hover:text-[#f7f6f2] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-40 transition-all sm:w-auto sm:py-1.5"
            aria-label="Regenerate identity"
          >
            change
          </button>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <CreateRoomCard isNavigating={state.isNavigating} onCreate={onCreate} />
        <JoinRoomCard
          roomId={state.roomId}
          isNavigating={state.isNavigating}
          onRoomIdChange={onRoomIdChange}
          onJoin={onJoin}
          onKeyPress={onRoomIdKeyPress}
        />
      </div>

      <div id="room-id-help" className="sr-only">
        Enter the room ID to join an existing chat room
      </div>

      <SystemNotice variant="compact" />
    </div>
  );
}
