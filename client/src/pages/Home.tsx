import { useCallback, useEffect, useReducer, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { inMemorySession } from "../tempStorage/globalSession";
import {
  Header,
  ErrorAlert,
  IdentityPhase,
  SessionPhase,
  HeroPanel,
  homeReducer,
  ALIAS_GENERATION_DELAY,
  SETTLE_ANIMATION_DURATION,
  generateRandomAlias,
  sanitizeRoomId,
  sanitizeUsername,
  validateRoomId,
  getApiBaseUrl,
} from "../components/home";

// Component
export default function Home() {
  const navigate = useNavigate();
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, dispatch] = useReducer(homeReducer, {
    phase: "identity",
    alias: "",
    roomId: "",
    isGenerating: false,
    isSettling: false,
    error: null,
    isNavigating: false,
  });

  const handleGenerateAlias = useCallback(() => {
    dispatch({ type: "GENERATE_ALIAS_START" });

    setTimeout(() => {
      const newAlias = generateRandomAlias();
      dispatch({ type: "GENERATE_ALIAS_COMPLETE", payload: newAlias });
    }, ALIAS_GENERATION_DELAY);
  }, []);

  // Scroll lock only on desktop (lg+) where content fits in viewport.
  // On smaller screens, allow scrolling for accessibility.
  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 1024px)');

    function applyLock(desktop: boolean) {
      if (desktop) {
        document.documentElement.classList.add('home-lock');
        document.body.classList.add('home-lock');
      } else {
        document.documentElement.classList.remove('home-lock');
        document.body.classList.remove('home-lock');
      }
    }

    applyLock(isDesktop.matches);

    const handler = (e: MediaQueryListEvent) => applyLock(e.matches);
    isDesktop.addEventListener('change', handler);

    return () => {
      isDesktop.removeEventListener('change', handler);
      document.documentElement.classList.remove('home-lock');
      document.body.classList.remove('home-lock');
    };
  }, []);

  // Generate initial alias
  useEffect(() => {
    handleGenerateAlias();
  }, [handleGenerateAlias]);

  // Settle animation effect
  useEffect(() => {
    if (state.alias && !state.isGenerating) {
      dispatch({ type: "SET_SETTLE", payload: true });
      settleTimeoutRef.current = setTimeout(() => {
        dispatch({ type: "SET_SETTLE", payload: false });
      }, SETTLE_ANIMATION_DURATION);
    }

    return () => {
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
    };
  }, [state.alias, state.isGenerating]);

  // Handlers
  function handleContinueToSession() {
    if (!state.alias) {
      dispatch({ type: "SET_ERROR", payload: "Identity not initialized" });
      return;
    }

    const sanitized = sanitizeUsername(state.alias);
    inMemorySession.username = sanitized;
    dispatch({ type: "SET_PHASE", payload: "session" });
  }

  async function handleCreateSession() {
    dispatch({ type: "SET_NAVIGATING", payload: true });

    try {
      const response = await fetch(`${getApiBaseUrl()}/rooms`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Could not create session");
      }

      const data = await response.json() as { roomId?: string };
      const roomId = typeof data.roomId === "string" ? sanitizeRoomId(data.roomId) : "";
      const validationError = validateRoomId(roomId);
      if (validationError) {
        throw new Error(validationError);
      }

      navigate(`/rooms/${roomId}`, { state: { username: inMemorySession.username } });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error instanceof Error ? error.message : "Could not create session"
      });
      dispatch({ type: "SET_NAVIGATING", payload: false });
    }
  }

  function handleJoinSession() {
    const cleanRoomId = sanitizeRoomId(state.roomId.trim());
    const validationError = validateRoomId(cleanRoomId);

    if (validationError) {
      dispatch({ type: "SET_ERROR", payload: validationError });
      return;
    }

    dispatch({ type: "SET_NAVIGATING", payload: true });
    navigate(`/rooms/${cleanRoomId}`, { state: { username: inMemorySession.username } });
  }

  function handleRoomIdChange(value: string) {
    dispatch({ type: "SET_ROOM_ID", payload: value });
  }

  function handleBackToIdentity() {
    dispatch({ type: "SET_PHASE", payload: "identity" });
  }

  function handleRoomIdKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleJoinSession();
    }
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-brand-gradient text-[#0a0a0a] paper-terminal terminal-text font-mono">
      <div className="pulsar pulsar-top-right" />
      <div className="pulsar pulsar-bottom-left" />

      <main className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 flex-col justify-center gap-3 overflow-hidden px-3 py-3 sm:px-5 sm:py-4 md:px-6 md:py-6 lg:justify-start lg:py-7">
        <section
          className="grid min-h-0 flex-1 overflow-hidden border border-[#d6d4cc]/85 bg-[#faf9f6]/90 shadow-xl lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]"
          aria-label="Session setup"
        >
          <div className="flex min-h-0 flex-col overflow-y-auto scrollbar-hide p-3 sm:p-4 md:p-6">
            <Header phase={state.phase} />

            <div className="py-4 sm:py-5 md:py-6 lg:flex-1 lg:min-h-0">
              {state.error && <ErrorAlert message={state.error} />}

              {state.phase === "identity" && (
                <IdentityPhase
                  state={state}
                  onGenerate={handleGenerateAlias}
                  onContinue={handleContinueToSession}
                />
              )}

              {state.phase === "session" && (
                <SessionPhase
                  state={state}
                  onBack={handleBackToIdentity}
                  onCreate={handleCreateSession}
                  onJoin={handleJoinSession}
                  onRoomIdChange={handleRoomIdChange}
                  onRoomIdKeyPress={handleRoomIdKeyPress}
                />
              )}
            </div>
          </div>

          <HeroPanel />
        </section>
      </main>
    </div>
  );
}
