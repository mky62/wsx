import { useCallback, useEffect, useReducer, useRef, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import heroImg from "../assets/heroimgfn.jpg";
import { inMemorySession } from "../tempStorage/globalSession";


// Constants
import { USERNAME_PRESETS } from "../utils/presets";

const ALIAS_GENERATION_DELAY = 300;
const SETTLE_ANIMATION_DURATION = 200;
const MIN_ROOM_ID_LENGTH = 5;
const MAX_ROOM_ID_LENGTH = 35;

const HERO_CUBES = Array.from({ length: 30 }, (_, index) => {
  const columns = 6;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const sizePattern = [32, 40, 36, 46, 34, 42];
  const durationPattern = [12.5, 14, 13.5, 15.5, 12.8, 14.8];
  const tintPattern = [1.08, 1.18, 1.1, 1.22, 1.06, 1.16];

  return {
    left: `${6 + column * 15.5}%`,
    top: `${6 + row * 16.5}%`,
    size: sizePattern[(column + row) % sizePattern.length] + (row % 2) * 4,
    delay: `${-1.2 * index}s`,
    duration: `${durationPattern[(column + row) % durationPattern.length]}s`,
    shiftX: `${12 + column * 2}px`,
    shiftY: `${-22 - row * 5}px`,
    tilt: `${-42 + ((column % 3) - 1) * 4}deg`,
    scale: 1 + ((row + column) % 4) * 0.035,
    tint: `${tintPattern[(index + row) % tintPattern.length]}`,
  };
});

// Types
type Phase = "identity" | "session";

interface State {
  phase: Phase;
  alias: string;
  roomId: string;
  isGenerating: boolean;
  isSettling: boolean;
  error: string | null;
  isNavigating: boolean;
}

type Action =
  | { type: "GENERATE_ALIAS_START" }
  | { type: "GENERATE_ALIAS_COMPLETE"; payload: string }
  | { type: "SET_SETTLE"; payload: boolean }
  | { type: "SET_PHASE"; payload: Phase }
  | { type: "SET_ROOM_ID"; payload: string }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_NAVIGATING"; payload: boolean };

type CubeStyle = CSSProperties & Record<
  "--cube-shift-x" | "--cube-shift-y" | "--cube-tilt" | "--cube-scale" | "--cube-tint",
  string
>;

// Reducer
function homeReducer(state: State, action: Action): State {
  switch (action.type) {
    case "GENERATE_ALIAS_START":
      return { ...state, isGenerating: true, alias: "", error: null };
    case "GENERATE_ALIAS_COMPLETE":
      return { ...state, isGenerating: false, alias: action.payload };
    case "SET_SETTLE":
      return { ...state, isSettling: action.payload };
    case "SET_PHASE":
      return { ...state, phase: action.payload, error: null };
    case "SET_ROOM_ID":
      return { ...state, roomId: action.payload, error: null };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_NAVIGATING":
      return { ...state, isNavigating: action.payload };
    default:
      return state;
  }
}

// Utilities
function generateRandomAlias(): string {
  const preset = USERNAME_PRESETS[Math.floor(Math.random() * USERNAME_PRESETS.length)];
  const timestamp = Date.now().toString(36);
  const random = Math.floor(Math.random() * 100).toString(36);
  return `${preset}_${timestamp}${random}`;
}

function sanitizeRoomId(id: string): string {
  return id
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function sanitizeUsername(username: string): string {
  // Remove potentially dangerous characters but preserve readability
  return username
    .replace(/[<>"'&]/g, "")
    .trim()
    .slice(0, 25);
}

function validateRoomId(roomId: string): string | null {
  if (!roomId) {
    return "Session ID is required";
  }
  if (roomId.length < MIN_ROOM_ID_LENGTH) {
    return `Session ID must be at least ${MIN_ROOM_ID_LENGTH} characters`;
  }
  if (roomId.length > MAX_ROOM_ID_LENGTH) {
    return `Session ID cannot exceed ${MAX_ROOM_ID_LENGTH} characters`;
  }
  if (!/^[a-z0-9-]{5,35}$/.test(roomId)) {
    return "Session ID can only contain lowercase letters, numbers, and hyphens";
  }
  return null;
}

function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, "");

  const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (wsUrl) return wsUrl.replace(/^ws/, "http").replace(/\/$/, "");

  return "http://localhost:8080";
}

// Component
export default function Home() {
  const navigate = useNavigate();
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heroPanelRef = useRef<HTMLElement | null>(null);

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

  function handleHeroPointerMove(event: React.MouseEvent<HTMLElement>) {
    const panel = heroPanelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const offsetX = (x - 0.5) * 2;
    const offsetY = (y - 0.5) * 2;

    panel.style.setProperty("--hero-cursor-x", offsetX.toFixed(3));
    panel.style.setProperty("--hero-cursor-y", offsetY.toFixed(3));
    panel.style.setProperty("--hero-glow-x", `${(x * 100).toFixed(1)}%`);
    panel.style.setProperty("--hero-glow-y", `${(y * 100).toFixed(1)}%`);
  }

  function handleHeroPointerLeave() {
    const panel = heroPanelRef.current;
    if (!panel) return;

    panel.style.setProperty("--hero-cursor-x", "0");
    panel.style.setProperty("--hero-cursor-y", "0");
    panel.style.setProperty("--hero-glow-x", "50%");
    panel.style.setProperty("--hero-glow-y", "32%");
  }

  function handleRoomIdKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleJoinSession();
    }
  }

  const canContinue = state.alias && !state.isGenerating;

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
                <div className="flex h-8 items-center gap-1.5 rounded-md border border-black/15 bg-[#f0efe9] px-2">
                  <span className={`h-2 w-2 rounded-full ${state.phase === "identity" ? "bg-cyan-500" : "bg-[#d6d4cc]"}`} />
                  <span className={`h-2 w-2 rounded-full ${state.phase === "session" ? "bg-cyan-500" : "bg-[#d6d4cc]"}`} />
                </div>
                <button
                  onClick={() => navigate("/docs")}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-black/15 bg-[#f0efe9] text-[#6b6b6b] hover:border-black hover:bg-black hover:text-[#f7f6f2] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                  aria-label="View documentation"
                >
                  <FileText size={16} />
                </button>
              </div>
            </div>

            <div className="py-4 sm:py-5 md:py-6 lg:flex-1 lg:min-h-0">
              {state.error && (
                <div
                  role="alert"
                  className="mb-4 px-3 py-2 border border-red-600 bg-red-50 text-red-800 text-sm"
                >
                  {state.error}
                </div>
              )}

              {state.phase === "identity" && (
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
                        onClick={handleGenerateAlias}
                        className="shrink-0 underline hover:text-black focus:outline-none focus:text-black"
                        disabled={state.isGenerating}
                        aria-label="Regenerate identity alias"
                      >
                        regenerate
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleContinueToSession}
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
              )}

              {state.phase === "session" && (
                <div className="grid gap-6 font-mono lg:h-full lg:content-center lg:gap-8">
                  {/* Identity Badge */}
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-black/10 via-transparent to-black/10 blur-sm opacity-50"></div>
                    <div className="relative flex flex-col items-start gap-4 rounded-xl border-2 border-black bg-[#faf9f6] p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">your identity</div>
                        <div className="mt-1 break-all text-base tracking-tight text-black sm:text-lg">
                          {inMemorySession.username}
                        </div>
                      </div>
                      <button
                        onClick={handleBackToIdentity}
                        disabled={state.isNavigating}
                        className="w-full shrink-0 rounded-lg border border-[#d6d4cc] bg-[#f0efe9] px-3 py-2 text-xs uppercase tracking-wide text-[#6b6b6b] hover:border-black hover:bg-black hover:text-[#f7f6f2] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-40 transition-all sm:w-auto sm:py-1.5"
                        aria-label="Regenerate identity"
                      >
                        change
                      </button>
                    </div>
                  </div>

                  {/* Action Cards */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Create Room Card */}
                    <button
                      onClick={handleCreateSession}
                      disabled={state.isNavigating}
                      className="group relative overflow-hidden rounded-2xl border-2 border-black bg-black p-5 text-left transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-40 disabled:hover:scale-100 sm:p-6"
                      aria-label="Create new chat room"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                      <div className="relative">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f7f6f2]">
                          <svg className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <div className="text-xl text-[#f7f6f2] sm:text-2xl">create room</div>
                        <div className="mt-1 text-sm text-[#f7f6f2]/70">
                          Start a new anonymous chat
                        </div>
                      </div>
                    </button>

                    {/* Join Room Card */}
                    <div className="flex flex-col gap-3 rounded-2xl border-2 border-[#d6d4cc] bg-[#faf9f6] p-5 sm:p-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f0efe9]">
                          <svg className="h-6 w-6 text-[#6b6b6b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="text-lg text-black">join room</div>
                          <div className="text-xs text-[#6b6b6b]">Enter an existing room ID</div>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="room-id-input" className="sr-only">
                          Room ID
                        </label>
                        <input
                          id="room-id-input"
                          type="text"
                          value={state.roomId}
                          onChange={(e) => handleRoomIdChange(e.target.value)}
                          onKeyDown={handleRoomIdKeyPress}
                          placeholder="room id"
                          disabled={state.isNavigating}
                          className="
                            w-full rounded-lg border border-[#d6d4cc] bg-[#f0efe9] px-4 py-3
                            text-sm font-mono
                            focus:outline-none focus:ring-2 focus:ring-black focus:border-black
                            disabled:opacity-40
                            transition-all
                            transition-all
                          "
                          aria-describedby="room-id-help"
                          maxLength={MAX_ROOM_ID_LENGTH}
                        />
                        <button
                          onClick={handleJoinSession}
                          disabled={state.isNavigating || !state.roomId.trim()}
                          className="w-full rounded-lg border-2 border-black bg-black px-4 py-3 uppercase tracking-wide text-[#f7f6f2] hover:bg-[#f7f6f2] hover:text-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          aria-label="Join existing room"
                        >
                          {state.isNavigating ? "joining..." : "enter room"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div id="room-id-help" className="sr-only">
                    Enter the room ID to join an existing chat room
                  </div>
                  <div className="hidden rounded-xl border border-black/10 bg-black/[0.035] p-4 text-sm sm:block lg:hidden">
                    <div className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">
                      system notice
                    </div>
                    <p className="mt-2 text-base text-black">
                      Recent messages stay encrypted for reloads and short connection breaks.
                    </p>
                    <p className="mt-2 text-sm text-black/65">
                      Rooms disappear after everyone leaves or reconnect grace ends.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside
            ref={heroPanelRef}
            className="relative hidden overflow-hidden border-l border-[#d6d4cc] lg:block"
            onMouseMove={handleHeroPointerMove}
            onMouseLeave={handleHeroPointerLeave}
          >
            <img
              src={heroImg}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-80"
              role="presentation"
            />
            <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
            <div
              aria-hidden="true"
              className="absolute inset-x-6 top-6 bottom-[34%] z-10 overflow-hidden"
            >
              <div className="home-cubes-scene">
                <div className="home-cubes-grid" />
                <div className="home-cubes-glow" />
                {HERO_CUBES.map((cube, index) => (
                  (() => {
                    const cubeStyle: CubeStyle = {
                      left: cube.left,
                      top: cube.top,
                      width: `${cube.size}px`,
                      height: `${cube.size}px`,
                      animationDelay: cube.delay,
                      animationDuration: cube.duration,
                      "--cube-shift-x": cube.shiftX,
                      "--cube-shift-y": cube.shiftY,
                      "--cube-tilt": cube.tilt,
                      "--cube-scale": `${cube.scale}`,
                      "--cube-tint": cube.tint,
                    };

                    return (
                  <div
                    key={`${cube.left}-${cube.top}-${index}`}
                    className="home-cube"
                    style={cubeStyle}
                  >
                    <span className="home-cube-face home-cube-face--front" />
                    <span className="home-cube-face home-cube-face--top" />
                    <span className="home-cube-face home-cube-face--side" />
                  </div>
                    );
                  })()
                ))}
              </div>
            </div>
            <div className="relative z-10 flex h-full flex-col justify-end p-6 text-white">
              <div className="mb-4 text-[10px] uppercase tracking-wide text-white/70">
                system notice
              </div>
              <p className="max-w-sm text-xl">
                Recent messages stay encrypted for reloads and connection breaks.
              </p>
              <p className="mt-3 max-w-sm text-sm text-white/70">
                Rooms disappear after everyone leaves or reconnect grace ends.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
