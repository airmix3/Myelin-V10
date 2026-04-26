'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useSSE } from '@/components/useSSE';
import {
  AlertTriangle,
  Clock,
  Send,
  MessageSquare,
  CheckCircle2,
  Timer,
  Shield,
  Flame,
  CircleDot,
  PauseCircle,
  XCircle,
  X,
} from 'lucide-react';

// ─── Types ───

interface EscalationItem {
  id: string;
  taskId: string;
  agentId: string;
  type: string;
  urgency: string;
  status: string;
  summary: string;
  reason: string | null;
  context: string | null;
  response: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  task: { title: string; department: string };
}

interface EscalationsClientProps {
  escalations: EscalationItem[];
}

// ─── Helpers ───

type Level = 'L1' | 'L2' | 'L3' | 'L4';

const levelFromType = (type: string): Level => {
  switch (type) {
    case 'critical': return 'L4';
    case 'needs-info': return 'L3';
    case 'budget': case 'hire': case 'budget_increase': case 'hire_approval': return 'L2';
    default: return 'L1';
  }
};

const levelConfig: Record<Level, { color: string; bg: string; border: string }> = {
  L4: { color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
  L3: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  L2: { color: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/30' },
  L1: { color: 'text-slate-400', bg: 'bg-slate-500/15', border: 'border-slate-500/30' },
};

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   color: 'text-amber-400',   bg: 'bg-amber-500/10',   icon: <CircleDot className="w-3 h-3" /> },
  responded: { label: 'Responded', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <CheckCircle2 className="w-3 h-3" /> },
  deferred:  { label: 'Deferred',  color: 'text-sky-400',     bg: 'bg-sky-500/10',     icon: <PauseCircle className="w-3 h-3" /> },
  dismissed: { label: 'Resolved',  color: 'text-slate-400',   bg: 'bg-slate-500/10',   icon: <XCircle className="w-3 h-3" /> },
};

const deptColors: Record<string, string> = {
  tech: 'bg-violet-500',
  marketing: 'bg-pink-500',
  operations: 'bg-amber-500',
  global: 'bg-emerald-500',
};

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

type StatusFilter = 'all' | 'pending' | 'responded' | 'deferred' | 'dismissed';
type LevelFilter = 'all' | Level;

const statusFilters: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'responded', label: 'Responded' },
  { key: 'deferred', label: 'Deferred' },
  { key: 'dismissed', label: 'Resolved' },
];

const levelFilters: { key: LevelFilter; label: string }[] = [
  { key: 'all', label: 'All Levels' },
  { key: 'L4', label: 'L4' },
  { key: 'L3', label: 'L3' },
  { key: 'L2', label: 'L2' },
  { key: 'L1', label: 'L1' },
];

// ─── Card Component ───

