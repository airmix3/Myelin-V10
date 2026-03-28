'use client';

import { useRef, useEffect } from 'react';

interface NeuralHeroProps {
  title: string;
  subtitle?: string;
  stats: { label: string; value: string | number; color?: string }[];
}

// Neon palette
const NEON_COLORS = [
  [143, 231, 255], // Cyan #8FE7FF
  [100, 150, 255], // Electric blue #6496FF
  [46, 230, 166],  // Mint #2EE6A6
  [255, 100, 200], // Magenta #FF64C8
  [233, 69, 96],   // Coral-red #E94560
  [255, 179, 71],  // Amber #FFB347
];

interface Node {
  x: number; // normalized 0-1
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulsePhase: number;
  brightness: number;
  fireTimer: number;
  fireDelay: number; // frames to wait before rendering fire (for propagation)
  color: number[]; // [r, g, b]
}

function boxMuller(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function generateNodes(): Node[] {
  const count = 45 + Math.floor(Math.random() * 21); // 45-65
  const nodes: Node[] = [];

  // Generate hub cluster centers (2-3)
  const hubCount = 2 + Math.floor(Math.random() * 2);
  const hubs: { cx: number; cy: number }[] = [];
  for (let h = 0; h < hubCount; h++) {
    hubs.push({ cx: 0.2 + Math.random() * 0.6, cy: 0.2 + Math.random() * 0.6 });
  }

  for (let i = 0; i < count; i++) {
    let x: number, y: number;

    // Some nodes in hub clusters (5-8 per hub)
    const hubIndex = Math.floor(i / 7); // roughly 7 per hub
    if (hubIndex < hubCount && (i % 7) < (5 + Math.floor(Math.random() * 4))) {
      // Tight cluster around hub center
      x = clamp(hubs[hubIndex].cx + (Math.random() - 0.5) * 0.08, 0.05, 0.95);
      y = clamp(hubs[hubIndex].cy + (Math.random() - 0.5) * 0.08, 0.05, 0.95);
    } else {
      // Gaussian distribution centered at 0.5
      x = clamp(0.5 + boxMuller() * 0.25, 0.02, 0.98);
      y = clamp(0.5 + boxMuller() * 0.25, 0.02, 0.98);
    }

    nodes.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.6, // 0.1-0.3 px/frame range
      vy: (Math.random() - 0.5) * 0.6,
      radius: 1.5 + Math.random() * 2.5, // 1.5-4
      pulsePhase: Math.random() * Math.PI * 2,
      brightness: Math.random() * 0.3,
      fireTimer: 0,
      fireDelay: 0,
      color: NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)],
    });
  }

  return nodes;
}

