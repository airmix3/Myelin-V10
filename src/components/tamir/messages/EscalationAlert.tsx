'use client';

import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'rgba(244,63,94,0.15)', text: '#fda4af', border: 'rgba(244,63,94,0.3)' },
  high: { bg: 'rgba(251,191,36,0.15)', text: '#fcd34d', border: 'rgba(251,191,36,0.3)' },
  medium: { bg: 'rgba(56,189,248,0.15)', text: '#7dd3fc', border: 'rgba(56,189,248,0.3)' },
  low: { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)' },
};

export interface EscalationAlertProps {
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  onRespond?: () => void;
}

export default function EscalationAlert({ message, priority, onRespond }: EscalationAlertProps) {
  const colors = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-1 items-start"
    >
      <div
        className="max-w-[85%] rounded-2xl p-4 w-full"
        style={{
          background: 'rgba(244,63,94,0.08)',
          border: '1px solid rgba(244,63,94,0.22)',
          boxShadow: '0 0 20px rgba(244,63,94,0.06)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span
            className="text-[10px] px-2 py-0.5 rounded font-bold uppercase"
            style={{
              background: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.border}`,
            }}
          >
            {priority}
          </span>
        </div>

        {/* Message */}
        <p className="text-[12px] text-slate-300 leading-relaxed mb-3">{message}</p>

        {/* Respond CTA */}
        {onRespond && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onRespond}
            className="px-4 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-all"
            style={{
              background: 'rgba(244,63,94,0.12)',
              color: '#fda4af',
              border: '1px solid rgba(244,63,94,0.25)',
            }}
          >
            Respond
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
