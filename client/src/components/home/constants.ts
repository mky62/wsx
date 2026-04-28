export const ALIAS_GENERATION_DELAY = 300;
export const SETTLE_ANIMATION_DURATION = 200;
export const MIN_ROOM_ID_LENGTH = 5;
export const MAX_ROOM_ID_LENGTH = 35;

export const HERO_CUBES = Array.from({ length: 30 }, (_, index) => {
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
