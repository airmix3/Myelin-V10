'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Zap } from 'lucide-react';
import { useSSE } from '@/components/useSSE';

export interface LiveExecutionPanelProps {
  taskId: string;
  deliverableId?: string;
}

interface BuildLogEntry {
  tool?: string;
  message: string;
  timestamp?: string;
}

export default function LiveExecutionPanel({ taskId, deliverableId }: LiveExecutionPanelProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const entries: BuildLogEntry[] = [];

  useSSE({
    'task:buildlog': (data: unknown) => {
      const d = data as { taskId: string; entry: BuildLogEntry };
      if (d.taskId === taskId) {
        entries.push(d.entry);
      }
    },
  });

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-1.5 items-start"
    >
      <div className="glass-panel rounded-2xl p-4 max-w-[85%] w-full space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-sky-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
            Live Execution
          </span>
          {/* Live indicator */}
          <motion.div
            className="w-2 h-2 rounded-full bg-emerald-400 ml-auto"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>

        {/* Task info */}
        <div className="text-[11px] text-slate-400">
          Task: <span className="text-slate-300 font-medium">{taskId}</span>
          {deliverableId && (
            <>
              {' '} | Deliverable: <span className="text-slate-300 font-medium">{deliverableId}</span>
            </>
          )}
        </div>

        {/* Build log entries */}
        <div className="space-y-1 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
          {entries.length === 0 ? (
            <div className="text-[11px] text-slate-600 py-2">
              Waiting for execution logs...
            </div>
          ) : (
            entries.map((entry, index) => (
              <div key={index}>
                <button
                  onClick={() => entry.tool ? toggleStep(index) : undefined}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-white/[0.02] transition-colors"
                >
                  {entry.tool && (
                    <motion.div
                      animate={{ rotate: expandedSteps.has(index) ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown size={10} className="text-slate-500" />
                    </motion.div>
                  )}
                  {entry.tool && (
                    <span className="text-[10px] text-sky-400 font-medium shrink-0">
                      {entry.tool}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 truncate flex-1">
                    {entry.message}
                  </span>
                  {entry.timestamp && (
                    <span className="text-[9px] text-slate-600 shrink-0">
                      {entry.timestamp}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {entry.tool && expandedSteps.has(index) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="pl-6 pr-2 pb-1"
                    >
                      <pre className="text-[10px] text-slate-500 whitespace-pre-wrap break-all">
                        {entry.message}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
