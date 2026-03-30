export const RETURN_FACTOR_COLORS: Record<string, string> = {
  revenue: '#ffb347',
  moat: '#6496ff',
  core_tech: '#00d68f',
  brand_equity: '#a855f6',
};

export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  colors: string[],
  intensity: number,
): void {
  if (colors.length === 0) return;

  ctx.save();

  // Primary glow from first color
  const primary = colors[0];
  ctx.shadowBlur = 15 * intensity;
  ctx.shadowColor = primary;
  ctx.fillStyle = primary + '30'; // ~19% opacity
  ctx.fillRect(x - width / 2, y - height, width, height);

  // Additional glow layers for secondary colors
  ctx.shadowBlur = 0;
  for (let i = 1; i < colors.length; i++) {
    const c = colors[i];
    const layerIntensity = intensity * 0.5;
    ctx.fillStyle = c + '20'; // ~12% opacity
    const inset = i * 2;
    ctx.fillRect(
      x - width / 2 + inset,
      y - height + inset,
      width - inset * 2,
      height - inset * 2,
    );
    // Small glow dot at top
    ctx.beginPath();
    ctx.arc(x, y - height, 3 * layerIntensity, 0, Math.PI * 2);
    ctx.fillStyle = c + '60';
    ctx.fill();
  }

  ctx.restore();
}

export function drawDegradation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  healthStatus: string,
): void {
  if (healthStatus === 'healthy') return;

  const left = x - width / 2;
  const top = y - height;

  ctx.save();

  switch (healthStatus) {
    case 'stale':
      // Desaturation overlay
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(left, top, width, height);
      break;

    case 'degraded': {
      // Crack lines on the building
      ctx.strokeStyle = '#0a0a1a';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      // Deterministic "random" cracks based on position
      const seed = Math.abs(x * 7 + y * 13) % 100;
      for (let i = 0; i < 4; i++) {
        const startFrac = ((seed + i * 23) % 100) / 100;
        const endFrac = ((seed + i * 37) % 100) / 100;
        ctx.beginPath();
        ctx.moveTo(left + width * startFrac, top + height * (i / 4));
        ctx.lineTo(left + width * endFrac, top + height * ((i + 1) / 4));
        ctx.stroke();
      }
      break;
    }

    case 'critical':
      // Red-tinted overlay, pulsing opacity
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = 'rgba(233, 69, 96, 1)';
      ctx.fillRect(left, top, width, height);
      break;
  }

  ctx.restore();
}

export function drawActivityParticles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  time: number,
  color: string,
): void {
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = color;

  for (let i = 0; i < 4; i++) {
    const cycle = 3; // seconds per full cycle
    const phase = (i / 4) * cycle;
    const t = ((time + phase) % cycle) / cycle; // 0 to 1
    const px = x + (i - 1.5) * 4;
    const py = y - height - t * 20;
    const alpha = 1 - t; // fade out as they rise

    ctx.globalAlpha = alpha * 0.6;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
