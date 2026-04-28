import { useRef } from "react";
import heroImg from "../../assets/heroimgfn.jpg";
import { HERO_CUBES } from "./constants";
import { SystemNotice } from "./SystemNotice";
import type { CubeStyle } from "./types";

export function HeroPanel() {
  const heroPanelRef = useRef<HTMLElement | null>(null);

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

  return (
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
          {HERO_CUBES.map((cube, index) => {
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
          })}
        </div>
      </div>
      <SystemNotice variant="default" />
    </aside>
  );
}
