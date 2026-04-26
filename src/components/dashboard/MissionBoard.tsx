'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanEye, Shield, CheckCircle2 } from 'lucide-react';
import { useSSE } from '@/components/useSSE';
import MissionColumn from './MissionColumn';

export interface Task {
  id: string;
  title: string;
  state: string;
  department: string;
  metadata: string | null;
  createdAt: string;
  planMarkdown: string | null;
  description: string | null;
  creatorId: string | null;
}

type ColumnId = 'act-now' | 'approve-decide' | 'review';

export function getColumnForTask(task: Task): ColumnId | null {
  // Parse metadata once
  let meta: Record<string, unknown> = {};
  if (task.metadata) {
    try { meta = JSON.parse(task.metadata); } catch { /* ignore */ }
  }

  switch (task.state) {
    case 'submitted':
      // Not yet assigned -- no CEO attention needed
      return null;

    case 'working':
      // If plan is ready (planMarkdown present, not yet approved) -> approve_decide
      if (task.planMarkdown && !meta.approvedAt) return 'approve-decide';
      // Otherwise actively being worked -- no CEO attention needed
      return null;

    case 'input-required':
      // Use persisted classification from Tamir mini invocation
      if (meta.kanbanColumn === 'act_now') return 'act-now';
      if (meta.kanbanColumn === 'approve_decide') return 'approve-decide';
      // Fallback if classification hasn't landed yet
      return 'approve-decide';

    case 'completed':
    case 'canceled':
      return 'review';

    case 'failed':
      return 'act-now';

    default:
      return null;
  }
}

export default function MissionBoard({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  useSSE({
    'task:transition': (data) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== data.taskId) return t;
          // Update state and merge any metadata from transition
          const updated = { ...t, state: data.newState as string };
          // If transition metadata includes kanbanColumn, merge it
          if (data.kanbanColumn) {
            const existingMeta = t.metadata ? JSON.parse(t.metadata) : {};
            updated.metadata = JSON.stringify({ ...existingMeta, kanbanColumn: data.kanbanColumn });
          }
          return updated;
        }),
      );
    },
    'task:column-classified': (data) => {
      // Tamir classified a task's kanban column async
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== data.taskId) return t;
          const existingMeta = t.metadata ? JSON.parse(t.metadata) : {};
          return { ...t, metadata: JSON.stringify({ ...existingMeta, kanbanColumn: data.kanbanColumn }) };
        }),
      );
    },
    'task:reviewed': (data) => {
      setTasks((prev) => prev.filter((t) => t.id !== data.taskId));
    },
  });

  const grouped: Record<ColumnId, Task[]> = {
    'act-now': [],
    'approve-decide': [],
    'review': [],
  };
  for (const task of tasks) {
    const col = getColumnForTask(task);
    if (col) {
      grouped[col].push(task);
    }
  }

  const totalPending = grouped['act-now'].length + grouped['approve-decide'].length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col h-full rounded-2xl overflow-hidden relative"
      style={{
        background: 'rgba(8,14,32,0.50)',
        backdropFilter: 'blur(20px) saturate(150%) brightness(1.06)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%) brightness(1.06)',
        border: '1.5px solid rgba(56,189,248,0.40)',
        boxShadow:
          '0 0 0 1px rgba(56,189,248,0.15), ' +
          '0 0 24px rgba(56,189,248,0.18), ' +
          '0 0 60px rgba(56,189,248,0.08), ' +
          '0 12px 48px rgba(0,0,0,0.5), ' +
          'inset 0 1px 0 rgba(255,255,255,0.14)',
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] z-10"
        style={{
          background: 'linear-gradient(90deg, rgba(56,189,248,0.0) 0%, rgba(56,189,248,0.80) 30%, rgba(245,158,11,0.60) 70%, rgba(56,189,248,0.0) 100%)',
        }}
      />

      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-4 px-5 py-3"
        style={{
          background: 'linear-gradient(180deg, rgba(6,12,28,0.85) 0%, rgba(8,16,36,0.70) 100%)',
          borderBottom: '1px solid rgba(56,189,248,0.14)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Icon */}
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0.06) 100%)',
            border: '1px solid rgba(56,189,248,0.35)',
            boxShadow: '0 0 16px rgba(56,189,248,0.20), inset 0 1px 0 rgba(255,255,255,0.10)',
          }}
        >
          <ScanEye className="w-5 h-5 text-sky-300" />
        </div>

        {/* Title */}
        <div
          className="text-base font-bold tracking-tight shrink-0"
          style={{
            background: 'linear-gradient(90deg, #e0f2fe 0%, #7dd3fc 50%, #bae6fd 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Attention Center
        </div>

        {/* Divider */}
        <div className="w-px h-5 shrink-0" style={{ background: 'rgba(56,189,248,0.18)' }} />

        {/* Count pills */}
        <div className="flex items-center gap-1.5">
          {[
            { count: grouped['act-now'].length, label: 'Act Now', color: 'rgba(245,158,11,0.85)', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.22)' },
            { count: grouped['approve-decide'].length, label: 'Decide', color: 'rgba(56,189,248,0.90)', bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.22)' },
            { count: grouped['review'].length, label: 'Review', color: 'rgba(52,211,153,0.90)', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.22)' },
          ].map(({ count, label, color, bg, border }) => (
            <motion.div
              key={label}
              layout
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <motion.span
                key={count}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="text-sm font-bold tabular-nums"
                style={{ color }}
              >
                {count}
              </motion.span>
              <span className="text-[11px] text-slate-400">{label}</span>
            </motion.div>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Pending urgency signal */}
        {totalPending > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: '#fbbf24', boxShadow: '0 0 6px rgba(251,191,36,0.9)' }}
            />
            <span className="text-[11px] font-medium text-amber-400/70 whitespace-nowrap">
              {totalPending} pending
            </span>
          </div>
        )}

        {/* Directive button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => window.location.href = '/tamir'}
          className="flex items-center gap-2 px-4 py-2 text-[12px] font-bold rounded-xl shrink-0 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.95) 0%, rgba(234,130,8,0.95) 100%)',
            color: '#0a0f1a',
            border: '1px solid rgba(245,158,11,0.60)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 16px rgba(245,158,11,0.30)',
          }}
        >
          <Shield className="w-3.5 h-3.5" />
          Send Directive
        </motion.button>
      </div>

      {/* Mission Columns */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        <div className="grid grid-cols-3 gap-3 h-full">
          <MissionColumn columnKey="act-now" tasks={grouped['act-now']} />
          <MissionColumn columnKey="approve-decide" tasks={grouped['approve-decide']} />
          <MissionColumn columnKey="review" tasks={grouped['review']} />
        </div>
      </div>
    </motion.div>
  );
}
