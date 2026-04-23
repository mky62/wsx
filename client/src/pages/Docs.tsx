import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { ArrowLeft } from "lucide-react";
import { DocsOverviewMap, MessageFlowMap, RecoveryFlowMap, SystemDesignMap } from "../components/docs/DocMaps";
import { ShineBorder } from "../components/ui/ShineBorder";

const docs = [
  { id: "README", title: "Overview", file: "/doc/README.md", kind: "doc" },
  { id: "ARCHITECTURE", title: "Architecture", file: "/doc/ARCHITECTURE.md", kind: "doc" },
  { id: "API", title: "API Reference", file: "/doc/API.md", kind: "doc" },
  { id: "WEBSOCKET", title: "WebSocket Protocol", file: "/doc/WEBSOCKET_PROTOCOL.md", kind: "doc" },
  { id: "SETUP", title: "Setup Guide", file: "/doc/SETUP.md", kind: "doc" },
  { id: "DEPLOYMENT", title: "Deployment", file: "/doc/DEPLOYMENT.md", kind: "doc" },
] as const;

type DocEntry = (typeof docs)[number];
const maps = [
  {
    id: "DOCS_MAP",
    title: "Docs Map",
    description: "High-level map of the documentation set and what each page covers.",
    kind: "map",
  },
  {
    id: "SYSTEM_DESIGN_MAP",
    title: "System Design Map",
    description: "Visual breakdown of client, server, storage, and request flow.",
    kind: "map",
  },
  {
    id: "MESSAGE_FLOW_MAP",
    title: "Message Flow Map",
    description: "Detailed path from message composition to validation, encryption, storage, and broadcast.",
    kind: "map",
  },
  {
    id: "RECOVERY_FLOW_MAP",
    title: "Recovery Flow Map",
    description: "Disconnect, grace period, reconnect token checks, and session restoration lifecycle.",
    kind: "map",
  },
] as const;

type MapEntry = (typeof maps)[number];
type NavEntry = DocEntry | MapEntry;
const navEntries = [...docs, ...maps] as const;

type Theme = "dark" | "light";

