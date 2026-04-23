import type { CSSProperties, ReactNode } from "react";

type ShineBorderProps = {
  children: ReactNode;
  className?: string;
  surfaceClassName?: string;
  surfaceColor?: string;
  duration?: number;
  shineColor?: string | string[];
  borderWidth?: number;
  style?: CSSProperties;
};

function buildGradient(shineColor: string | string[]): string {
  const colors = Array.isArray(shineColor) ? shineColor : [shineColor];
  const palette = colors.length >= 3 ? colors : [...colors, ...colors, ...colors].slice(0, 3);

  return `conic-gradient(
    from 180deg,
    transparent 0deg,
    transparent 290deg,
    ${palette[0]} 312deg,
    ${palette[1]} 332deg,
    ${palette[2]} 346deg,
    transparent 360deg
  )`;
}

export function ShineBorder({
  children,
  className = "",
  surfaceClassName = "",
  surfaceColor = "#ffffff",
  duration = 14,
  shineColor = "#000000",
  borderWidth = 1,
  style,
}: ShineBorderProps) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[140%]"
        style={{
          background: buildGradient(shineColor),
          animation: `shine-border-spin ${duration}s linear infinite`,
          transformOrigin: "center",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute z-10"
        style={{
          inset: borderWidth,
          backgroundColor: surfaceColor,
        }}
      />
      <div className="relative z-20 h-full w-full" style={{ padding: borderWidth }}>
        <div className={`h-full w-full ${surfaceClassName}`}>{children}</div>
      </div>
    </div>
  );
}
