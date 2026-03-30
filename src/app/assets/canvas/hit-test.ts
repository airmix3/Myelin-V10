import type { AssetRenderData } from './buildings';
import { screenToWorld, type Viewport } from './viewport';

export function hitTest(
  screenX: number,
  screenY: number,
  assets: AssetRenderData[],
  vp: Viewport,
): string | null {
  const [wx, wy] = screenToWorld(screenX, screenY, vp);
  // Iterate in reverse (last drawn = on top = highest priority)
  for (let i = assets.length - 1; i >= 0; i--) {
    const a = assets[i];
    // Hit box: building rect from (x - width/2, y - height) to (x + width/2, y)
    // Minimum 44px touch target per UI-SPEC
    const hitW = Math.max(a.width, 44) / vp.scale;
    const hitH = Math.max(a.height, 44) / vp.scale;
    if (
      wx >= a.x - hitW / 2 &&
      wx <= a.x + hitW / 2 &&
      wy >= a.y - hitH &&
      wy <= a.y
    ) {
      return a.id;
    }
  }
  return null;
}

export function getTooltipText(asset: AssetRenderData): string {
  return `${asset.title} \u2014 ${asset.maturity}`;
}
