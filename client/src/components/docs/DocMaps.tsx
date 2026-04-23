import type { ReactNode } from "react";

type Theme = "dark" | "light";

type MapProps = {
  theme: Theme;
};

type SurfaceProps = {
  theme: Theme;
  className?: string;
  title: string;
  children: ReactNode;
};

function surfaceClasses(theme: Theme) {
  return theme === "dark"
    ? "border-white/10 bg-[#0d1220] text-white"
    : "border-black/10 bg-[#f6f3eb] text-black";
}

function mutedClasses(theme: Theme) {
  return theme === "dark" ? "text-white/55" : "text-black/55";
}

function accentLine(theme: Theme) {
  return theme === "dark" ? "bg-white/18" : "bg-black/12";
}

function MapSurface({ theme, className = "", title, children }: SurfaceProps) {
  return (
    <section className={`my-6 border p-4 ${surfaceClasses(theme)} ${className}`}>
      <div className={`mb-4 text-[11px] uppercase tracking-[0.3em] ${mutedClasses(theme)}`}>{title}</div>
      {children}
    </section>
  );
}

function Node({
  theme,
  title,
  description,
}: {
  theme: Theme;
  title: string;
  description: string;
}) {
  return (
    <div className={`border px-4 py-3 ${surfaceClasses(theme)}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className={`mt-1 text-xs leading-5 ${mutedClasses(theme)}`}>{description}</div>
    </div>
  );
}

export function DocsOverviewMap({ theme }: MapProps) {
  return (
    <MapSurface theme={theme} title="Docs Map">
      <div className="grid gap-3 md:grid-cols-2">
        <Node theme={theme} title="Overview" description="Project summary, quick start, feature set, and doc entry points." />
        <Node theme={theme} title="Architecture" description="System design, backend model, security, state, and data flow." />
        <Node theme={theme} title="API Reference" description="HTTP routes, payload contracts, and integration details." />
        <Node theme={theme} title="WebSocket Protocol" description="Join, message, reconnect, and server event semantics." />
        <Node theme={theme} title="Setup Guide" description="Local installation, environment, and development workflow." />
        <Node theme={theme} title="Deployment" description="Production configuration, builds, hosting, and operational checks." />
      </div>
    </MapSurface>
  );
}

export function SystemDesignMap({ theme }: MapProps) {
  return (
    <MapSurface theme={theme} title="System Design Map">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)_32px_minmax(0,1fr)] lg:items-center">
        <Node
          theme={theme}
          title="React Client"
          description="Home, ChatView, socket hooks, reducer-driven message state, session storage."
        />
        <div className={`hidden h-px w-full lg:block ${accentLine(theme)}`} />
        <Node
          theme={theme}
          title="Realtime Server"
          description="Either Node.js or Go backend handles rooms, validation, heartbeat, reconnect, and fanout."
        />
        <div className={`hidden h-px w-full lg:block ${accentLine(theme)}`} />
        <Node
          theme={theme}
          title="Redis Storage"
          description="Encrypted message history persisted with list operations and trimmed retention."
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Node
          theme={theme}
          title="HTTP Path"
          description="Client creates rooms through POST /rooms, then navigates into the room view."
        />
        <Node
          theme={theme}
          title="WebSocket Path"
          description="Client joins, sends messages, reconnects, and receives room broadcasts over one socket."
        />
      </div>
    </MapSurface>
  );
}
