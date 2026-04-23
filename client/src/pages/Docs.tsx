import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, FileText, Cpu, Globe, MessageSquare, Settings, Rocket } from "lucide-react";

const docs = [
  { id: "README", title: "Overview", icon: FileText, file: "/doc/README.md" },
  { id: "ARCHITECTURE", title: "Architecture", icon: Cpu, file: "/doc/ARCHITECTURE.md" },
  { id: "API", title: "API Reference", icon: Globe, file: "/doc/API.md" },
  { id: "WEBSOCKET", title: "WebSocket Protocol", icon: MessageSquare, file: "/doc/WEBSOCKET_PROTOCOL.md" },
  { id: "SETUP", title: "Setup Guide", icon: Settings, file: "/doc/SETUP.md" },
  { id: "DEPLOYMENT", title: "Deployment", icon: Rocket, file: "/doc/DEPLOYMENT.md" },
];

export default function Docs() {
  const navigate = useNavigate();
  const [selectedDoc, setSelectedDoc] = useState(docs[0]);
  const [content, setContent] = useState("");

  useState(() => {
    fetch(selectedDoc.file)
      .then((res) => res.text())
      .then(setContent)
      .catch(console.error);
  });

  const handleDocChange = (doc: typeof docs[0]) => {
    setSelectedDoc(doc);
    fetch(doc.file)
      .then((res) => res.text())
      .then(setContent)
      .catch(console.error);
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#0a0a0a] scroll-enabled">
      <header className="border-b border-[#d6d4cc] bg-white/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm text-[#6b6b6b] hover:text-black transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Home
            </button>
            <h1 className="text-lg font-bold">Documentation</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <nav className="sticky top-8 space-y-1">
              {docs.map((doc) => {
                const Icon = doc.icon;
                const isActive = selectedDoc.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => handleDocChange(doc)}
                    className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                      isActive
                        ? "bg-black text-[#f7f6f2]"
                        : "text-[#6b6b6b] hover:bg-[#f0efe9] hover:text-black"
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{doc.title}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="lg:hidden">
            <select
              value={selectedDoc.id}
              onChange={(e) => {
                const doc = docs.find((d) => d.id === e.target.value);
                if (doc) handleDocChange(doc);
              }}
              className="w-full rounded-lg border border-[#d6d4cc] bg-[#faf9f6] px-4 py-3 text-sm"
            >
              {docs.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </main>

          <main className="prose prose-sm max-w-none lg:prose-base">
            <ReactMarkdown>{content}</ReactMarkdown>
          </main>
        </div>
      </div>
    </div>
  );
}
