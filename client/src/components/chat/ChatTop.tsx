import { useState } from "react";
import { DoorOpen, Users } from "lucide-react";

interface ChatTopProps {
  roomId: string;
  userCount: number;
  onViewMembers: () => void;
  onLeave: () => void;
}

function ChatTop({ roomId, userCount: _userCount, onViewMembers, onLeave }: ChatTopProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const copyRoomId = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  return (
    <div className="relative flex items-start justify-between gap-3 rounded-b-2xl border border-slate-700/40 bg-slate-900/78 px-3 py-2.5 backdrop-blur-md sm:items-center sm:px-4 sm:py-2.5 lg:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex-shrink-0">
          <span className="inline-flex items-center bg-[linear-gradient(160deg,#1499f5_0%,#33bfd4_28%,#52cda5_58%,#bfd85a_100%)] bg-clip-text text-sm font-semibold uppercase tracking-[0.16em] leading-none text-transparent sm:text-base">
            wsx
          </span>
        </div>
        <button
          onClick={copyRoomId}
          className="group flex min-w-0 flex-1 flex-col items-start justify-center leading-tight text-left"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-400">
            Room
          </span>
          <span className="w-full truncate text-sm font-mono tracking-tight text-white underline underline-offset-2 transition-colors group-hover:text-yellow-400 sm:max-w-[28vw] lg:max-w-none">
            {roomId}
          </span>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onViewMembers}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-600/55 text-slate-100 transition-colors hover:bg-slate-800/80"
          aria-label="View members"
          title="Members"
        >
          <Users size={16} />
        </button>
        <button
          onClick={onLeave}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-600/55 text-slate-100 transition-colors hover:bg-slate-800/80"
          aria-label="Leave room"
          title="Leave"
        >
          <DoorOpen size={16} />
        </button>
      </div>

      {copied && (
        <div className="absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-500/30 bg-slate-600/95 px-3 py-1.5 text-xs text-white shadow-lg">
          Copied to clipboard!
        </div>
      )}
    </div>
  );
}

export default ChatTop;
