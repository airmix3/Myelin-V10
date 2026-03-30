import { worldToScreen, type Viewport } from './viewport';
import type { AssetRenderData } from './buildings';

export const DISTRICT_CENTERS: Record<string, { x: number; y: number; label: string }> = {
  'code': { x: 150, y: 300, label: 'Tech District' },
  'brand': { x: 550, y: 100, label: 'Media District' },
  'IP': { x: 550, y: 450, label: 'IP District' },
  'digital-product': { x: 350, y: 80, label: 'Product District' },
  'knowledge': { x: 150, y: 500, label: 'Knowledge District' },
};

export function getDistrictCenter(category: string): { x: number; y: number } {
  const dc = DISTRICT_CENTERS[category];
  return dc ? { x: dc.x, y: dc.y } : { x: 350, y: 300 };
}

/**
 * Deterministic position from assetId hash.
 * Hash the assetId string to get a consistent offset from district center
 * (range: -80 to +80 on both axes).
 */
export function assignPosition(
  assetId: string,
  category: string,
): { x: number; y: number } {
  const center = getDistrictCenter(category);

  // Simple string hash for deterministic positioning
  let hash = 0;
  for (let i = 0; i < assetId.length; i++) {
    hash = ((hash << 5) - hash + assetId.charCodeAt(i)) | 0;
  }

  // Use different bits for x and y offsets
  const offsetX = ((hash & 0xff) / 255) * 160 - 80;
  const offsetY = (((hash >> 8) & 0xff) / 255) * 160 - 80;

  return {
    x: center.x + offsetX,
    y: center.y + offsetY,
  };
}

export function drawDistrictLabel(
  ctx: CanvasRenderingContext2D,
  category: string,
  vp: Viewport,
): void {
  const dc = DISTRICT_CENTERS[category];
  if (!dc) return;

  const [sx, sy] = worldToScreen(dc.x, dc.y - 100, vp);

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.font = `bold ${11 * vp.scale}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = '#8892a4';
  ctx.textAlign = 'center';
  ctx.fillText(dc.label, sx, sy);
  ctx.restore();
}

export function drawDistrictBoundary(
  ctx: CanvasRenderingContext2D,
  category: string,
  vp: Viewport,
  assets: AssetRenderData[],
): void {
  const dc = DISTRICT_CENTERS[category];
  if (!dc) return;

  const count = assets.filter(a => a.category === category).length;
  if (count === 0) return;

  const radius = Math.max(100, 80 + count * 15) * vp.scale;
  const [sx, sy] = worldToScreen(dc.x, dc.y, vp);

  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.ellipse(sx, sy, radius, radius * 0.8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
