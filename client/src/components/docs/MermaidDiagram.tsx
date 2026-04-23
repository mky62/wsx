import { useEffect, useId, useRef, useState } from "react";

type Theme = "dark" | "light";

type MermaidDiagramProps = {
  chart: string;
  theme: Theme;
};

function getMermaidTheme(theme: Theme) {
  if (theme === "dark") {
    return {
      background: "#0d1220",
      primaryColor: "#171a24",
      primaryTextColor: "#f5f7fb",
      primaryBorderColor: "#3a4154",
      lineColor: "#8b93a7",
      secondaryColor: "#111827",
      tertiaryColor: "#0b1020",
      clusterBkg: "#111827",
      clusterBorder: "#3a4154",
      nodeBorder: "#3a4154",
      mainBkg: "#171a24",
      edgeLabelBackground: "#0d1220",
      fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif",
    };
  }

  return {
    background: "#f6f3eb",
    primaryColor: "#fcfbf7",
    primaryTextColor: "#111111",
    primaryBorderColor: "#c9c4b8",
    lineColor: "#6b665d",
    secondaryColor: "#f2eee5",
    tertiaryColor: "#ebe4d6",
    clusterBkg: "#f8f4ec",
    clusterBorder: "#c9c4b8",
    nodeBorder: "#c9c4b8",
    mainBkg: "#fcfbf7",
    edgeLabelBackground: "#f6f3eb",
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif",
  };
}

export function MermaidDiagram({ chart, theme }: MermaidDiagramProps) {
  const elementId = useId().replace(/:/g, "-");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    import("mermaid")
      .then(({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "loose",
          themeVariables: getMermaidTheme(theme),
        });

        return mermaid.render(`mermaid-${elementId}`, chart);
      })
      .then(({ svg, bindFunctions }) => {
        if (!active || !containerRef.current) return;

        containerRef.current.innerHTML = svg;
        bindFunctions?.(containerRef.current);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to render diagram");
      });

    return () => {
      active = false;
    };
  }, [chart, elementId, theme]);

  if (error) {
    return (
      <pre className={`overflow-x-auto border p-4 text-sm ${theme === "dark" ? "border-white/10 bg-[#0b1020] text-white" : "border-black/10 bg-[#f4f4f4] text-black"}`}>
        {chart}
      </pre>
    );
  }

  return <div ref={containerRef} className="mermaid-diagram overflow-x-auto" />;
}
