import type { State } from "./types";

interface IdentityPhaseProps {
  state: State;
  onGenerate: () => void;
  onContinue: () => void;
}

export function IdentityPhase({ state, onGenerate, onContinue }: IdentityPhaseProps) {
  const canContinue = state.alias && !state.isGenerating;

  return (
    <div className="grid gap-4 lg:h-full lg:content-center lg:gap-5">
      <div>
        <label htmlFor="alias-display" className="text-xs uppercase tracking-wide mb-2 block">
          generated identity
        </label>

        <div
          id="alias-display"
          className={`terminal-output text-sm sm:text-base md:text-lg ${state.isSettling ? "paper-settle" : ""}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {state.alias || "- initializing identity -"}
          {state.isGenerating && <span className="cursor" aria-label="generating" />}
        </div>

        <div className="mt-3 flex flex-col items-start gap-2 text-xs text-[#5d5d58] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span className="max-w-xl">
            Display-only. Server assigns the session identity.
          </span>
          <button
            onClick={onGenerate}
            className="shrink-0 underline hover:text-black focus:outline-none focus:text-black"
            disabled={state.isGenerating}
            aria-label="Regenerate identity alias"
          >
            regenerate
          </button>
        </div>
      </div>

      <button
        onClick={onContinue}
        disabled={!canContinue}
        className="
          h-12 w-full
          border border-black bg-black text-[#f7f6f2]
          uppercase tracking-wide
          hover:bg-[#f7f6f2] hover:text-black
          focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors
        "
        aria-label="Continue to session creation"
      >
        continue
      </button>
    </div>
  );
}
