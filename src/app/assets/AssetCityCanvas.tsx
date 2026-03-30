'use client';

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  DEFAULT_VIEWPORT,
  worldToScreen,
  zoomAt,
  type Viewport,
} from './canvas/viewport';
import { drawBuilding, MATURITY_HEIGHT, type AssetRenderData } from './canvas/buildings';
import {
  assignPosition,
  DISTRICT_CENTERS,
  drawDistrictBoundary,
  drawDistrictLabel,
} from './canvas/districts';
import {
  drawGlow,
  drawDegradation,
  drawActivityParticles,
  RETURN_FACTOR_COLORS,
} from './canvas/effects';
import { hitTest, getTooltipText } from './canvas/hit-test';

interface Asset {
  id: string;
  title: string;
  description: string | null;
  category: string;
  maturity: string;
  stewardId: string | null;
  returnFactors: string | null;
  healthStatus: string;
  directoryPath: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssetCityCanvasProps {
  assets: Asset[];
  selectedAssetId: string | null;
  onAssetSelect: (id: string | null) => void;
}

export interface CanvasControls {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
}

function parseReturnFactors(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getReturnFactorColors(factors: string[]): string[] {
  return factors
    .map((f) => RETURN_FACTOR_COLORS[f])
    .filter((c): c is string => !!c);
}

const AssetCityCanvas = forwardRef<CanvasControls, AssetCityCanvasProps>(function AssetCityCanvas({
  assets,
  selectedAssetId,
  onAssetSelect,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vpRef = useRef<Viewport>({ ...DEFAULT_VIEWPORT });
  const assetsRef = useRef<AssetRenderData[]>([]);
  const animRef = useRef<number>(0);
  const hoveredRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragTotalRef = useRef(0);
  const timeRef = useRef(0);
  const dirtyRef = useRef(true);
  const frameCountRef = useRef(0);
  const mouseScreenRef = useRef<{ x: number; y: number } | null>(null);

  // Smooth pan target for double-click
  const panTargetRef = useRef<{ x: number; y: number; scale: number } | null>(null);

  // Expose zoom controls to parent via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      vpRef.current = { ...vpRef.current, scale: Math.min(3.0, vpRef.current.scale * 1.2) };
      dirtyRef.current = true;
    },
    zoomOut: () => {
      vpRef.current = { ...vpRef.current, scale: Math.max(0.5, vpRef.current.scale * 0.8) };
      dirtyRef.current = true;
    },
    zoomReset: () => {
      vpRef.current = { ...DEFAULT_VIEWPORT };
      dirtyRef.current = true;
    },
  }));

  // Data preparation: convert assets to render data
  useEffect(() => {
    assetsRef.current = assets.map((asset) => {
      const pos = assignPosition(asset.id, asset.category);
      const h = MATURITY_HEIGHT[asset.maturity] || 32;
      return {
        id: asset.id,
        title: asset.title,
        category: asset.category,
        maturity: asset.maturity,
        healthStatus: asset.healthStatus,
        returnFactors: parseReturnFactors(asset.returnFactors),
        x: pos.x,
        y: pos.y,
        width: 30,
        height: h,
      };
    });
    dirtyRef.current = true;
  }, [assets]);

  // Mark dirty when selection changes
  useEffect(() => {
    dirtyRef.current = true;
  }, [selectedAssetId]);

  // Animation loop + resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize handler
    const parent = canvas.parentElement;
    function resize() {
      if (!canvas || !parent) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirtyRef.current = true;
    }
    resize();

    const ro = new ResizeObserver(() => resize());
    if (parent) ro.observe(parent);

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.getBoundingClientRect().width;
      const H = canvas.getBoundingClientRect().height;
      const vp = vpRef.current;
      const renderAssets = assetsRef.current;

