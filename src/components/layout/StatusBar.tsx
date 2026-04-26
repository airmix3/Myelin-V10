'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, Zap, CheckSquare, FileOutput, ShieldCheck, RefreshCw, SlidersHorizontal } from 'lucide-react';

// ---- Types ----

interface StatusMetrics {
  activeAgents: number;
  totalAgents: number;
  tasksCompleted: number;
  deliverablesCount: number;
  uptime: string;
}

// ---- ANIMATED NUMBER ----

function AnimatedNumber({ value, className }: { value: number; className: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <span className={className}>{display}</span>;
}

// ---- LIVE SYNC CLOCK ----

function LiveSyncBadge() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s >= 60 ? 1 : s + 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-[11px] font-semibold text-slate-300 tabular-nums">
      {secs}s ago
    </span>
  );
}

// ---- BURN RATE SPARK ----

const burnBars = [4, 6, 5, 8, 7, 9, 7, 8, 10, 9, 11, 10];

// ---- STYLING ----

const glassBase: React.CSSProperties = {
  backdropFilter: 'blur(12px) saturate(140%) brightness(1.05)',
  WebkitBackdropFilter: 'blur(12px) saturate(140%) brightness(1.05)',
};

const pill = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

// ---- METRIC RENDERERS ----

function MetricAgents({ metrics }: { metrics: StatusMetrics }) {
  return (
    <motion.div
      variants={pill}
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-full glass-pill flex-shrink-0 whitespace-nowrap"
      style={{ ...glassBase, border: '1px solid rgba(52,211,153,0.18)' }}
    >
      <Bot className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span className="text-xs text-slate-400">Agents</span>
      <AnimatedNumber value={metrics.activeAgents} className="text-sm font-bold text-emerald-400" />
      <span className="text-xs text-slate-600">/</span>
      <span className="text-xs text-slate-500">{metrics.totalAgents} online</span>
    </motion.div>
  );
}

function MetricBurn() {
  return (
    <motion.div
      variants={pill}
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-full glass-pill flex-shrink-0 whitespace-nowrap"
      style={glassBase}
    >
      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span className="text-xs text-slate-400">Burn</span>
      <span className="text-sm font-bold text-amber-400">$0</span>
      <div className="flex items-end gap-0.5 ml-1">
        {burnBars.map((h, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full pulse-bar"
            style={{ height: `${h * 2}px`, background: i >= burnBars.length - 3 ? 'rgba(245,158,11,0.75)' : 'rgba(245,158,11,0.25)' }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function MetricTasks({ metrics }: { metrics: StatusMetrics }) {
  return (
    <motion.div
      variants={pill}
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-full glass-pill flex-shrink-0 whitespace-nowrap"
      style={glassBase}
    >
      <CheckSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
      <span className="text-xs text-slate-400">Tasks done</span>
      <AnimatedNumber value={metrics.tasksCompleted} className="text-sm font-bold text-sky-400" />
    </motion.div>
  );
}

function MetricDeliverables({ metrics }: { metrics: StatusMetrics }) {
  return (
    <motion.div
      variants={pill}
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-full glass-pill flex-shrink-0 whitespace-nowrap"
      style={glassBase}
    >
      <FileOutput className="w-3.5 h-3.5 text-violet-400 shrink-0" />
      <span className="text-xs text-slate-400">Deliverables</span>
      <AnimatedNumber value={metrics.deliverablesCount} className="text-sm font-bold text-violet-400" />
    </motion.div>
  );
}

function MetricUptime({ metrics }: { metrics: StatusMetrics }) {
  return (
    <motion.div
      variants={pill}
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-full glass-pill flex-shrink-0 whitespace-nowrap"
      style={{ ...glassBase, border: '1px solid rgba(52,211,153,0.12)' }}
    >
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span className="text-xs text-slate-400">Uptime</span>
      <span className="text-sm font-bold text-emerald-400">{metrics.uptime}</span>
    </motion.div>
  );
}

function MetricSync() {
  return (
    <motion.div
      variants={pill}
      className="flex items-center gap-2 px-3.5 py-2 rounded-full glass-pill flex-shrink-0 whitespace-nowrap"
      style={{ ...glassBase, border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot shrink-0" />
      <RefreshCw className="w-3 h-3 text-slate-500 shrink-0" />
      <span className="text-xs text-slate-500">Synced</span>
      <LiveSyncBadge />
    </motion.div>
  );
}

// ---- STATUS BAR ----

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

export default function StatusBar() {
  const [metrics, setMetrics] = useState<StatusMetrics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/status-bar');
        if (res.ok) setMetrics(await res.json());
      } catch { /* silent fail */ }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Show placeholder height while loading
  if (!metrics) return <div className="px-4 py-2 h-[52px]" />;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="px-4 py-2 relative z-10">
      <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>

        <MetricAgents metrics={metrics} />
        <MetricBurn />
        <MetricTasks metrics={metrics} />
        <MetricDeliverables metrics={metrics} />
        <MetricUptime metrics={metrics} />
        <MetricSync />

        {/* Customize shortcut */}
        <motion.div variants={pill} className="ml-auto shrink-0">
          <Link href="/settings">
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-medium text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
              style={{ ...glassBase, border: '1px solid rgba(255,255,255,0.06)' }}
              title="Customize StatusBar"
            >
              <SlidersHorizontal size={11} />
              Customize
            </motion.button>
          </Link>
        </motion.div>

      </div>
    </motion.div>
  );
}
