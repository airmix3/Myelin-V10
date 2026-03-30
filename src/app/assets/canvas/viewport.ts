export interface Viewport {
  offsetX: number;  // world X at left edge of screen
  offsetY: number;  // world Y at top edge of screen
  scale: number;    // pixels per world unit
}

export const DEFAULT_VIEWPORT: Viewport = { offsetX: -200, offsetY: -200, scale: 1.0 };
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3.0;

export function worldToScreen(wx: number, wy: number, vp: Viewport): [number, number] {
  return [(wx - vp.offsetX) * vp.scale, (wy - vp.offsetY) * vp.scale];
}

export function screenToWorld(sx: number, sy: number, vp: Viewport): [number, number] {
  return [sx / vp.scale + vp.offsetX, sy / vp.scale + vp.offsetY];
}

/** Zoom centered on a screen point */
export function zoomAt(vp: Viewport, screenX: number, screenY: number, delta: number): Viewport {
  const factor = delta > 0 ? 0.9 : 1.1;
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, vp.scale * factor));
  const [wx, wy] = screenToWorld(screenX, screenY, vp);
  return {
    scale: newScale,
    offsetX: wx - screenX / newScale,
    offsetY: wy - screenY / newScale,
  };
}
