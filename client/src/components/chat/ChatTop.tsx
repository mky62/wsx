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
    <div className="relative flex flex-col gap-2 rounded-b-2xl border border-slate-700/40 bg-slate-900/78 px-3 py-2.5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2.5 lg:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex-shrink-0">
          <img src={logo} alt="Logo" className="h-6 w-8 sm:h-7 sm:w-10" />
        </div>
        <button
          onClick={copyRoomId}
          className="group flex min-w-0 flex-1 flex-col items-start leading-tight text-left"
        >
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-400 sm:block">
            Room
          </span>
          <span className="w-full break-all text-sm font-mono tracking-tight text-white underline transition-colors group-hover:text-yellow-400 hover:underline-offset-2 sm:max-w-[28vw] sm:truncate lg:max-w-none">
            {roomId}
          </span>
        </button>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
        <div className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-slate-600/45 bg-slate-800/45 px-2.5 py-1">
          <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-semibold tracking-tight text-indigo-100">
            {userCount} <span className="hidden sm:inline">inside</span>
          </span>
        </div>
        <button
          onClick={onViewMembers}
          className="min-h-9 flex-1 rounded-md border border-slate-600/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100 hover:bg-slate-800/80 sm:min-h-0 sm:flex-none"
        >
          Members
        </button>
        <button
          onClick={onLeave}
          className="min-h-9 flex-1 rounded-md border border-slate-600/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100 hover:bg-slate-800/80 sm:min-h-0 sm:flex-none"
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
