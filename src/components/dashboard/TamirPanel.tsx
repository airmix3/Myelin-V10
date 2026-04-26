'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

type TabName = 'Brief' | 'Blockers' | 'Approvals' | 'Costs';
import Link from 'next/link';

interface Message {
  role: 'ceo' | 'agent';
  text: string;
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-2"
    >
      <div
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        <span className="text-[10px] font-bold text-amber-400">Tamir</span>
        <div className="flex items-center gap-0.5 ml-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1 h-1 rounded-full bg-amber-400/60"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function TamirPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('Brief');
  const [missionCount, setMissionCount] = useState(0);
  const threadRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Fetch mission count from status-bar
  useEffect(() => {
    fetch('/api/status-bar')
      .then((r) => r.json())
      .then((d) => setMissionCount(d.tasksCompleted ?? 0))
      .catch(() => {});
  }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'ceo', text }]);
    setLoading(true);
    setLastTaskId(null);

    try {
      const url = conversationId
        ? `/api/tamir/consult/${conversationId}`
        : '/api/tamir/consult';

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setMessages((prev) => [...prev, { role: 'agent', text: `Error: ${err.error || 'Request failed'}` }]);
        return;
      }

      const data = await res.json();

      // Set conversationId from first response
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      // Extract taskId if present
      if (data.detected_task?.taskId || data.taskId) {
        setLastTaskId(data.detected_task?.taskId || data.taskId);
      }

      setMessages((prev) => [...prev, { role: 'agent', text: data.response }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'agent', text: 'Error: Could not reach Tamir.' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel flex flex-col h-full w-[340px] shrink-0 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(32px) saturate(160%) brightness(2.2)',
        WebkitBackdropFilter: 'blur(32px) saturate(160%) brightness(2.2)',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.22)',
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(8px)' }}
      >
        <div className="relative shrink-0">
          <div
            className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-sm font-bold text-white"
            style={{ boxShadow: '0 2px 8px rgba(245,158,11,0.4)' }}
          >
            T
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2"
            style={{ borderColor: '#0a1020' }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-200">Tamir</span>
            <span className="text-[10px] font-medium text-slate-400">Chief of Staff</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
            <span className="text-[11px] font-medium text-emerald-400">Online</span>
            <span className="text-[11px] font-medium text-slate-400 ml-1">Monitoring {missionCount} missions</span>
          </div>
        </div>
      </div>

      {/* Message thread */}
      <div ref={threadRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <div className="text-[13px] text-slate-400 font-medium">
              Start a conversation with Tamir
            </div>
            <div className="text-[11px] text-slate-500">
              Type a message to begin
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${msg.role === 'ceo' ? 'items-end' : 'items-start'}`}
          >
            <div
              className="max-w-[92%] rounded-xl px-3 py-2.5"
              style={
                msg.role === 'agent'
                  ? {
                      background: 'var(--glass-elevated)',
                      border: 'var(--glass-border)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15)',
                    }
                  : {
                      background: 'rgba(56,189,248,0.10)',
                      border: '1px solid rgba(56,189,248,0.18)',
                      color: '#bae6fd',
                    }
              }
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[10px] font-bold ${msg.role === 'agent' ? 'text-amber-400' : 'text-sky-400'}`}
                >
                  {msg.role === 'agent' ? 'Tamir' : 'You'}
                </span>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-200">
                {msg.text}
              </p>
            </div>
          </div>
        ))}

        {/* Task link */}
        {lastTaskId && (
          <div className="flex items-center gap-2 px-2">
            <Link
              href="/tamir"
              className="text-[11px] text-sky-400 hover:text-sky-300 underline"
            >
              View in Tamir
            </Link>
          </div>
        )}

        {/* Typing indicator */}
        <AnimatePresence>
          {loading && <TypingIndicator />}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-3 pb-3 pt-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}
      >
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{
            background: 'rgba(14,22,48,0.70)',
            border: '1px solid rgba(245,158,11,0.20)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Tamir..."
            disabled={loading}
            className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-slate-600 text-slate-200"
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-1.5 rounded-md disabled:opacity-40"
            style={{
              background: 'rgba(245,158,11,0.85)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            <Send className="w-3 h-3 text-white" />
          </motion.button>
        </div>
      </div>

      {/* Bottom tab rail */}
      <div className="shrink-0 flex items-center gap-1 px-3 pb-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {(['Brief', 'Blockers', 'Approvals', 'Costs'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              activeTab === tab
                ? 'text-sky-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            style={activeTab === tab ? { background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.20)' } : { background: 'transparent', border: '1px solid transparent' }}
          >
            {tab}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
