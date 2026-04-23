import type { ParticipantView } from "../../hooks/useChatSocket";

interface RoomMembersPanelProps {
  isOpen: boolean;
  participants: ParticipantView[];
  currentParticipantId?: string;
  onClose: () => void;
}

function formatLastSeen(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RoomMembersPanel({
  isOpen,
  participants,
  currentParticipantId,
  onClose,
}: RoomMembersPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-20 bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-3xl border border-white/10 bg-slate-950/95 text-slate-100 shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[380px] sm:max-w-[85vw] sm:rounded-none sm:rounded-l-3xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-members-title"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sm:px-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-300/80">
              Room Members
            </div>
            <h2 id="room-members-title" className="mt-1 text-lg font-semibold text-white">
              {participants.length} active {participants.length === 1 ? "member" : "members"}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(82dvh-88px)] overflow-y-auto px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:max-h-dvh sm:px-5 sm:py-4">
          <div className="space-y-3">
            {participants.map((participant) => {
              const isSelf = participant.participantId === currentParticipantId;
              const initials = participant.username.slice(0, 2).toUpperCase();

              return (
                <div
                  key={participant.participantId}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-3"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-bold text-cyan-200">
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-white">
                        {participant.username}
                      </span>
                      {isSelf && (
                        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                          You
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Online
                      </span>
                      <span>Seen {formatLastSeen(participant.lastSeenAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
