'use client';

import { motion } from 'motion/react';

const DEPT_COLORS: Record<string, string> = {
  executive: 'bg-amber-600',
  tech: 'bg-blue-600',
  marketing: 'bg-purple-600',
  operations: 'bg-emerald-600',
};

export interface HandoffCTAProps {
  agentId: string;
  agentName: string;
  department: string;
  onConnect: () => void;
}

export default function HandoffCTA({ agentId, agentName, department, onConnect }: HandoffCTAProps) {
  const avatarBg = DEPT_COLORS[department] ?? 'bg-amber-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-1.5 items-start"
    >
      <div className="glass-card rounded-2xl p-4 max-w-[85%] w-full">
        <div className="flex items-center gap-3">
          {/* Agent avatar */}
          <div
            className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center text-[14px] font-bold text-white shrink-0`}
          >
            {agentId.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white">{agentName}</p>
            <p className="text-[11px] text-slate-500">{department}</p>
          </div>

          {/* CTA button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onConnect}
            className="px-4 py-2 rounded-xl text-[12px] font-bold text-slate-900 cursor-pointer shrink-0"
            style={{ background: '#f59e0b' }}
          >
            Connect with {agentName}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
