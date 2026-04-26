'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import Link from 'next/link';
import { Zap, ChevronDown } from 'lucide-react';
import type { Task } from './MissionBoard';

const priorityBorder: Record<string, string> = {
  critical: 'rgba(244,63,94,0.35)',
  high: 'rgba(245,158,11,0.25)',
  medium: 'rgba(255,255,255,0.12)',
  low: 'rgba(255,255,255,0.12)',
};

const priorityBadge: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(244,63,94,0.20)', text: '#fda4af' },
  high: { bg: 'rgba(245,158,11,0.20)', text: '#fcd34d' },
  medium: { bg: 'rgba(100,116,139,0.20)', text: '#94a3b8' },
  low: { bg: 'rgba(100,116,139,0.20)', text: '#64748b' },
};

const buttonConfig: Record<string, { bg: string; border: string }> = {
  'act-now': { bg: 'rgba(245,158,11,0.85)', border: 'rgba(245,158,11,0.40)' },
  'approve-decide': { bg: 'rgba(16,185,129,0.85)', border: 'rgba(16,185,129,0.40)' },
  'review': { bg: 'rgba(14,165,233,0.85)', border: 'rgba(14,165,233,0.40)' },
};

const secondaryBtn: React.CSSProperties = {
  background: 'rgba(20,31,53,0.5)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.09)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
};

function parseMeta(metadata: string | null): { priority: string; type?: string } {
  if (!metadata) return { priority: 'medium' };
  try {
    const p = JSON.parse(metadata);
    return { priority: p.priority || 'medium', type: p.type };
  } catch {
    return { priority: 'medium' };
  }
}

function getCtaLabel(task: Task, columnKey: string): string {
  const { type } = parseMeta(task.metadata);
  if (task.state === 'input-required' && type === 'hire_request') return 'Approve Hire';
  if (task.state === 'input-required' && type === 'budget_increase') return 'Approve Budget';
  if (task.state === 'input-required') return 'Unblock';
  if (task.state === 'completed') return 'Mark Complete';
  if (task.state === 'failed') return 'Details \u2192';
  if (columnKey === 'approve-decide') return 'Approve Plan';
  if (columnKey === 'review') return 'Review';
  return 'View Task';
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getTaskLink(task: Task, columnKey: string): string {
  if (columnKey === 'review') return `/deliverables?taskId=${task.id}`;
  return `/tamir?taskId=${task.id}`;
}

export default function MissionCard({
  task,
  columnKey,
}: {
  task: Task;
  columnKey: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { priority } = parseMeta(task.metadata);
  const btn = buttonConfig[columnKey] || buttonConfig['review'];
  const pBadge = priorityBadge[priority] || priorityBadge.medium;
  const ctaLabel = getCtaLabel(task, columnKey);
  const age = timeAgo(task.createdAt);

  return (
    <motion.div
      whileHover={{ y: -2, filter: 'brightness(1.06)' }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card rounded-xl p-4 relative overflow-hidden"
      style={{
        border: `1px solid ${priorityBorder[priority] || priorityBorder.medium}`,
        backdropFilter: 'blur(12px) saturate(140%) brightness(1.05)',
        WebkitBackdropFilter: 'blur(12px) saturate(140%) brightness(1.05)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* ZONE 1: WHAT — title + priority */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-[13px] font-bold text-white leading-tight">{task.title}</h4>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priority === 'critical' ? 'priority-pulse' : ''}`}
            style={{ background: pBadge.bg, color: pBadge.text }}
          >
            {priority}
          </span>
        </div>
      </div>

      {/* ZONE 2: WHY — description/action + age */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.state === 'failed' ? (
            <>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: '#f43f5e', boxShadow: '0 0 6px rgba(244,63,94,0.8)' }}
              />
              <span className="text-[11px] text-rose-300 truncate">
                {task.description || 'Task failed — needs attention'}
              </span>
            </>
          ) : task.description ? (
            <>
              <Zap className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[11px] text-amber-300/80 truncate">
                {task.description}
              </span>
            </>
          ) : (
            <span className="text-[11px] text-slate-500 capitalize truncate">
              {task.department} · {task.state}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold tabular-nums text-slate-500 shrink-0">
          {age}
        </span>
      </div>

      {/* ZONE 3: ACTION — CTA + Details */}
      <div className="flex items-center gap-2">
        <Link href={getTaskLink(task, columnKey)} className="flex-1">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg cursor-pointer"
            style={{
              background: btn.bg,
              color: '#0a0f1a',
              border: `1px solid ${btn.border}`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20), 0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {ctaLabel}
          </motion.button>
        </Link>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-400 rounded-lg transition-colors hover:text-slate-200 cursor-pointer"
          style={secondaryBtn}
        >
          Details
          <ChevronDown
            className="w-3 h-3 transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </motion.button>
      </div>

      {/* EXPANDED DETAILS */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {task.description && (
                <p className="text-[11px] text-slate-500">{task.description}</p>
              )}
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                style={{
                  background: 'rgba(245,158,11,0.06)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(245,158,11,0.18)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-300 font-medium capitalize">
                  {task.department} · {task.state}
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                Created: {new Date(task.createdAt).toLocaleDateString()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
