import { worldToScreen, type Viewport } from './viewport';

export interface AssetRenderData {
  id: string;
  title: string;
  category: string;
  maturity: string;
  healthStatus: string;
  returnFactors: string[];  // parsed from JSON
  x: number;  // world coordinates
  y: number;
  width: number;
  height: number;
}

export const MATURITY_HEIGHT: Record<string, number> = {
  nascent: 20,
  developing: 32,
  established: 48,
  foundational: 64,
  legacy: 56,
  heritage: 72,
};

const MATURITY_OPACITY: Record<string, number> = {
  nascent: 0.4,
  developing: 0.7,
  established: 1.0,
  foundational: 1.0,
  legacy: 0.8,
  heritage: 1.0,
};

const CATEGORY_COLORS: Record<string, string> = {
  code: '#00d68f',
  brand: '#a855f6',
  IP: '#6496ff',
  'digital-product': '#6496ff',
  knowledge: '#ffb347',
};

export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  asset: AssetRenderData,
  vp: Viewport,
): void {
  const [sx, sy] = worldToScreen(asset.x, asset.y, vp);
  const w = asset.width * vp.scale;
  const h = asset.height * vp.scale;
  const left = sx - w / 2;
  const top = sy - h;

  const color = CATEGORY_COLORS[asset.category] || '#6496ff';
  const opacity = MATURITY_OPACITY[asset.maturity] || 1.0;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Category-specific drawing
  switch (asset.category) {
    case 'code':
      // Rectangle with circuit-board horizontal lines
      ctx.fillStyle = color;
      ctx.fillRect(left, top, w, h);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        const ly = top + (h * i) / 5;
        ctx.beginPath();
        ctx.moveTo(left, ly);
        ctx.lineTo(left + w, ly);
        ctx.stroke();
      }
      ctx.globalAlpha = opacity;
      break;

    case 'brand':
      // Rectangle with rounded top corners
      ctx.fillStyle = color;
      ctx.beginPath();
      const r = Math.min(w * 0.3, 8 * vp.scale);
      ctx.moveTo(left, top + h);
      ctx.lineTo(left, top + r);
      ctx.arcTo(left, top, left + r, top, r);
      ctx.lineTo(left + w - r, top);
      ctx.arcTo(left + w, top, left + w, top + r, r);
      ctx.lineTo(left + w, top + h);
      ctx.closePath();
      ctx.fill();
      break;

    case 'IP':
      // Rectangle with triangular roof (shield shape)
      ctx.fillStyle = color;
      ctx.fillRect(left, top + h * 0.2, w, h * 0.8);
      ctx.beginPath();
      ctx.moveTo(left, top + h * 0.2);
      ctx.lineTo(left + w / 2, top);
      ctx.lineTo(left + w, top + h * 0.2);
      ctx.closePath();
      ctx.fill();
      break;

    case 'digital-product': {
      // Rectangle with gradient fill (lighter at top = glass)
      const grad = ctx.createLinearGradient(left, top, left, top + h);
      grad.addColorStop(0, color + 'cc');
      grad.addColorStop(1, color);
      ctx.fillStyle = grad;
      ctx.fillRect(left, top, w, h);
      break;
    }

    case 'knowledge':
      // Stacked rectangles (book stack)
      ctx.fillStyle = color;
      const layers = 3;
      const layerH = h / layers;
      for (let i = 0; i < layers; i++) {
        const gap = 1 * vp.scale;
        ctx.fillRect(left, top + i * layerH + gap, w, layerH - gap * 2);
      }
      break;

    default:
      ctx.fillStyle = color;
      ctx.fillRect(left, top, w, h);
  }

  // Heritage golden tint overlay
  if (asset.maturity === 'heritage') {
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = 'rgba(255, 179, 71, 1)';
    ctx.fillRect(left, top, w, h);
  }

  ctx.restore();

  // Draw title label below building
  ctx.save();
  ctx.font = `bold ${11 * vp.scale}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = '#8892a4';
  ctx.textAlign = 'center';
  const label = asset.title.length > 12 ? asset.title.slice(0, 12) + '...' : asset.title;
  ctx.fillText(label, sx, sy + 14 * vp.scale);
  ctx.restore();
}
