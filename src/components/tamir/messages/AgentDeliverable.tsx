'use client';

import { motion } from 'motion/react';
import { FileText, Code2, Image, Play } from 'lucide-react';
import Link from 'next/link';

const TYPE_ICONS: Record<string, React.ElementType> = {
  document: FileText,
  code: Code2,
  image: Image,
  video: Play,
};

export interface AgentDeliverableProps {
  filename: string;
  type: string;
  deliverableId: string;
}

export default function AgentDeliverable({ filename, type, deliverableId }: AgentDeliverableProps) {
  const Icon = TYPE_ICONS[type] ?? FileText;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-1.5 items-start"
    >
      <div className="glass-card rounded-2xl p-4 max-w-[85%] w-full">
        <div className="flex items-center gap-3">
          {/* File icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(148,163,184,0.07)',
              border: '1px solid rgba(148,163,184,0.15)',
            }}
          >
            <Icon size={16} className="text-slate-400" />
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white truncate">{filename}</p>
            <span
              className="glass-pill text-[10px] font-medium px-2 py-0.5 rounded-full inline-block mt-1"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#94a3b8',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {type}
            </span>
          </div>

          {/* View link */}
          <Link
            href={`/deliverables/${deliverableId}`}
            className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors shrink-0"
          >
            View Deliverable
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
