import { useState } from "react";
import logo from '../../assets/chatlogo.svg';

interface ChatTopProps {
  roomId: string;
  userCount: number;
  onViewMembers: () => void;
  onLeave: () => void;
}

function ChatTop({ roomId, userCount, onViewMembers, onLeave }: ChatTopProps) {
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
    <div className="relative flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border border-slate-700/50 bg-slate-900/80 px-3 py-2 backdrop-blur-md sm:px-4 sm:py-3 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <div className="flex-shrink-0">
          <img src={logo} alt="Logo" className="w-8 h-6 sm:w-14 sm:h-12" />
        </div>
        <button
          onClick={copyRoomId}
          className="group flex flex-col items-start leading-tight min-w-0 text-left"
        >
          <span className="text-xs sm:text-[10px] uppercase tracking-widest text-sky-400 font-bold hidden sm:block">
            Room
          </span>
          <span className="max-w-[42vw] truncate text-xs font-mono tracking-tight text-white underline transition-colors group-hover:text-yellow-400 hover:underline-offset-2 sm:max-w-[28vw] sm:text-sm lg:max-w-none">
            {roomId}
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-slate-600/50 bg-slate-800/50 px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-[10px] sm:text-xs font-bold text-indigo-100 tracking-tighter">
            {userCount} <span className="hidden sm:inline">inside</span>
          </span>
        </div>
        <button
          onClick={onViewMembers}
          className="rounded-md border border-slate-600/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-100 hover:bg-slate-800 sm:px-3 sm:py-1.5 sm:text-xs"
        >
          Members
        </button>
        <button
          onClick={onLeave}
          className="rounded-md border border-slate-600/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-100 hover:bg-slate-800 sm:px-3 sm:py-1.5 sm:text-xs"
        >
          Leave
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
