'use client';

import { useRef, useEffect } from 'react';

interface NeuralHeroProps {
  title: string;
  subtitle?: string;
  stats: { label: string; value: string | number; color?: string }[];
}

const COLORS = ['#e94560', '#6496ff', '#00d68f', '#ff64c8', '#ffb347', '#a0f0ff'];
const NODE_COUNT = 55;

interface Node {
  x: number; // normalized 0-1
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulseSpeed: number;
  pulsePhase: number;
  fireTimer: number;
  color: string; // hex string
}

function generateNodes(): Node[] {
  const nodes: Node[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0008,
      vy: (Math.random() - 0.5) * 0.0008,
      radius: Math.random() * 2.5 + 1,
      pulseSpeed: 0.02 + Math.random() * 0.04,
      pulsePhase: Math.random() * Math.PI * 2,
      fireTimer: 0,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
  }
  return nodes;
}

export default function NeuralHero({ title, subtitle, stats }: NeuralHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);
  const fireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // setTimeout-based firing chain (v3 style)
    function triggerFire() {
      const nodes = nodesRef.current;
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      n.fireTimer = 1.0;
      fireTimeoutRef.current = setTimeout(triggerFire, 200 + Math.random() * 800);
    }
    triggerFire();

    function animate() {
      if (!canvas || !ctx) return;
      const W = canvas.getBoundingClientRect().width;
      const H = canvas.getBoundingClientRect().height;
      const nodes = nodesRef.current;

      ctx.clearRect(0, 0, W, H);

      // Connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = (a.x - b.x) * W, dy = (a.y - b.y) * H;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.25;
            const firing = a.fireTimer > 0 || b.fireTimer > 0;
            ctx.beginPath();
            ctx.moveTo(a.x * W, a.y * H);
            ctx.lineTo(b.x * W, b.y * H);
            if (firing) {
              ctx.strokeStyle = `rgba(233,69,96,${alpha * 3})`;
              ctx.lineWidth = 1.5;
            } else {
              ctx.strokeStyle = `rgba(100,150,255,${alpha})`;
              ctx.lineWidth = 0.5;
            }
            ctx.stroke();
          }
        }
      }

      // Nodes
      ctx.globalCompositeOperation = 'lighter';
      for (const n of nodes) {
        n.pulsePhase += n.pulseSpeed;
        n.x = Math.max(0.02, Math.min(0.98, n.x + n.vx));
        n.y = Math.max(0.02, Math.min(0.98, n.y + n.vy));
        if (n.x <= 0.02 || n.x >= 0.98) n.vx *= -1;
        if (n.y <= 0.02 || n.y >= 0.98) n.vy *= -1;

        if (n.fireTimer > 0) {
          n.fireTimer -= 0.03;
          if (n.fireTimer <= 0) { n.fireTimer = 0; }
        }

        const glow = n.fireTimer > 0
          ? n.fireTimer * 15
          : (Math.sin(n.pulsePhase) * 0.5 + 0.5) * 4;
        const r = n.radius + glow * 0.5;

        // Glow
        const grad = ctx.createRadialGradient(n.x * W, n.y * H, 0, n.x * W, n.y * H, r * 4);
        const c = n.fireTimer > 0 ? '#e94560' : n.color;
        grad.addColorStop(0, c + (n.fireTimer > 0 ? 'ff' : '80'));
        grad.addColorStop(1, c + '00');
        ctx.beginPath();
        ctx.arc(n.x * W, n.y * H, r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(n.x * W, n.y * H, r, 0, Math.PI * 2);
        ctx.fillStyle = n.fireTimer > 0 ? '#fff' : c;
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      if (fireTimeoutRef.current) clearTimeout(fireTimeoutRef.current);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <div
      className="dashboard-hero"
      style={{
        background: 'linear-gradient(135deg, #0a0a1a, #1a0a2e, #0a1a2e)',
      }}
    >
      <canvas ref={canvasRef} />
      <div className="dashboard-hero-overlay">
        <div className="dashboard-hero-title" dangerouslySetInnerHTML={{ __html: title }} />
        {subtitle && <div className="dashboard-hero-subtitle">{subtitle}</div>}
        <div className="dashboard-hero-stats">
          {stats.map((s) => (
            <div key={s.label} className={`dashboard-hero-stat stat-${s.color || 'accent'}`}>
              <div className="dashboard-hero-stat-value">{s.value}</div>
              <div className="dashboard-hero-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
