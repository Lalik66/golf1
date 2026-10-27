// Shared gameplay constants (used by the game and by the automated solver).
export const MAX_SPEED = 16;
export const MIN_SPEED = 0.9;
export const STROKE_CAP = 10;

export function powerToSpeed(p) {
  const k = p < 0 ? 0 : p > 1 ? 1 : p;
  return MIN_SPEED + Math.pow(k, 1.2) * (MAX_SPEED - MIN_SPEED);
}