export default function NeuralHero({ title, subtitle, stats }: NeuralHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const frameRef = useRef(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    nodesRef.current = generateNodes();

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    };
    window.addEventListener('resize', handleResize);

    function animate() {
      if (!canvas || !ctx) return;
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      const nodes = nodesRef.current;
      const frame = frameRef.current++;
      const time = frame * 0.016; // ~60fps timing

      ctx.clearRect(0, 0, w, h);

      // Update positions
      for (const node of nodes) {
        node.x += node.vx / w;
        node.y += node.vy / h;

        // Bounce off edges
        if (node.x < 0.02 || node.x > 0.98) { node.vx *= -1; node.x = clamp(node.x, 0.02, 0.98); }
        if (node.y < 0.02 || node.y > 0.98) { node.vy *= -1; node.y = clamp(node.y, 0.02, 0.98); }
      }

      // Fire random node every 60-120 frames
      if (frame % (60 + Math.floor(Math.random() * 61)) === 0) {
        const idx = Math.floor(Math.random() * nodes.length);
        nodes[idx].fireTimer = 1.0;
        nodes[idx].fireDelay = 0;

        // Propagate to neighbors
        const firedX = nodes[idx].x * w;
        const firedY = nodes[idx].y * h;
        for (let j = 0; j < nodes.length; j++) {
          if (j === idx) continue;
          const nx = nodes[j].x * w;
          const ny = nodes[j].y * h;
          const dist = Math.sqrt((firedX - nx) ** 2 + (firedY - ny) ** 2);
          if (dist < 120) {
            nodes[j].fireTimer = Math.max(nodes[j].fireTimer, 0.3);
            nodes[j].fireDelay = 10;
          }
        }
      }

      // Decay fire timers
      for (const node of nodes) {
        if (node.fireDelay > 0) {
          node.fireDelay--;
        } else if (node.fireTimer > 0) {
          node.fireTimer -= 0.015;
          if (node.fireTimer < 0) node.fireTimer = 0;
        }
        node.brightness = node.fireTimer > 0 && node.fireDelay === 0
          ? clamp(node.fireTimer, 0, 1)
          : Math.max(node.brightness * 0.98, 0.05);
      }

      // Draw connections
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].brightness < 0.1) continue; // optimization: skip dim nodes for source
        const ax = nodes[i].x * w;
        const ay = nodes[i].y * h;
        for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[j].brightness < 0.1) continue;
          const bx = nodes[j].x * w;
          const by = nodes[j].y * h;
          const dist = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
          if (dist < 120) {
            const alpha = 0.05 + 0.15 * (1 - dist / 120);
            const c1 = nodes[i].color;
            const c2 = nodes[j].color;
            const r = (c1[0] + c2[0]) >> 1;
            const g = (c1[1] + c2[1]) >> 1;
            const b = (c1[2] + c2[2]) >> 1;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw nodes with glow
      ctx.globalCompositeOperation = 'lighter';
      for (const node of nodes) {
        if (node.fireDelay > 0) continue; // waiting for propagation
        const px = node.x * w;
        const py = node.y * h;
        const breathing = 1 + 0.15 * Math.sin(time * 0.5 + node.pulsePhase);
        const baseR = node.radius * breathing;
        const fireMult = node.fireTimer > 0 ? 1 + node.fireTimer : 1;
        const [cr, cg, cb] = node.color;

        // Layer 1: Large outer glow
        const outerR = baseR * 4 * fireMult;
        const grad1 = ctx.createRadialGradient(px, py, 0, px, py, outerR);
        grad1.addColorStop(0, `rgba(${cr},${cg},${cb},0.3)`);
        grad1.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.globalAlpha = 0.08 * fireMult;
        ctx.beginPath();
        ctx.arc(px, py, outerR, 0, Math.PI * 2);
        ctx.fillStyle = grad1;
        ctx.fill();

        // Layer 2: Medium bloom
        const midR = baseR * 2.5 * fireMult;
        const grad2 = ctx.createRadialGradient(px, py, 0, px, py, midR);
        grad2.addColorStop(0, `rgba(${cr},${cg},${cb},0.5)`);
        grad2.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.globalAlpha = 0.15 * fireMult;
        ctx.beginPath();
        ctx.arc(px, py, midR, 0, Math.PI * 2);
        ctx.fillStyle = grad2;
        ctx.fill();

        // Layer 3: Sharp inner core
        ctx.globalAlpha = 0.9 * fireMult;
        ctx.beginPath();
        ctx.arc(px, py, baseR * fireMult, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <div
      className="dashboard-hero"
      style={{
        background: 'linear-gradient(135deg, #090816 0%, #0f1023 30%, #15162d 60%, #24163f 100%)',
      }}
    >
      <canvas ref={canvasRef} />
      <div className="dashboard-hero-overlay">
        <div className="dashboard-hero-title">{title}</div>
        {subtitle && <div className="dashboard-hero-subtitle">{subtitle}</div>}
        <div className="dashboard-hero-stats">
          {stats.map((s) => (
            <div key={s.label} className={`dashboard-hero-stat stat-${s.color || 'cyan'}`}>
              <div className="dashboard-hero-stat-value">{s.value}</div>
              <div className="dashboard-hero-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
