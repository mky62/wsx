import { useState } from "react";
import logo from '../../assets/chatlogo.svg';

interface ChatTopProps {
  roomId: string;
  userCount: number;
  onLeave: () => void;
}

function ChatTop({ roomId, userCount, onLeave }: ChatTopProps) {
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
    <div className="relative flex justify-between items-center bg-slate-900/80 backdrop-blur-md border border-slate-700/50 px-3 sm:px-6 py-2 sm:py-3 min-h-[60px] rounded-b-2xl gap-2">
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink min-w-0">
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
          <span className="text-white font-mono text-xs sm:text-sm tracking-tight underline group-hover:text-yellow-400 hover:underline-offset-2 transition-colors truncate max-w-[140px] sm:max-w-none">
            {roomId}
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-shrink-0 flex items-center gap-1.5 sm:gap-2 border border-slate-600/50 bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-[10px] sm:text-xs font-bold text-indigo-100 tracking-tighter">
            {userCount} <span className="hidden sm:inline">inside</span>
          </span>
        </div>
        <button
          onClick={onLeave}
          className="rounded-md border border-slate-600/60 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide text-slate-100 hover:bg-slate-800"
        >
          Leave
        </button>
      </div>

      {copied && (
        <div className="absolute -bottom-8 sm:-bottom-10 left-1/2 -translate-x-1/2 bg-slate-600/95 text-white text-xs px-3 py-1.5 rounded-md shadow-lg border border-slate-500/30 animate-bounce z-10 whitespace-nowrap">
          Copied to clipboard!
        </div>
      )}
    </div>
  );
}

export default ChatTop;
