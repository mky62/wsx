import { MAX_ROOM_ID_LENGTH } from "./constants";

interface JoinRoomCardProps {
  roomId: string;
  isNavigating: boolean;
  onRoomIdChange: (value: string) => void;
  onJoin: () => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function JoinRoomCard({
  roomId,
  isNavigating,
  onRoomIdChange,
  onJoin,
  onKeyPress,
}: JoinRoomCardProps) {
  return (
    <div className="flex flex-col gap-3 border-2 border-[#d6d4cc] bg-[#faf9f6] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#f0efe9]">
          <svg className="h-6 w-6 text-[#6b6b6b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-lg text-black">join room</div>
          <div className="text-xs text-[#6b6b6b]">Enter an existing room ID</div>
        </div>
      </div>
      <div className="grid gap-2">
        <label htmlFor="room-id-input" className="sr-only">
          Room ID
        </label>
        <input
          id="room-id-input"
          type="text"
          value={roomId}
          onChange={(e) => onRoomIdChange(e.target.value)}
          onKeyDown={onKeyPress}
          placeholder="room id"
          disabled={isNavigating}
          className="
            w-full border border-[#d6d4cc] bg-[#f0efe9] px-4 py-3
            text-sm font-mono
            focus:outline-none focus:ring-2 focus:ring-black focus:border-black
            disabled:opacity-40
            transition-all
          "
          aria-describedby="room-id-help"
          maxLength={MAX_ROOM_ID_LENGTH}
        />
        <button
          onClick={onJoin}
          disabled={isNavigating || !roomId.trim()}
          className="w-full border-2 border-black bg-black px-4 py-3 uppercase tracking-wide text-[#f7f6f2] hover:bg-[#f7f6f2] hover:text-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label="Join existing room"
        >
          {isNavigating ? "joining..." : "enter room"}
        </button>
      </div>
    </div>
  );
}
