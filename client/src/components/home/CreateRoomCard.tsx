interface CreateRoomCardProps {
  isNavigating: boolean;
  onCreate: () => void;
}

export function CreateRoomCard({ isNavigating, onCreate }: CreateRoomCardProps) {
  return (
    <button
      onClick={onCreate}
      disabled={isNavigating}
      className="group relative overflow-hidden border-2 border-black bg-black p-5 text-left transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-40 disabled:hover:scale-100 sm:p-6"
      aria-label="Create new chat room"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
      <div className="relative">
        <div className="mb-3 flex h-12 w-12 items-center justify-center bg-[#f7f6f2]">
          <svg className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div className="text-xl text-[#f7f6f2] sm:text-2xl">create room</div>
        <div className="mt-1 text-sm text-[#f7f6f2]/70">
          Start a new anonymous chat
        </div>
      </div>
    </button>
  );
}
