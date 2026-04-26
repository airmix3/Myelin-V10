'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Database } from 'lucide-react';
import type { TaskTimeline, TimelineNode, TimelineConnector } from '@/lib/timeline';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TaskFlowTimelineProps {
  taskId: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const AGENT_HEX_COLORS: Record<string, string> = {
  tamir: '#38bdf8',     // sky-400
  cto: '#3b82f6',       // blue-500
  cmo: '#a855f7',       // purple-500
  coo: '#10b981',       // emerald-500
};

const AGENT_BG_CLASSES: Record<string, string> = {
  tamir: 'bg-sky-500',
  cto: 'bg-blue-500',
  cmo: 'bg-purple-500',
  coo: 'bg-emerald-500',
};

function getAgentHexColor(agentId: string): string {
  return AGENT_HEX_COLORS[agentId] ?? '#64748b';
}

function getAgentBgClass(agentId: string): string {
  return AGENT_BG_CLASSES[agentId] ?? 'bg-slate-500';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatAgentLabel(agentId: string): string {
  const upper = agentId.toUpperCase();
  if (['CTO', 'CMO', 'COO'].includes(upper)) return upper;
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TaskFlowTimeline({ taskId }: TaskFlowTimelineProps) {
  const [timeline, setTimeline] = useState<TaskTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/timeline`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTimeline(data.timeline);
      setError(false);
      return data.timeline as TaskTimeline;
    } catch {
      setError(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;
    pollCountRef.current = 0;

    const poll = async () => {
      const result = await fetchTimeline();
      if (cancelled) return;

      // Poll every 5s if not summarized, up to 6 times (30s)
      if (result && !result.summarized && pollCountRef.current < 6) {
        pollCountRef.current++;
        pollTimerRef.current = setTimeout(poll, 5000);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [fetchTimeline]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700/50" />
            <div className="flex-1">
              <div className="h-3 bg-slate-700/50 rounded-xl w-24 mb-2" />
              <div className="h-2 bg-slate-700/30 rounded-xl w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !timeline) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-center opacity-80">
        <Database size={32} className="text-slate-600 mb-3" />
        <p className="text-sm text-slate-400">Failed to load task flow data</p>
      </div>
    );
  }

  if (timeline.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-center opacity-80">
        <Database size={32} className="text-slate-600 mb-3" />
        <p className="text-sm text-slate-400">No task flow data available</p>
        <p className="text-xs text-slate-500 mt-1">Activity will appear as agents work on this task</p>
      </div>
    );
  }

  return (
    <div className="relative pl-10">
      {/* Vertical timeline line — gradient */}
      <div
        className="absolute top-4 bottom-4"
        style={{
          left: '15px',
          width: '1px',
          background: 'linear-gradient(to bottom, rgba(56,189,248,0.20), rgba(148,163,184,0.08), transparent)',
          boxShadow: '0 0 4px rgba(56,189,248,0.10)',
        }}
      />

      <div className="flex flex-col gap-2">
        {timeline.nodes.map((node, idx) => {
          // Find connector from this node to the next
          const connector = timeline.connectors.find((c) => c.fromIndex === node.sessionIndex);

          return (
            <div key={node.sessionIndex}>
              <TimelineNodeCard node={node} index={idx} />
              {connector && idx < timeline.nodes.length - 1 && (
                <ConnectorLabel connector={connector} isShadowTransition={
                  node.isShadow || (timeline.nodes[idx + 1]?.isShadow ?? false)
                } />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TimelineNodeCard({ node, index }: { node: TimelineNode; index: number }) {
  const isShadow = node.isShadow;
  const agentColor = getAgentHexColor(node.agentId);
  const agentBgClass = getAgentBgClass(node.agentId);
  const label = node.nodeLabel ?? formatAgentLabel(node.agentId);
  const summaryText = node.summary ?? `${node.actionCount} action${node.actionCount !== 1 ? 's' : ''}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      className={`relative flex items-start gap-3 py-2 ${isShadow ? 'opacity-60' : ''}`}
    >
      {/* Dot on timeline */}
      <div className="absolute left-[-19px] top-[16px] z-10">
        {!isShadow ? (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: agentColor,
                boxShadow: `0 0 0 3px rgba(6,10,19,0.90), 0 0 8px ${agentColor}40`,
              }}
            />
          </motion.div>
        ) : (
          <div
            className="w-3 h-3 rounded-full bg-slate-600"
            style={{
              boxShadow: '0 0 0 3px rgba(6,10,19,0.90)',
            }}
          />
        )}
      </div>

      {/* Node card */}
      <div
        className="flex-1 flex rounded-xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Internal colored accent bar */}
        <div
          className="w-1 self-stretch rounded-full shrink-0"
          style={{ background: isShadow ? '#334155' : agentColor }}
        />

        {/* Card content */}
        <div className="flex-1 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            {/* Agent avatar */}
            <div
              className={`w-10 h-10 rounded-full ${agentBgClass} flex items-center justify-center text-[12px] font-bold text-white shrink-0 ${isShadow ? 'opacity-40' : ''}`}
              style={
                !isShadow
                  ? { boxShadow: `0 0 0 2px ${agentColor}30, 0 0 12px ${agentColor}20` }
                  : {}
              }
            >
              {node.agentId.charAt(0).toUpperCase()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-[13px] font-semibold ${isShadow ? 'text-slate-600' : 'text-white'}`}>
                  {node.agentName}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-md ${isShadow ? 'text-slate-700' : 'text-slate-400'}`}
                  style={!isShadow ? { background: 'rgba(255,255,255,0.04)' } : {}}
                >
                  {label}
                </span>
              </div>
              <p className={`text-[11px] mt-0.5 line-clamp-2 leading-relaxed ${isShadow ? 'text-slate-700' : 'text-slate-400'} ${!node.summary ? 'italic' : ''}`}>
                {summaryText}
              </p>
            </div>

            {/* Timestamp chip */}
            <span
              className="text-[10px] text-slate-500 shrink-0 px-2 py-0.5 rounded-md"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              {formatTime(node.startedAt)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ConnectorLabel({ connector, isShadowTransition }: { connector: TimelineConnector; isShadowTransition: boolean }) {
  if (!connector.label) {
    // No label — just spacing, the timeline line provides visual continuity
    return <div className="my-1" />;
  }

  return (
    <div className={`flex items-center gap-2 pl-0 my-1 ${isShadowTransition ? 'opacity-50' : ''}`}>
      <span
        className="rounded-full px-3 py-1 text-[10px] text-slate-400 font-medium uppercase tracking-wider"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {connector.label}
      </span>
    </div>
  );
}
