// Pure geometry for the draggable/resizable agent dock, kept out of the
// component so the clamping rules can be unit-tested without pointer physics.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Bounds {
  width: number;
  height: number;
}

export const DOCK_MIN = { w: 300, h: 220 };
const MARGIN = 24;

/** Keep a rect within bounds and no smaller than the minimum size. */
export function clampRect(rect: Rect, bounds: Bounds, min = DOCK_MIN): Rect {
  const w = Math.min(Math.max(rect.w, min.w), Math.max(min.w, bounds.width));
  const h = Math.min(Math.max(rect.h, min.h), Math.max(min.h, bounds.height));
  const x = Math.min(Math.max(rect.x, 0), Math.max(0, bounds.width - w));
  const y = Math.min(Math.max(rect.y, 0), Math.max(0, bounds.height - h));
  return { x, y, w, h };
}

/** First-open placement: anchored near the bottom-right of the bounds. */
export function defaultRect(bounds: Bounds): Rect {
  const w = 384;
  const h = 460;
  return clampRect({ x: bounds.width - w - MARGIN, y: bounds.height - h - MARGIN, w, h }, bounds);
}
