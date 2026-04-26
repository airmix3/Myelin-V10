'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Zap, ExternalLink } from 'lucide-react';
import { useSSE } from '@/components/useSSE';

// ── Types ────────────────────────────────────────────────────────────────────

interface BuildLogEntry {
  type: string;
  agentName?: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  SDK_SESSION_INIT: '#3b82f6',    // blue
  SDK_ASSISTANT: '#64748b',        // slate
  SDK_TOOL_PROGRESS: '#f59e0b',    // amber
  SDK_TOOL_SUMMARY: '#10b981',     // emerald
  SDK_RESULT_SUCCESS: '#22c55e',   // green
  SDK_RESULT_ERROR: '#f43f5e',     // rose
};

function getBadgeColor(type: string): string {
  return TYPE_BADGE_COLORS[type] ?? '#64748b';
}

// ── Entry Row ────────────────────────────────────────────────────────────────

function EntryRow({ entry, index }: { entry: BuildLogEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const color = getBadgeColor(entry.type);
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;

  return (
    <div>
      <button
        onClick={() => hasMetadata && setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-white/[0.02] transition-colors"
        style={{ cursor: hasMetadata ? 'pointer' : 'default' }}
      >
        {hasMetadata && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0"
          >
            <ChevronDown size={10} className="text-slate-500" />
          </motion.div>
        )}
        {/* Type badge */}
        <span
          className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
          style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
        >
          {entry.type.replace('SDK_', '').replace(/_/g, ' ')}
        </span>
        {/* Agent name */}
        {entry.agentName && (
          <span className="text-[10px] text-slate-400 font-medium shrink-0">
            {entry.agentName}
          </span>
        )}
        {/* Description */}
        <span className="text-[11px] text-slate-400 truncate flex-1">
          {entry.description}
        </span>
        {/* Timestamp */}
        <span className="text-[9px] text-slate-600 shrink-0">
          {entry.timestamp}
        </span>
      </button>

      <AnimatePresence>
        {expanded && hasMetadata && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pl-8 pr-2 pb-2 overflow-hidden"
          >
            <pre className="text-[10px] text-slate-500 whitespace-pre-wrap break-all glass-deep rounded-lg p-2">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export default function LiveExecutionPanel({
  taskId,
  deliverableId,
  initialStatus,
}: {
  taskId: string;
  deliverableId?: string;
  initialStatus?: 'completed' | 'failed';
}) {
  const [entries, setEntries] = useState<BuildLogEntry[]>([]);
  const [completed, setCompleted] = useState<'completed' | 'failed' | null>(initialStatus ?? null);

  useEffect(() => {
    if (initialStatus) {
      setCompleted(initialStatus);
    }
  }, [initialStatus]);

  useEffect(() => {
    setEntries([]);
    setCompleted(initialStatus ?? null);
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const appendEntry = useCallback((data: Record<string, unknown>) => {
    if (data.taskId !== taskId) return;
    const entry: BuildLogEntry = {
      type: String(data.type ?? 'SDK_ASSISTANT'),
      agentName: data.agentName as string | undefined,
      description: String(data.description ?? data.message ?? ''),
      timestamp: String(data.timestamp ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })),
      metadata: data.metadata as Record<string, unknown> | undefined,
    };
    setEntries(prev => [...prev, entry]);
  }, [taskId]);

  const handleTransition = useCallback((data: Record<string, unknown>) => {
    if (data.taskId !== taskId) return;
    const newState = String(data.newState ?? '');
    if (newState === 'completed' || newState === 'failed') {
      setCompleted(newState as 'completed' | 'failed');
    }
  }, [taskId]);

  useSSE({
    'task:buildlog': appendEntry,
    'task:transition': handleTransition,
  });

  return (
    <div className="glass-panel w-full flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap size={13} className="text-sky-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
          Live Execution
        </span>
        {/* Live indicator */}
        {!completed && (
          <motion.div
            className="w-2 h-2 rounded-full bg-emerald-400 ml-auto"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        {completed && (
          <span
            className="ml-auto text-[10px] font-bold uppercase"
            style={{ color: completed === 'completed' ? '#22c55e' : '#f43f5e' }}
          >
            {completed}
          </span>
        )}
      </div>

      {/* Deliverable link */}
      {deliverableId && (
        <a
          href={`/deliverables/${deliverableId}`}
          className="flex items-center gap-1.5 text-[11px] text-sky-400 hover:text-sky-300 transition-colors"
        >
          <ExternalLink size={11} />
          View Deliverable
        </a>
      )}

      {/* Completion banner */}
      {completed && (
        <div
          className="rounded-xl px-3 py-2 text-[12px] font-semibold text-center"
          style={{
            background: completed === 'completed' ? 'rgba(34,197,94,0.08)' : 'rgba(244,63,94,0.08)',
            border: `1px solid ${completed === 'completed' ? 'rgba(34,197,94,0.25)' : 'rgba(244,63,94,0.25)'}`,
            color: completed === 'completed' ? '#22c55e' : '#f43f5e',
          }}
        >
          Task {completed === 'completed' ? 'completed successfully' : 'failed'}
        </div>
      )}

      {/* Build log entries */}
      <div
        className="space-y-1 max-h-[400px] overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
      >
        {entries.length === 0 ? (
          <div className="text-[11px] text-slate-600 py-4 text-center">
            {completed ? 'Execution has finished.' : 'Waiting for execution logs...'}
          </div>
        ) : (
          entries.map((entry, index) => (
            <EntryRow key={index} entry={entry} index={index} />
          ))
        )}
      </div>
    </div>
  );
}
