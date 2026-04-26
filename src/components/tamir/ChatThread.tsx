'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { MessageRenderer, type MessageType } from '@/components/tamir/messages/index';
import TextBubble from '@/components/tamir/messages/TextBubble';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agentId?: string;
  timestamp?: string;
  type?: MessageType;
  metadata?: Record<string, unknown>;
}

const suggestedPrompts = [
  "What's most urgent right now?",
  'Give me the morning brief',
  "How's the Tech department doing?",
  'Show me active escalations',
];

export default function ChatThread({
  messages,
  loading,
  onSuggestedPrompt,
  onAction,
}: {
  messages: ChatMessage[];
  loading?: boolean;
  onSuggestedPrompt?: (prompt: string) => void;
  onAction?: (value: string, extra?: { executorAgentId?: string }) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-3"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(56,189,248,0.15))', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            <Sparkles className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white">What can I help you with?</h2>
          <p className="text-sm text-slate-400 text-center" style={{ maxWidth: '24rem' }}>
            I have full context on your missions, teams, escalations, and vault. Ask me anything.
          </p>
        </motion.div>
        <div className="grid grid-cols-2 gap-2 w-full" style={{ maxWidth: '28rem' }}>
          {suggestedPrompts.map((prompt, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
              onClick={() => onSuggestedPrompt?.(prompt)}
              className="px-3 py-2.5 rounded-xl text-[13px] text-slate-300 text-left transition-all hover:brightness-125 cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {prompt}
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
    >
      <div className="max-w-3xl mx-auto space-y-5">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => {
            const messageRole = msg.role === 'user' ? 'ceo' : 'agent';

            // Plan approved separator
            if (msg.metadata?.separatorType === 'plan-approved') {
              return (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="flex items-center gap-3 py-2"
                >
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full font-medium shrink-0">
                    Plan Approved &mdash; Executing
                  </span>
                  <div className="flex-1 h-px bg-white/10" />
                </motion.div>
              );
            }

            return (
              <motion.div
                key={msg.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={msg.role === 'user' ? 'flex justify-end' : ''}
              >
                {msg.type ? (
                  <MessageRenderer
                    type={msg.type}
                    content={msg.content}
                    role={messageRole}
                    agentId={msg.agentId}
                    timestamp={msg.timestamp}
                    onAction={onAction}
                    {...(msg.metadata ?? {})}
                  />
                ) : (
                  <TextBubble
                    content={msg.content}
                    role={messageRole}
                    agentId={msg.agentId}
                    timestamp={msg.timestamp}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Loading indicator - pulsing dots */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex flex-col gap-1 items-start"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-amber-400">Tamir</span>
              </div>
              <div
                className="px-4 py-3 rounded-2xl flex items-center gap-1.5"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.09)',
                }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-amber-400/60"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.15, 0.85] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
