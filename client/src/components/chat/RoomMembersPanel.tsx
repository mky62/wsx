import { X } from "lucide-react";
import type { ParticipantView } from "../../hooks/useChatSocket";

interface RoomMembersPanelProps {
  isOpen: boolean;
  participants: ParticipantView[];
  onClose: () => void;
}

export default function RoomMembersPanel({
  isOpen,
  participants,
  onClose,
}: RoomMembersPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-20 bg-slate-950/30"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-[22px] border border-slate-800/70 bg-[linear-gradient(180deg,rgba(2,6,23,0.985)_0%,rgba(3,9,28,0.975)_100%)] text-slate-100 shadow-[0_-12px_40px_rgba(0,0,0,0.24)] sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[320px] sm:max-w-[100vw] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:border-l sm:shadow-none"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-members-title"
      >
        <div className="border-b border-slate-800/90 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-300/85">
                Room Members
              </div>
              <h2 id="room-members-title" className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {participants.length} {participants.length === 1 ? "member" : "members"}
              </h2>
            </div>

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/80 text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
              aria-label="Close members panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(82dvh-118px)] overflow-y-auto px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-h-dvh sm:px-5">
          <div className="space-y-1.5">
            {participants.map((participant) => {
              return (
                <div
                  key={participant.participantId}
                  className="rounded-xl border border-slate-800/60 bg-slate-900/22 px-3 py-3 transition-colors hover:bg-slate-900/38"
                >
                  <span className="block truncate text-sm font-medium text-white sm:text-base">
                    {participant.username}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
