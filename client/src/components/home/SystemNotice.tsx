interface SystemNoticeProps {
  variant?: "default" | "compact";
}

export function SystemNotice({ variant = "default" }: SystemNoticeProps) {
  if (variant === "compact") {
    return (
      <div className="hidden border border-black/10 bg-black/[0.035] p-4 text-sm sm:block lg:hidden">
        <div className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">
          system notice
        </div>
        <p className="mt-2 text-base text-black">
          Hello | messages stay encrypted for reloads and short connection breaks.
        </p>
        <p className="mt-2 text-sm text-black/65">
          Rooms disappear after everyone leaves or reconnect grace ends.
        </p>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex h-full flex-col justify-end p-6 text-white">
      <div className="mb-4 text-[10px] uppercase tracking-wide text-white/70">
        system notice
      </div>
      <p className="max-w-sm text-xl">
        Hello  messages stay encrypted for reloads and connection breaks.
      </p>
      <p className="mt-3 max-w-sm text-sm text-white/70">
        Rooms disappear after everyone leaves or reconnect grace ends.
      </p>
    </div>
  );
}
