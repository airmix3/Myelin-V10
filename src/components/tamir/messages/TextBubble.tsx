'use client';

import { marked } from 'marked';
import { motion } from 'motion/react';

const DEPT_COLORS: Record<string, string> = {
  executive: 'bg-amber-600',
  tech: 'bg-blue-600',
  marketing: 'bg-purple-600',
  operations: 'bg-emerald-600',
};

export interface TextBubbleProps {
  content: string;
  role: 'ceo' | 'agent';
  agentId?: string;
  timestamp?: string;
}

export default function TextBubble({ content, role, agentId, timestamp }: TextBubbleProps) {
  const isCeo = role === 'ceo';
  const agentLabel = agentId ?? 'Tamir';
  const avatarBg = agentId ? (DEPT_COLORS[agentId] ?? 'bg-amber-600') : 'bg-amber-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col gap-1 ${isCeo ? 'items-end' : 'items-start'}`}
    >
      <div className="flex items-center gap-2">
        {!isCeo && (
          <div
            className={`w-5 h-5 rounded-full ${avatarBg} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}
          >
            {agentLabel.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span
          className={`text-[11px] font-medium ${isCeo ? 'text-sky-400' : 'text-amber-400'}`}
        >
          {isCeo ? 'You' : agentLabel}
        </span>
        {timestamp && (
          <span className="text-[10px] text-slate-600">{timestamp}</span>
        )}
      </div>
      {isCeo ? (
        <div
          className="max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
          style={{
            background: 'rgba(56,189,248,0.10)',
            border: '1px solid rgba(56,189,248,0.18)',
            color: '#bae6fd',
          }}
        >
          {content}
        </div>
      ) : (
        <div
          className="max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed glass-card prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_pre]:text-xs [&_code]:text-xs [&_p]:text-sm [&_li]:text-sm"
          style={{ color: '#e2e8f0' }}
          dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }}
        />
      )}
    </motion.div>
  );
}