      // Clear
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, W, H);

      // Draw district boundaries and labels
      const categories = Object.keys(DISTRICT_CENTERS);
      for (const cat of categories) {
        drawDistrictBoundary(ctx, cat, vp, renderAssets);
        drawDistrictLabel(ctx, cat, vp);
      }

      // Draw buildings with effects
      for (const asset of renderAssets) {
        const factors = getReturnFactorColors(asset.returnFactors);
        const [sx, sy] = worldToScreen(asset.x, asset.y, vp);
        const sw = asset.width * vp.scale;
        const sh = asset.height * vp.scale;

        // Glow (behind building)
        if (factors.length > 0) {
          const isFundational = asset.maturity === 'foundational';
          const glowIntensity = isFundational
            ? 0.7 + 0.3 * Math.sin(timeRef.current * 2)
            : 0.8;
          drawGlow(ctx, sx, sy, sw, sh, factors, glowIntensity);
        }

        // Building
        drawBuilding(ctx, asset, vp);

        // Health degradation
        if (asset.healthStatus !== 'healthy') {
          drawDegradation(ctx, sx, sy, sw, sh, asset.healthStatus);
        }

        // Activity particles (simplified: show for all assets as ambient effect)
        if (factors.length > 0 && asset.healthStatus === 'healthy') {
          drawActivityParticles(ctx, sx, sy, sh, timeRef.current, factors[0]);
        }
      }

      // Selection highlight
      if (selectedAssetId) {
        const selected = renderAssets.find((a) => a.id === selectedAssetId);
        if (selected) {
          const [sx, sy] = worldToScreen(selected.x, selected.y, vp);
          const sw = selected.width * vp.scale;
          const sh = selected.height * vp.scale;
          ctx.save();
          ctx.strokeStyle = '#e94560';
          ctx.lineWidth = 2;
          ctx.strokeRect(sx - sw / 2 - 3, sy - sh - 3, sw + 6, sh + 6);
          ctx.restore();
        }
      }

      // Hover highlight (if different from selection)
      if (hoveredRef.current && hoveredRef.current !== selectedAssetId) {
        const hovered = renderAssets.find((a) => a.id === hoveredRef.current);
        if (hovered) {
          const [sx, sy] = worldToScreen(hovered.x, hovered.y, vp);
          const sw = hovered.width * vp.scale;
          const sh = hovered.height * vp.scale;
          ctx.save();
          ctx.strokeStyle = '#e9456080';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx - sw / 2 - 3, sy - sh - 3, sw + 6, sh + 6);
          ctx.restore();
        }
      }

      // Tooltip
      if (hoveredRef.current && mouseScreenRef.current) {
        const hovered = renderAssets.find((a) => a.id === hoveredRef.current);
        if (hovered) {
          const text = getTooltipText(hovered);
          const [bsx, bsy] = worldToScreen(hovered.x, hovered.y, vp);
          const tooltipX = bsx;
          const tooltipY = bsy - hovered.height * vp.scale - 12;

          ctx.save();
          ctx.font = `11px 'JetBrains Mono', monospace`;
          const tm = ctx.measureText(text);
          const padX = 8;
          const padY = 4;
          const tw = tm.width + padX * 2;
          const th = 18 + padY;

          ctx.fillStyle = '#16213e';
          ctx.strokeStyle = '#2a2a4a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tooltipX - tw / 2, tooltipY - th, tw, th, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#e0e0e0';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, tooltipX, tooltipY - th / 2);
          ctx.restore();
        }
      }
    }

    function animate() {
      timeRef.current += 0.016;
      frameCountRef.current++;

      // Smooth pan animation
      if (panTargetRef.current) {
        const vp = vpRef.current;
        const t = panTargetRef.current;
        const lerp = 0.1;
        vp.offsetX += (t.x - vp.offsetX) * lerp;
        vp.offsetY += (t.y - vp.offsetY) * lerp;
        vp.scale += (t.scale - vp.scale) * lerp;
        dirtyRef.current = true;

        // Stop when close enough
        if (
          Math.abs(vp.offsetX - t.x) < 0.5 &&
          Math.abs(vp.offsetY - t.y) < 0.5 &&
          Math.abs(vp.scale - t.scale) < 0.01
        ) {
          vp.offsetX = t.x;
          vp.offsetY = t.y;
          vp.scale = t.scale;
          panTargetRef.current = null;
        }
      }

      // Redraw every 60th frame for pulse animations, or when dirty
      if (dirtyRef.current || frameCountRef.current % 60 === 0) {
        draw();
        dirtyRef.current = false;
      }

      // Always request next frame for activity particles and pulses
      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragTotalRef.current = 0;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    mouseScreenRef.current = { x: sx, y: sy };

    if (isDraggingRef.current && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragTotalRef.current += Math.abs(dx) + Math.abs(dy);
      vpRef.current = {
        ...vpRef.current,
        offsetX: vpRef.current.offsetX - dx / vpRef.current.scale,
        offsetY: vpRef.current.offsetY - dy / vpRef.current.scale,
      };
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      dirtyRef.current = true;
      canvas.style.cursor = 'grabbing';
    } else {
      // Hover hit test
      const hitId = hitTest(sx, sy, assetsRef.current, vpRef.current);
      if (hitId !== hoveredRef.current) {
        hoveredRef.current = hitId;
        canvas.style.cursor = hitId ? 'pointer' : 'grab';
        dirtyRef.current = true;
      }
    }
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const wasDragging = dragTotalRef.current > 5;
      isDraggingRef.current = false;
      dragStartRef.current = null;

      if (!wasDragging) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const hitId = hitTest(sx, sy, assetsRef.current, vpRef.current);

        if (hitId) {
          onAssetSelect(hitId);
        } else {
          onAssetSelect(null);
        }
      }

      if (canvasRef.current) {
        canvasRef.current.style.cursor = hoveredRef.current ? 'pointer' : 'grab';
      }
    },
    [onAssetSelect],
  );

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    vpRef.current = zoomAt(vpRef.current, sx, sy, e.deltaY);
    dirtyRef.current = true;
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const hitId = hitTest(sx, sy, assetsRef.current, vpRef.current);

    if (hitId) {
      const asset = assetsRef.current.find((a) => a.id === hitId);
      if (asset) {
        const targetScale = 2.0;
        const W = rect.width;
        const H = rect.height;
        panTargetRef.current = {
          x: asset.x - W / 2 / targetScale,
          y: asset.y - H / 2 / targetScale,
          scale: targetScale,
        };
      }
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        cursor: 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    />
  );
});

export default AssetCityCanvas;
