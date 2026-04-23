import { MermaidDiagram } from "./MermaidDiagram";

type Theme = "dark" | "light";

type MapProps = {
  theme: Theme;
};

function shellClasses(theme: Theme) {
  return theme === "dark"
    ? "border-white/10 bg-[#0d1220] text-white"
    : "border-black/10 bg-[#f6f3eb] text-black";
}

function mutedClasses(theme: Theme) {
  return theme === "dark" ? "text-white/60" : "text-black/60";
}

function DiagramShell({
  theme,
  title,
  caption,
  chart,
}: {
  theme: Theme;
  title: string;
  caption: string;
  chart: string;
}) {
  return (
    <section className={`my-6 border p-4 ${shellClasses(theme)}`}>
      <div className={`mb-2 text-[11px] uppercase tracking-[0.3em] ${mutedClasses(theme)}`}>{title}</div>
      <p className={`mb-4 max-w-3xl text-sm leading-6 ${mutedClasses(theme)}`}>{caption}</p>
      <MermaidDiagram chart={chart} theme={theme} />
    </section>
  );
}

const docsMapChart = String.raw`
mindmap
  root((xMy Docs))
    Overview
      Quick start
      Feature summary
      Entry points
    Architecture
      Frontend structure
      Backend parity
      Security model
      Data flow
    API Reference
      HTTP routes
      Request contracts
      Response payloads
    WebSocket Protocol
      JOIN_ROOM
      SEND_MESSAGE
      LEAVE_ROOM
      Server events
      Heartbeat
    Setup Guide
      Install
      Environment
      Local workflow
      Troubleshooting
    Deployment
      Production config
      Build + hosting
      Security checklist
`;

const systemDesignChart = String.raw`
flowchart LR
    subgraph Browser["React Client"]
      Home["Home.tsx"]
      Chat["ChatView.tsx"]
      Hooks["Socket hooks + reducer"]
      Session["sessionStorage + in-memory session"]
      Home --> Chat
      Chat --> Hooks
      Hooks --> Session
    end

    Browser -->|"POST /rooms"| Http["HTTP server"]
    Browser -->|"JOIN_ROOM / SEND_MESSAGE / LEAVE_ROOM"| Ws["WebSocket server"]

    subgraph Runtime["Realtime Runtime"]
      Http --> Rooms["Room manager"]
      Ws --> Rooms
      Rooms --> Presence["Participants + disconnected users"]
      Rooms --> Router["Message router / handlers"]
      Router --> Limits["Validation + rate limiting"]
      Router --> Crypto["AES-256-GCM encryption"]
    end

    Crypto --> Redis["Redis history list"]
    Redis -->|"history replay"| Ws
    Rooms -->|"MESSAGE_CREATED / presence updates"| Ws
    Ws -->|"broadcasts"| Browser
`;

const messageFlowChart = String.raw`
flowchart TD
    A["User types message"] --> B["Client sends SEND_MESSAGE"]
    B --> C{"Joined room?"}
    C -- No --> C1["ERROR: not_joined"]
    C -- Yes --> D{"Rate limit ok?"}
    D -- No --> D1["ERROR: rate_limited"]
    D -- Yes --> E{"Text valid?"}
    E -- No --> E1["ERROR: empty / too_long"]
    E -- Yes --> F["Create canonical message object"]
    F --> G["Encrypt payload with AES-256-GCM"]
    G --> H["LPUSH encrypted message to Redis"]
    H --> I["LTRIM room history to 50"]
    I --> J["Broadcast MESSAGE_CREATED"]
    J --> K["Reducers append message in all clients"]
`;

const recoveryFlowChart = String.raw`
sequenceDiagram
    participant Client
    participant Server
    participant Room
    participant Redis

    Client->>Server: WebSocket closes unexpectedly
    Server->>Room: Mark participant disconnected
    Room->>Room: Start 30s grace timer
    Note over Room: Username stays reserved

    Client->>Server: Reconnect socket
    Client->>Server: JOIN_ROOM(participantId, reconnectToken)
    Server->>Room: Validate participant record
    Server->>Server: Timing-safe token comparison
    Server->>Room: Verify grace period still open
    Room->>Redis: Load recent history
    Redis-->>Room: Encrypted history
    Room-->>Server: Restored participant state
    Server-->>Client: JOINED(reconnected=true, history, roster)

    alt Grace expired or token invalid
      Server-->>Client: ERROR
    end
`;

export function DocsOverviewMap({ theme }: MapProps) {
  return (
    <DiagramShell
      theme={theme}
      title="Docs Map"
      caption="High-level reading map for the documentation set. This is the structural view: what each page owns and the order in which the docs make the most sense."
      chart={docsMapChart}
    />
  );
}

export function SystemDesignMap({ theme }: MapProps) {
  return (
    <DiagramShell
      theme={theme}
      title="System Design Map"
      caption="Top-level runtime topology across browser, transport, server runtime, room state, encryption, and Redis persistence."
      chart={systemDesignChart}
    />
  );
}

export function MessageFlowMap({ theme }: MapProps) {
  return (
    <DiagramShell
      theme={theme}
      title="Message Flow Map"
      caption="End-to-end send path from client action through validation, persistence, encryption, and final room broadcast."
      chart={messageFlowChart}
    />
  );
}

export function RecoveryFlowMap({ theme }: MapProps) {
  return (
    <DiagramShell
      theme={theme}
      title="Recovery Flow Map"
      caption="Reconnect lifecycle showing disconnect handling, grace-period protection, token validation, history replay, and restore behavior."
      chart={recoveryFlowChart}
    />
  );
}
