import { FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Phase } from "./types";

interface HeaderProps {
  phase: Phase;
}

export function Header({ phase }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d6d4cc] pb-3 sm:gap-4 sm:pb-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center bg-[linear-gradient(160deg,#1499f5_0%,#33bfd4_28%,#52cda5_58%,#bfd85a_100%)] bg-clip-text text-xl font-semibold uppercase tracking-[0.18em] leading-none text-transparent sm:text-2xl">
            wsx
          </span>
          <span className="hidden h-px w-16 bg-black/12 sm:block" />
        </div>
      </div>
      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
        <div className="flex h-8 items-center gap-1.5 border border-black/15 bg-[#f0efe9] px-2">
          <span className={`h-2 w-2 ${phase === "identity" ? "bg-cyan-500" : "bg-[#d6d4cc]"}`} />
          <span className={`h-2 w-2 ${phase === "session" ? "bg-cyan-500" : "bg-[#d6d4cc]"}`} />
        </div>
        <button
          onClick={() => navigate("/docs")}
          className="flex h-8 w-8 items-center justify-center border border-black/15 bg-[#f0efe9] text-[#6b6b6b] hover:border-black hover:bg-black hover:text-[#f7f6f2] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
          aria-label="View documentation"
        >

        </button>
      </div>
    </div>
  );
}