function EscalationCard({
  esc,
  index,
  loading,
  responseText,
  showResponse,
  onToggleResponse,
  onResponseTextChange,
  onSendDirective,
  onResolve,
  onDefer,
  onAskTamir,
}: {
  esc: EscalationItem;
  index: number;
  loading: boolean;
  responseText: string;
  showResponse: boolean;
  onToggleResponse: () => void;
  onResponseTextChange: (text: string) => void;
  onSendDirective: () => void;
  onResolve: () => void;
  onDefer: () => void;
  onAskTamir: () => void;
}) {
  const level = levelFromType(esc.type);
  const lc = levelConfig[level];
  const sc = statusConfig[esc.status] ?? statusConfig.pending;
  const isPending = esc.status === 'pending';
  const isL4 = level === 'L4';
  const dept = esc.task.department || 'global';
  const deptColor = deptColors[dept] || 'bg-slate-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`rounded-xl border ${
        isL4 ? 'border-amber-500/20' : 'border-slate-700/40'
      }`}
      style={{
        background: 'rgba(15, 23, 42, 0.6)',
        boxShadow: isL4
          ? '0 0 20px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.03)'
          : 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <div className="p-5 space-y-4">
        {/* Header row: badges */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Level badge */}
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${lc.bg} ${lc.color} ${lc.border}`}>
              {level}
            </span>
            {/* Urgency badge */}
            {esc.urgency === 'critical' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-400">
                <Flame className="w-3 h-3" />
                Critical
              </span>
            )}
            {esc.urgency === 'high' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                High
              </span>
            )}
            {esc.urgency === 'normal' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-sky-500/10 text-sky-400">
                <Shield className="w-3 h-3" />
                Normal
              </span>
            )}
            {/* Status badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium ${sc.bg} ${sc.color}`}>
              {sc.icon}
              {sc.label}
            </span>
          </div>
          {/* Department */}
          <span
            className="text-[11px] font-medium text-slate-400 px-2 py-0.5 rounded-full border border-slate-700/50"
            style={{ background: 'rgba(15, 23, 42, 0.6)' }}
          >
            {dept}
          </span>
        </div>

        {/* Summary */}
        <h3 className="text-lg font-semibold text-white leading-snug">{esc.summary}</h3>

        {/* Agent + Task row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Agent pill */}
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full ${deptColor} flex items-center justify-center text-[10px] font-bold text-white uppercase`}>
              {esc.agentId.charAt(0)}
            </div>
            <span className="text-sm text-slate-300 font-medium">{esc.agentId}</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-sm text-slate-400 truncate">{esc.task.title}</span>
        </div>

        {/* Reason */}
        {esc.reason && (
          <div className="rounded-lg px-3.5 py-2.5 border border-amber-500/15" style={{ background: 'rgba(245, 158, 11, 0.04)' }}>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1">Reason</p>
            <p className="text-sm text-amber-200/90 leading-relaxed">{esc.reason}</p>
          </div>
        )}

        {/* Context (if available, different from reason, and not raw JSON) */}
        {esc.context && esc.context !== esc.reason && !esc.context.startsWith('{') && !esc.context.startsWith('[') && (
          <div className="rounded-lg px-3.5 py-2.5 border border-slate-700/30" style={{ background: 'rgba(15, 23, 42, 0.4)' }}>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1">Context</p>
            <p className="text-sm text-slate-300/90 leading-relaxed">{esc.context}</p>
          </div>
        )}

        {/* Response (if responded) */}
        {esc.response && (
          <div className="rounded-lg px-3.5 py-2.5 border border-emerald-500/15" style={{ background: 'rgba(16, 185, 129, 0.04)' }}>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1">Response</p>
            <p className="text-sm text-emerald-300/90 leading-relaxed">{esc.response}</p>
          </div>
        )}

        {/* Inline response textarea */}
        {showResponse && isPending && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            <textarea
              value={responseText}
              onChange={(e) => onResponseTextChange(e.target.value)}
              placeholder="Type your directive..."
              rows={3}
              className="w-full rounded-lg border border-slate-700/50 bg-slate-900/50 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={onSendDirective}
                disabled={loading || !responseText.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3 h-3" />
                Send
              </button>
              <button
                onClick={onToggleResponse}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-500/10 border border-slate-500/20 hover:bg-slate-500/20 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* Footer: actions + timestamp */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50 flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {isPending && (
              <>
                <button
                  onClick={onToggleResponse}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-3 h-3" />
                  Send Directive
                </button>
                <button
                  onClick={onAskTamir}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sky-300 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3" />
                  Ask Tamir
                </button>
                <button
                  onClick={onResolve}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Resolve
                </button>
                <button
                  onClick={onDefer}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-500/10 border border-slate-500/20 hover:bg-slate-500/20 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Timer className="w-3 h-3" />
                  Defer
                </button>
              </>
            )}
            {!isPending && (
              <button
                onClick={onAskTamir}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sky-300 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" />
                Ask Tamir
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock className="w-3 h-3" />
            {formatTime(esc.createdAt)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ───

interface OverlayMessage {
  id: string;
  role: 'ceo' | 'agent';
  text: string;
}

export default function EscalationsClient({ escalations: initialEscalations }: EscalationsClientProps) {
  const router = useRouter();
  const [escalations, setEscalations] = useState<EscalationItem[]>(initialEscalations);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [showResponse, setShowResponse] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Overlay chat state
  const [overlayEscalation, setOverlayEscalation] = useState<EscalationItem | null>(null);
  const [overlayMessages, setOverlayMessages] = useState<OverlayMessage[]>([]);
  const [overlayInput, setOverlayInput] = useState('');
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayConversationId, setOverlayConversationId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Listen for new escalations via SSE
  useSSE({
    'escalation:created': (data) => {
      const newEsc: EscalationItem = {
        id: (data.escalationId as string) || String(Date.now()),
        taskId: (data.taskId as string) || '',
        agentId: (data.agentId as string) || '',
        type: (data.type as string) || 'custom',
        urgency: (data.urgency as string) || 'normal',
        status: 'pending',
        summary: (data.summary as string) || '',
        reason: null,
        context: null,
        response: null,
        resolution: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolvedAt: null,
        task: { title: '', department: '' },
      };
      setEscalations((prev) => [newEsc, ...prev]);
    },
  });

  const filtered = escalations.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (levelFilter !== 'all' && levelFromType(e.type) !== levelFilter) return false;
    return true;
  });

  // Counts for summary strip
  const pendingCount = escalations.filter((e) => e.status === 'pending').length;
  const respondedCount = escalations.filter((e) => e.status === 'responded').length;
  const deferredCount = escalations.filter((e) => e.status === 'deferred').length;
  const resolvedCount = escalations.filter((e) => e.status === 'dismissed').length;

  async function handleSendDirective(id: string) {
    const text = responseText[id]?.trim();
    if (!text) return;
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/escalations/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: text, resolution: 'answered' }),
      });
      setResponseText((prev) => ({ ...prev, [id]: '' }));
      setShowResponse((prev) => ({ ...prev, [id]: false }));
      router.refresh();
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleResolve(id: string) {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/escalations/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      router.refresh();
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleDefer(id: string) {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/escalations/${id}/defer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      router.refresh();
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  // Auto-scroll overlay thread
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [overlayMessages.length]);

  function handleAskTamir(esc: EscalationItem) {
    setOverlayEscalation(esc);
    setOverlayMessages([]);
    setOverlayInput('');
    setOverlayConversationId(null);
  }

  function handleCloseOverlay() {
    setOverlayEscalation(null);
    setOverlayMessages([]);
    setOverlayInput('');
    setOverlayConversationId(null);
  }

  const handleOverlaySend = useCallback(async () => {
    if (!overlayInput.trim() || !overlayEscalation) return;

    const userMsg: OverlayMessage = {
      id: `msg-${Date.now()}`,
      role: 'ceo',
      text: overlayInput.trim(),
    };
    setOverlayMessages((prev) => [...prev, userMsg]);
    const msgText = overlayInput.trim();
    setOverlayInput('');
    setOverlayLoading(true);

    try {
      const isFirst = !overlayConversationId;
      const url = isFirst ? '/api/tamir/consult' : `/api/tamir/consult/${overlayConversationId}`;
      const body = isFirst
        ? { message: msgText, context: `Escalation: ${overlayEscalation.summary}` }
        : { message: msgText };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setOverlayMessages((prev) => [
          ...prev,
          { id: `msg-err-${Date.now()}`, role: 'agent', text: 'Failed to get a response. Try again.' },
        ]);
        return;
      }

      const data = await res.json();
      if (data.conversationId) {
        setOverlayConversationId(data.conversationId);
      }

      setOverlayMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-reply`,
          role: 'agent',
          text: data.response || data.reply || 'No response.',
        },
      ]);
    } catch {
      setOverlayMessages((prev) => [
        ...prev,
        { id: `msg-err-${Date.now()}`, role: 'agent', text: 'Network error. Try again.' },
      ]);
    } finally {
      setOverlayLoading(false);
    }
  }, [overlayInput, overlayEscalation, overlayConversationId]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <AlertTriangle className="w-4.5 h-4.5 text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Escalations</h1>
            <p className="text-sm text-slate-500">Structured decision packets requiring attention</p>
          </div>
        </div>
      </motion.div>

      {/* Summary Strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass-panel rounded-xl p-3 flex items-center gap-6 flex-wrap"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-sm text-slate-400">Pending</span>
          <span className="text-sm font-semibold text-white">{pendingCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-slate-400">Responded</span>
          <span className="text-sm font-semibold text-white">{respondedCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-sm text-slate-400">Deferred</span>
          <span className="text-sm font-semibold text-white">{deferredCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="text-sm text-slate-400">Resolved</span>
          <span className="text-sm font-semibold text-white">{resolvedCount}</span>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex items-center gap-3 flex-wrap"
      >
        {/* Status filters */}
        <div
          className="flex items-center gap-1 p-1 rounded-lg"
          style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(100, 116, 139, 0.2)' }}
        >
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === f.key
                  ? 'bg-white/10 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-700/50" />

        {/* Level filters */}
        <div
          className="flex items-center gap-1 p-1 rounded-lg"
          style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(100, 116, 139, 0.2)' }}
        >
          {levelFilters.map((f) => {
            const lc = f.key !== 'all' ? levelConfig[f.key as Level] : null;
            return (
              <button
                key={f.key}
                onClick={() => setLevelFilter(f.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  levelFilter === f.key
                    ? lc
                      ? `${lc.bg} ${lc.color}`
                      : 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Escalation Cards */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-panel rounded-xl p-8 text-center"
          >
            <p className="text-slate-500 text-sm">No escalations match the current filter.</p>
          </motion.div>
        ) : (
          filtered.map((esc, i) => (
            <EscalationCard
              key={esc.id}
              esc={esc}
              index={i}
              loading={loading[esc.id] ?? false}
              responseText={responseText[esc.id] ?? ''}
              showResponse={showResponse[esc.id] ?? false}
              onToggleResponse={() =>
                setShowResponse((prev) => ({ ...prev, [esc.id]: !prev[esc.id] }))
              }
              onResponseTextChange={(text) =>
                setResponseText((prev) => ({ ...prev, [esc.id]: text }))
              }
              onSendDirective={() => handleSendDirective(esc.id)}
              onResolve={() => handleResolve(esc.id)}
              onDefer={() => handleDefer(esc.id)}
              onAskTamir={() => handleAskTamir(esc)}
            />
          ))
        )}
      </div>

      {/* Overlay Chat Panel */}
      <AnimatePresence>
        {overlayEscalation && (
          <>
            {/* Backdrop */}
            <motion.div
              key="overlay-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={handleCloseOverlay}
            />

            {/* Panel */}
            <motion.div
              key="overlay-panel"
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 h-full w-[380px] z-50 flex flex-col"
              style={{
                background: 'rgba(15,15,25,0.95)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Header */}
              <div
                className="shrink-0 flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-amber-400 font-medium mb-0.5">Ask Tamir</p>
                  <p className="text-[12px] text-slate-400 truncate">{overlayEscalation.summary}</p>
                </div>
                <button
                  onClick={handleCloseOverlay}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer ml-2"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Thread */}
              <div
                ref={threadRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
              >
                {overlayMessages.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-[12px] text-slate-600">Ask Tamir about this escalation...</p>
                  </div>
                )}
                {overlayMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={msg.role === 'ceo' ? 'flex justify-end' : 'flex justify-start'}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        msg.role === 'ceo'
                          ? 'text-white'
                          : 'text-slate-200'
                      }`}
                      style={{
                        background: msg.role === 'ceo'
                          ? 'rgba(56,189,248,0.15)'
                          : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${
                          msg.role === 'ceo'
                            ? 'rgba(56,189,248,0.2)'
                            : 'rgba(255,255,255,0.08)'
                        }`,
                      }}
                    >
                      {msg.role === 'agent' && (
                        <span className="text-[10px] text-amber-400 font-medium block mb-1">Tamir</span>
                      )}
                      {msg.text}
                    </div>
                  </div>
                ))}
                {overlayLoading && (
                  <div className="flex justify-start">
                    <div
                      className="px-3.5 py-2.5 rounded-2xl flex items-center gap-1.5"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
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
                  </div>
                )}
              </div>

              {/* Input */}
              <div
                className="shrink-0 px-4 py-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={overlayInput}
                    onChange={(e) => setOverlayInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleOverlaySend();
                      }
                    }}
                    placeholder="Ask about this escalation..."
                    className="flex-1 rounded-xl border border-slate-700/50 bg-slate-900/50 px-3.5 py-2.5 text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500/40"
                  />
                  <button
                    onClick={handleOverlaySend}
                    disabled={overlayLoading || !overlayInput.trim()}
                    className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