function resolveDocFromHref(href?: string | null): DocEntry | null {
  if (!href) return null;

  const normalized = href
    .trim()
    .replace(/^[.][/]/, "")
    .replace(/^\/+/, "")
    .split("#")[0]
    .split("?")[0];

  const match = docs.find((doc) => {
    const file = doc.file.replace(/^\//, "");
    const basename = file.split("/").pop();
    return normalized === file || normalized.endsWith(file) || (basename ? normalized.endsWith(basename) : false);
  });

  return match ?? null;
}

function Markdown({
  content,
  theme,
  onInternalDocLink,
}: {
  content: string;
  theme: Theme;
  onInternalDocLink: (doc: DocEntry) => void;
}) {
  const dark = theme === "dark";
  const components: Components = {
    h1: ({ children, ...props }) => (
      <h1 className={`mt-0 mb-4 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? "text-white" : "text-black"}`} {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className={`mt-8 mb-2 text-2xl font-semibold tracking-tight ${dark ? "text-white" : "text-black"}`} {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className={`mt-6 mb-2 text-xl font-semibold tracking-tight ${dark ? "text-white" : "text-black"}`} {...props}>
        {children}
      </h3>
    ),
    p: ({ children, ...props }) => (
      <p className={`my-4 leading-7 ${dark ? "text-white/80" : "text-black/80"}`} {...props}>
        {children}
      </p>
    ),
    ul: ({ children, ...props }) => (
      <ul className={`my-4 list-disc space-y-2 pl-6 ${dark ? "text-white/80" : "text-black/80"}`} {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className={`my-4 list-decimal space-y-2 pl-6 ${dark ? "text-white/80" : "text-black/80"}`} {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="leading-7" {...props}>
        {children}
      </li>
    ),
    a: ({ children, ...props }) => (
      (() => {
        const href = typeof props.href === "string" ? props.href : undefined;
        const linkedDoc = resolveDocFromHref(href);

        if (linkedDoc) {
          return (
            <button
              type="button"
              className={`cursor-pointer bg-transparent p-0 text-left underline underline-offset-4 ${dark ? "text-white" : "text-black"}`}
              onClick={() => onInternalDocLink(linkedDoc)}
            >
              {children}
            </button>
          );
        }

        return (
          <a className={`underline underline-offset-4 ${dark ? "text-white" : "text-black"}`} {...props}>
            {children}
          </a>
        );
      })()
    ),
    code: ({ children, className, ...props }) => {
      if (!className) {
        return (
          <code
            className={`rounded px-1 py-0.5 font-mono text-[0.95em] ${dark ? "bg-white/10 text-white" : "bg-black/10 text-black"}`}
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children, ...props }) => (
      <pre
        className={`my-6 overflow-x-auto border p-4 text-sm ${dark ? "border-white/10 bg-[#0b1020] text-white" : "border-black/10 bg-[#f4f4f4] text-black"}`}
        {...props}
      >
        {children}
      </pre>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote className={`my-6 border-l-2 pl-4 ${dark ? "border-white/15 text-white/70" : "border-black/15 text-black/70"}`} {...props}>
        {children}
      </blockquote>
    ),
    hr: (props) => <hr className={`my-8 ${dark ? "border-white/10" : "border-black/10"}`} {...props} />,
    table: ({ children, ...props }) => (
      <div className="my-6 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th className={`border-b px-3 py-2 font-semibold ${dark ? "border-white/10 text-white" : "border-black/10 text-black"}`} {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className={`border-b px-3 py-2 align-top ${dark ? "border-white/10 text-white/75" : "border-black/10 text-black/75"}`} {...props}>
        {children}
      </td>
    ),
  };

  return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
}

function MapPage({ entry, theme }: { entry: MapEntry; theme: Theme }) {
  const dark = theme === "dark";

  return (
    <div className="mt-2">
      <h1 className={`mt-0 mb-4 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? "text-white" : "text-black"}`}>{entry.title}</h1>
      <p className={`my-4 max-w-2xl leading-7 ${dark ? "text-white/75" : "text-black/75"}`}>{entry.description}</p>
      {entry.id === "DOCS_MAP" && <DocsOverviewMap theme={theme} />}
      {entry.id === "SYSTEM_DESIGN_MAP" && <SystemDesignMap theme={theme} />}
      {entry.id === "MESSAGE_FLOW_MAP" && <MessageFlowMap theme={theme} />}
      {entry.id === "RECOVERY_FLOW_MAP" && <RecoveryFlowMap theme={theme} />}
    </div>
  );
}

export default function Docs() {
  const navigate = useNavigate();
  const [selectedEntry, setSelectedEntry] = useState<NavEntry>(docs[0]);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = window.localStorage.getItem("docs-theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const dark = theme === "dark";

  useEffect(() => {
    window.localStorage.setItem("docs-theme", theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (selectedEntry.kind !== "doc") {
      setContent("");
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    fetch(selectedEntry.file)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load ${selectedEntry.title}`);
        }
        return res.text();
      })
      .then((text) => {
        if (active) setContent(text);
      })
      .catch((err: unknown) => {
        if (active) {
          setContent("");
          setError(err instanceof Error ? err.message : "Failed to load documentation");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedEntry]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [selectedEntry]);

  return (
    <div className={dark ? "min-h-screen bg-[#070b14] text-white" : "min-h-screen bg-white text-black"}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:h-dvh lg:overflow-hidden lg:px-8 lg:py-8">
        <div className={`flex items-center justify-between gap-4 pb-4 ${dark ? "text-white/60" : "text-black/60"}`}>
          <button
            onClick={() => navigate("/")}
            className={`inline-flex items-center gap-2 text-sm ${dark ? "hover:text-white" : "hover:text-black"}`}
          >
            <ArrowLeft size={16} />
            Home
          </button>
          <div className="flex items-center gap-3">
            <div className="text-xs uppercase tracking-[0.3em]">Docs</div>
            <button
              type="button"
              onClick={() => setTheme(dark ? "light" : "dark")}
              className={`text-xs uppercase tracking-[0.25em] ${dark ? "hover:text-white" : "hover:text-black"}`}
              aria-label="Toggle theme"
            >
              {dark ? "Light" : "Dark"}
            </button>
          </div>
          <div className="w-12" />
        </div>

        <div className="grid flex-1 gap-6 lg:min-h-0 lg:grid-cols-[220px_minmax(0,1fr)]">
          <ShineBorder
            className="h-full lg:min-h-0"
            surfaceClassName="h-full overflow-hidden scrollbar-hide p-4 lg:overflow-y-auto"
            surfaceColor={dark ? "#171a24" : "#f7f7f5"}
            duration={14}
            shineColor={dark ? ["#A07CFE", "#FE8FB5", "#FFBE7B"] : ["#111111", "#666666", "#111111"]}
          >
            <label className={`mb-2 block text-xs uppercase tracking-[0.28em] ${dark ? "text-white/45" : "text-black/45"} lg:hidden`}>
              Index
            </label>
            <select
              value={selectedEntry.id}
              onChange={(e) => {
                const entry = navEntries.find((item) => item.id === e.target.value);
                if (entry) setSelectedEntry(entry);
              }}
              className={`mb-4 w-full border px-3 py-2 text-sm lg:hidden ${
                dark ? "border-white/10 bg-[#0b1020] text-white" : "border-black/10 bg-white text-black"
              }`}
            >
              <optgroup label="Docs">
                {docs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Maps">
                {maps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.title}
                  </option>
                ))}
              </optgroup>
            </select>

            <nav className="hidden lg:block">
              <div className={`mb-2 text-xs uppercase tracking-[0.28em] ${dark ? "text-white/45" : "text-black/45"}`}>
                Index
              </div>
              <div className={`mb-2 text-[11px] uppercase tracking-[0.24em] ${dark ? "text-white/30" : "text-black/30"}`}>
                Docs
              </div>
              <div className="space-y-1">
                {docs.map((doc) => {
                  const active = selectedEntry.id === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedEntry(doc)}
                      className={`block w-full px-0 py-1 text-left text-sm transition ${
                        active
                          ? dark
                            ? "font-semibold text-white"
                            : "font-semibold text-black"
                          : dark
                            ? "text-white/55 hover:text-white"
                            : "text-black/55 hover:text-black"
                      }`}
                    >
                      {doc.title}
                    </button>
                  );
                })}
              </div>
              <div className={`mt-5 mb-2 text-[11px] uppercase tracking-[0.24em] ${dark ? "text-white/30" : "text-black/30"}`}>
                Maps
              </div>
              <div className="space-y-1">
                {maps.map((map) => {
                  const active = selectedEntry.id === map.id;
                  return (
                    <button
                      key={map.id}
                      onClick={() => setSelectedEntry(map)}
                      className={`block w-full px-0 py-1 text-left text-sm transition ${
                        active
                          ? dark
                            ? "font-semibold text-white"
                            : "font-semibold text-black"
                          : dark
                            ? "text-white/55 hover:text-white"
                            : "text-black/55 hover:text-black"
                      }`}
                    >
                      {map.title}
                    </button>
                  );
                })}
              </div>
            </nav>
          </ShineBorder>

          <main
            ref={mainRef}
            className={`scrollbar-hide border p-4 min-w-0 lg:min-h-0 lg:overflow-y-auto ${dark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/[0.03]"}`}
          >
            <article className="max-w-4xl">
              {error && (
                <div className={`mt-4 text-sm ${dark ? "text-red-300" : "text-red-700"}`}>
                  {error}
                </div>
              )}

              {selectedEntry.kind === "map" ? (
                <MapPage entry={selectedEntry} theme={theme} />
              ) : isLoading ? (
                <div className="mt-6 space-y-3">
                  <div className={`h-8 w-1/2 animate-pulse ${dark ? "bg-white/10" : "bg-black/10"}`} />
                  <div className={`h-4 w-full animate-pulse ${dark ? "bg-white/10" : "bg-black/10"}`} />
                  <div className={`h-4 w-11/12 animate-pulse ${dark ? "bg-white/10" : "bg-black/10"}`} />
                  <div className={`h-44 w-full animate-pulse ${dark ? "bg-white/10" : "bg-black/10"}`} />
                </div>
              ) : (
                <div className={`mt-2 max-w-none prose prose-headings:scroll-mt-24 prose-p:my-4 prose-li:my-1 prose-pre:my-6 prose-table:my-6 ${dark ? "prose-invert" : "prose-slate"}`}>
                  <Markdown
                    content={content}
                    theme={theme}
                    onInternalDocLink={setSelectedEntry}
                  />
                </div>
              )}
            </article>
          </main>
        </div>
      </div>
    </div>
  );
}
