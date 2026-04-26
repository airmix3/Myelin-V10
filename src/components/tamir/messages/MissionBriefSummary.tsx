'use client';

import { motion } from 'motion/react';
import { Target } from 'lucide-react';
import Link from 'next/link';

const DEPT_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  executive: { bg: 'bg-amber-600', text: 'text-amber-400', hex: '#f59e0b' },
  tech: { bg: 'bg-blue-600', text: 'text-blue-400', hex: '#0ea5e9' },
  marketing: { bg: 'bg-purple-600', text: 'text-violet-400', hex: '#8b5cf6' },
  operations: { bg: 'bg-emerald-600', text: 'text-emerald-400', hex: '#10b981' },
};

export interface MissionBriefSummaryProps {
  taskId: string;
  title: string;
  department: string;
  agentId: string;
  description?: string;
}

export default function MissionBriefSummary({
  taskId,
  title,
  department,
  agentId,
  description,
}: MissionBriefSummaryProps) {
  const deptColor = DEPT_COLORS[department] ?? DEPT_COLORS.executive;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-1.5 items-start"
    >
      <div className="glass-card rounded-2xl p-4 max-w-[85%] w-full space-y-3">
        {/* Header with icon */}
        <div className="flex items-center gap-2">
          <Target size={14} className={deptColor.text} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Mission Brief
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[16px] font-semibold text-white leading-tight">
          {title}
        </h3>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="glass-pill text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: `${deptColor.hex}15`,
              color: deptColor.hex,
              border: `1px solid ${deptColor.hex}30`,
            }}
          >
            {department}
          </span>
          <span className="text-[11px] text-slate-400">
            Agent: <span className="font-medium text-slate-300">{agentId}</span>
          </span>
        </div>

        {/* Description */}
        {description && (
          <p className="text-[12px] text-slate-400 leading-relaxed">
            {description}
          </p>
        )}

        {/* Task link */}
        <Link
          href={`/deliverables/${taskId}`}
          className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors"
        >
          View task details
        </Link>
      </div>
    </motion.div>
  );
}
