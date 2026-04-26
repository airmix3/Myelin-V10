'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { marked } from 'marked';
import { useSSE } from '@/components/useSSE';
import {
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Zap,
  Send,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  Loader2,
  Bot,
  User,
  Info,
  CalendarClock,
} from 'lucide-react';

// ─── Types ───

interface RoutineData {
  id: string;
  name: string;
  description: string | null;
  cronExpr: string;
  agentId: string;
  department: string;
  taskPlan: string;
  status: string;
  lastRunAt: string | null;
  lastTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  nextRun?: string | null;
}

interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  ts: string;
  agentId?: string;
  turnType?: string;
  planMarkdown?: string;
}

// ─── Constants ───

const AGENTS = [
  { id: 'tamir', label: 'Tamir (CoS)' },
  { id: 'cto', label: 'CTO' },
  { id: 'cmo', label: 'CMO' },
  { id: 'coo', label: 'COO' },
];

const DEPARTMENTS = [
  { id: 'tech', label: 'Tech' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'operations', label: 'Operations' },
  { id: 'cos', label: 'CoS' },
];

const CRON_EXAMPLES = [
  { expr: '0 9 * * 1', desc: 'Monday 9 AM' },
  { expr: '0 9 * * 1-5', desc: 'Weekdays 9 AM' },
  { expr: '0 0 1 * *', desc: '1st of month' },
  { expr: '*/30 * * * *', desc: 'Every 30 min' },
  { expr: '0 9 * * *', desc: 'Daily 9 AM' },
];

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active:   { label: 'Active',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  paused:   { label: 'Paused',   color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  planning: { label: 'Planning', color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
  failed:   { label: 'Failed',   color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
};

const deptColors: Record<string, string> = {
  tech: 'bg-violet-500',
  marketing: 'bg-pink-500',
  operations: 'bg-amber-500',
  cos: 'bg-emerald-500',
};

// ─── Helpers ───

function formatToolName(toolName: string): string {
  const toolLabels: Record<string, string> = {
    Read: 'reading a file',
    Write: 'writing a file',
    Edit: 'editing a file',
    Bash: 'running a command',
    Grep: 'searching code',
    Glob: 'finding files',
    WebFetch: 'fetching a webpage',
  };
  return toolLabels[toolName] || `using ${toolName.toLowerCase()}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function agentLabel(agentId: string): string {
  return AGENTS.find((a) => a.id === agentId)?.label ?? agentId;
}

// ─── Inline Chat Component ───

function InlineChat({
  messages,
  onSend,
  isLoading,
  activityText,
  placeholder = 'Continue the conversation...',
}: {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
  activityText: string | null;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activityText]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'system' ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500">
                <Info className="w-3 h-3" />
                {msg.content}
              </div>
            ) : msg.role === 'user' ? (
              <div className="max-w-[80%] flex items-start gap-2">
                <div className="rounded-xl px-4 py-2.5 text-sm text-white leading-relaxed bg-sky-500/10 border border-sky-500/20">
                  {msg.content}
                </div>
                <div className="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-sky-400" />
                </div>
              </div>
            ) : (
              <div className="max-w-[80%] flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div
                  className="rounded-xl px-4 py-2.5 text-sm text-slate-200 leading-relaxed border border-[var(--border-subtle)]"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  {msg.content}
                </div>
              </div>
            )}
          </motion.div>
        ))}

        {/* Activity indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-3 py-2"
          >
            <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
            <span className="text-xs text-slate-500">
              {activityText || 'Agent is thinking...'}
            </span>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1 bg-transparent border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/40"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Inline Plan Display ───

function InlinePlanDisplay({
  planMarkdown,
  onApprove,
  isLoading,
}: {
  planMarkdown: string;
  onApprove: () => void;
  isLoading: boolean;
}) {
  const html = marked.parse(planMarkdown) as string;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="glass-card rounded-xl overflow-hidden"
    >
      <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-white">Plan Ready</span>
        </div>
        <button
          onClick={onApprove}
          disabled={isLoading}
          className="glass-pill inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer disabled:opacity-40"
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3 h-3" />
          )}
          Approve Plan
        </button>
      </div>
      <div
        className="p-5 prose prose-invert prose-sm max-w-none text-slate-300
          [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white
          [&_strong]:text-white [&_a]:text-sky-400
          [&_code]:bg-slate-800/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
          [&_pre]:bg-slate-900/60 [&_pre]:border [&_pre]:border-slate-700/40 [&_pre]:rounded-lg"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </motion.div>
  );
}

// ─── Routine Card ───

function RoutineCard({
  routine,
  index,
  isSelected,
  onSelect,
  onToggle,
  onTrigger,
  onDelete,
  loading,
}: {
  routine: RoutineData;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onTrigger: () => void;
  onDelete: () => void;
  loading: boolean;
}) {
  const sc = statusConfig[routine.status] ?? statusConfig.active;
  const dept = routine.department || 'cos';
  const deptColor = deptColors[dept] || 'bg-slate-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onSelect}
      className={`rounded-xl border cursor-pointer transition-colors ${
        isSelected
          ? 'border-sky-500/40 bg-sky-500/5'
          : 'border-slate-700/40 hover:border-slate-600/50'
      }`}
      style={{
        background: isSelected
          ? 'rgba(14, 165, 233, 0.04)'
          : 'rgba(15, 23, 42, 0.6)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <div className="p-4 space-y-3">
        {/* Header: name + status */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white truncate pr-2">{routine.name}</h3>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${sc.bg} ${sc.color} ${sc.border} border`}>
            {sc.label}
          </span>
        </div>

        {/* Description */}
        {routine.description && (
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{routine.description}</p>
        )}

        {/* Meta: agent, dept, cron, last run */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Agent */}
          <div className="flex items-center gap-1.5">
            <div className={`w-5 h-5 rounded-full ${deptColor} flex items-center justify-center text-[9px] font-bold text-white uppercase`}>
              {routine.agentId.charAt(0)}
            </div>
            <span className="text-[11px] text-slate-400">{agentLabel(routine.agentId)}</span>
          </div>
          <span className="text-slate-700">|</span>
          {/* Department */}
          <span className="text-[11px] text-slate-500">{dept}</span>
          <span className="text-slate-700">|</span>
          {/* Cron */}
          <div className="flex items-center gap-1">
            <CalendarClock className="w-3 h-3 text-slate-500" />
            <span className="text-[11px] text-slate-500 font-mono">{routine.cronExpr}</span>
          </div>
        </div>

        {/* Last run */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Clock className="w-3 h-3" />
          Last run: {timeAgo(routine.lastRunAt)}
          {routine.nextRun && (
            <span className="ml-2">Next: {routine.nextRun}</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-700/30">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-300 bg-slate-500/10 border border-slate-500/20 hover:bg-slate-500/20 transition-colors cursor-pointer"
          >
            {routine.status === 'active' ? (
              <><Pause className="w-3 h-3" /> Pause</>
            ) : (
              <><Play className="w-3 h-3" /> Resume</>
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onTrigger(); }}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-40"
          >
            <Zap className="w-3 h-3" /> Trigger
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Create Form ───

function CreateRoutineForm({
  onSubmit,
  onCancel,
  loading,
}: {
  onSubmit: (data: { name: string; description: string; cronExpr: string; agentId: string; department: string }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cron, setCron] = useState('0 9 * * 1');
  const [agent, setAgent] = useState('cto');
  const [dept, setDept] = useState('tech');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, description: desc, cronExpr: cron, agentId: agent, department: dept });
  }

  const inputClass = 'w-full bg-transparent border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/40';
  const labelClass = 'text-xs font-medium text-slate-400 uppercase tracking-wider';

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      onSubmit={handleSubmit}
      className="glass-panel rounded-xl p-5 space-y-4 overflow-hidden"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-white">New Routine</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1">
        <label className={labelClass}>Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Weekly Competitor Analysis"
          required
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label className={labelClass}>Description</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What this routine does..."
          rows={2}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div className="space-y-1">
        <label className={labelClass}>Cron Schedule *</label>
        <input
          type="text"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          placeholder="0 9 * * 1"
          required
          className={inputClass + ' font-mono'}
        />
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {CRON_EXAMPLES.map((ex) => (
            <button
              key={ex.expr}
              type="button"
              onClick={() => setCron(ex.expr)}
              className="px-2 py-0.5 rounded-md text-[10px] text-slate-500 bg-slate-800/40 border border-slate-700/30 hover:text-slate-300 hover:border-slate-600/40 transition-colors cursor-pointer"
            >
              {ex.desc}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={labelClass}>Agent *</label>
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className={inputClass + ' cursor-pointer'}
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Department *</label>
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className={inputClass + ' cursor-pointer'}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="glass-pill inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Play className="w-3 h-3" />
        )}
        Start Planning
      </button>
    </motion.form>
  );
}

// ─── Main Page Component ───

export default function RoutinesClient({ routines: initialRoutines }: { routines: RoutineData[] }) {
  const router = useRouter();
  const [routines, setRoutines] = useState(initialRoutines);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);

  // Planning conversation state
  const [planningTaskId, setPlanningTaskId] = useState<string | null>(null);
  const [planningAgent, setPlanningAgent] = useState<string>('cto');
  const [planningDept, setPlanningDept] = useState<string>('tech');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showPlan, setShowPlan] = useState(false);
  const [planMarkdown, setPlanMarkdown] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activityText, setActivityText] = useState<string | null>(null);

  // SSE: real-time routine updates
  useSSE({
    'routine:activity': () => {
      refreshRoutines();
    },
    'task:stateChange': () => {
      refreshRoutines();
    },
  });

  // SSE: activity indicators during planning
  useEffect(() => {
    if (!isLoading || !planningTaskId) {
      setActivityText(null);
      return;
    }
    const es = new EventSource('/api/sse');
    es.addEventListener('task:buildlog', (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data);
        if (payload.taskId !== planningTaskId) return;
        const evt = payload.event;
        if (evt.type === 'tool_call') {
          setActivityText(`${(evt.agentId as string).toUpperCase()} is ${formatToolName(evt.tool_name)}...`);
        } else if (evt.type === 'tool_activity') {
          setActivityText(`${(evt.agentId as string).toUpperCase()} is ${formatToolName(evt.tool_name)}... (${Math.round(evt.elapsed_time_seconds)}s)`);
        } else if (evt.type === 'tool_summary') {
          setActivityText(evt.summary);
        }
      } catch { /* ignore malformed events */ }
    });
    return () => es.close();
  }, [isLoading, planningTaskId]);

  async function refreshRoutines() {
    try {
      const res = await fetch('/api/routines');
      if (res.ok) {
        const data = await res.json();
        setRoutines(data);
      }
    } catch {
      // Silently fail -- stale data is acceptable
    }
    router.refresh();
  }

  // Process agent turn response
  const processTurn = useCallback(
    (turn: { turn_type: string; message: string; plan_markdown?: string | null }, agentId: string) => {
      const agentMsg: ChatMessage = {
        role: 'agent',
        content: turn.message,
        ts: new Date().toISOString(),
        agentId,
        turnType: turn.turn_type,
        planMarkdown: turn.plan_markdown || undefined,
      };
      setMessages((prev) => [...prev, agentMsg]);

      if (turn.turn_type === 'plan_ready' && turn.plan_markdown) {
        setPlanMarkdown(turn.plan_markdown);
        setShowPlan(true);
      }

      if (turn.turn_type === 'plan_update' && turn.plan_markdown) {
        setPlanMarkdown(turn.plan_markdown);
      }

      if (turn.turn_type === 'done') {
        const systemMsg: ChatMessage = {
          role: 'system',
          content: 'Planning complete.',
          ts: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, systemMsg]);
      }
    },
    [],
  );

  // Create routine and start planning
  async function handleCreateAndPlan(data: { name: string; description: string; cronExpr: string; agentId: string; department: string }) {
    setLoading(true);
    setPlanningAgent(data.agentId);
    setPlanningDept(data.department);

    try {
      const res = await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description || undefined,
          cronExpr: data.cronExpr,
          agentId: data.agentId,
          department: data.department,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setMessages([{
          role: 'system',
          content: errData.error || 'Failed to create routine planning task',
          ts: new Date().toISOString(),
        }]);
        setLoading(false);
        return;
      }

      const { taskId } = await res.json();
      setPlanningTaskId(taskId);
      setShowCreate(false);

      const firstMessage = `Let's plan this routine.

This is a ROUTINE -- a recurring automated task that runs on a schedule (${data.cronExpr}).
The plan you create is a TEMPLATE that executes repeatedly. It should describe:
- What the agent does each run
- What inputs change between runs (date, latest data, etc.)
- What outputs are expected each run
- Any data sources or tools to use
Do NOT include specific dates or one-time actions. Make it parameterized for recurring execution.

Routine name: ${data.name}
Description: ${data.description || 'N/A'}
Schedule: ${data.cronExpr}`;

      setMessages([{
        role: 'system',
        content: `Planning routine with ${data.agentId.toUpperCase()}...`,
        ts: new Date().toISOString(),
      }]);
      setIsLoading(true);

      const turnRes = await fetch(`/api/tasks/${taskId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: firstMessage, agentId: data.agentId }),
      });

      if (!turnRes.ok) {
        const err = await turnRes.json().catch(() => ({}));
        setMessages((prev) => [...prev, {
          role: 'system' as const,
          content: err.error || 'Agent failed to respond.',
          ts: new Date().toISOString(),
        }]);
      } else {
        const turnData = await turnRes.json();
        processTurn(turnData.turn, turnData.agent_id);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: 'system' as const,
        content: 'Network error. Please try again.',
        ts: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  }

  // Multi-turn planning messages
  const handlePlanningMessage = useCallback(
    async (message: string) => {
      const ceoMsg: ChatMessage = {
        role: 'user',
        content: message,
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, ceoMsg]);
      setIsLoading(true);

      try {
        const res = await fetch(`/api/tasks/${planningTaskId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMessages((prev) => [...prev, {
            role: 'system' as const,
            content: err.error || 'Agent failed to respond.',
            ts: new Date().toISOString(),
          }]);
          return;
        }

        const data = await res.json();
        processTurn(data.turn, data.agent_id);
      } catch {
        setMessages((prev) => [...prev, {
          role: 'system' as const,
          content: 'Agent failed to respond. Please try again.',
          ts: new Date().toISOString(),
        }]);
      } finally {
        setIsLoading(false);
      }
    },
    [planningTaskId, processTurn],
  );

  // Approve plan
  const handleApprove = useCallback(async () => {
    if (!planningTaskId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/routines/${planningTaskId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setPlanningTaskId(null);
        setMessages([]);
        setShowPlan(false);
        setPlanMarkdown(null);
        setShowCreate(false);
        await refreshRoutines();
      } else {
        setMessages((prev) => [...prev, {
          role: 'system' as const,
          content: data.error || 'Failed to approve routine.',
          ts: new Date().toISOString(),
        }]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: 'system' as const,
        content: 'Failed to approve routine. Please try again.',
        ts: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [planningTaskId]);

  // Cancel planning
  const handleCancel = useCallback(async () => {
    if (planningTaskId) {
      try {
        await fetch(`/api/tasks/${planningTaskId}/cancel`, { method: 'POST' });
      } catch { /* best effort */ }
    }
    setPlanningTaskId(null);
    setMessages([]);
    setShowPlan(false);
    setPlanMarkdown(null);
    setShowCreate(false);
  }, [planningTaskId]);

  // Routine actions
  async function handleToggle(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await fetch(`/api/routines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    await refreshRoutines();
  }

  async function handleTrigger(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/routines/${id}/trigger`, { method: 'POST' });
      if (res.ok) {
        const { taskId } = await res.json();
        alert(`Routine triggered! Task created: ${taskId}`);
      }
      await refreshRoutines();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete routine "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/routines/${id}`, { method: 'DELETE' });
    if (selectedRoutineId === id) setSelectedRoutineId(null);
    await refreshRoutines();
  }

  const inPlanning = planningTaskId !== null;
  const selectedRoutine = routines.find((r) => r.id === selectedRoutineId) ?? null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Routines</h1>
              <p className="text-sm text-slate-500">Scheduled recurring operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {inPlanning && (
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-500/10 border border-slate-500/20 hover:bg-slate-500/20 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" /> Cancel Planning
              </button>
            )}
            {!inPlanning && (
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sky-300 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition-colors cursor-pointer"
              >
                {showCreate ? (
                  <><X className="w-3 h-3" /> Cancel</>
                ) : (
                  <><Plus className="w-3 h-3" /> New Routine</>
                )}
              </button>
            )}
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
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-slate-400">Active</span>
          <span className="text-sm font-semibold text-white">
            {routines.filter((r) => r.status === 'active').length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-sm text-slate-400">Paused</span>
          <span className="text-sm font-semibold text-white">
            {routines.filter((r) => r.status === 'paused').length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-sm text-slate-400">Planning</span>
          <span className="text-sm font-semibold text-white">
            {routines.filter((r) => r.status === 'planning').length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="text-sm text-slate-400">Total</span>
          <span className="text-sm font-semibold text-white">{routines.length}</span>
        </div>
      </motion.div>

      {/* Create Form (collapsible) */}
      <AnimatePresence>
        {showCreate && !inPlanning && (
          <CreateRoutineForm
            onSubmit={handleCreateAndPlan}
            onCancel={() => setShowCreate(false)}
            loading={loading}
          />
        )}
      </AnimatePresence>

      {/* Main Content: Two-panel layout */}
      <div className="flex gap-6" style={{ minHeight: inPlanning ? 'calc(100vh - 280px)' : 'auto' }}>
        {/* Left Panel: Routine List */}
        <div className={`space-y-3 ${inPlanning ? 'w-[40%]' : 'w-full'} ${inPlanning ? 'max-h-[calc(100vh-280px)] overflow-y-auto pr-2' : ''}`}>
          {routines.length === 0 && !inPlanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-panel rounded-xl p-8 text-center"
            >
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No routines yet.</p>
              <p className="text-slate-600 text-xs mt-1">Create one to automate recurring tasks.</p>
            </motion.div>
          )}

          {routines.map((r, i) => (
            <RoutineCard
              key={r.id}
              routine={r}
              index={i}
              isSelected={selectedRoutineId === r.id}
              onSelect={() => setSelectedRoutineId(selectedRoutineId === r.id ? null : r.id)}
              onToggle={() => handleToggle(r.id, r.status)}
              onTrigger={() => handleTrigger(r.id)}
              onDelete={() => handleDelete(r.id, r.name)}
              loading={loading}
            />
          ))}
        </div>

        {/* Right Panel: Planning conversation or routine detail */}
        <AnimatePresence mode="wait">
          {inPlanning && (
            <motion.div
              key="planning-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="w-[60%] flex flex-col gap-4"
            >
              {/* Plan display (when ready) */}
              {showPlan && planMarkdown && (
                <InlinePlanDisplay
                  planMarkdown={planMarkdown}
                  onApprove={handleApprove}
                  isLoading={isLoading}
                />
              )}

              {/* Chat */}
              <div
                className="glass-panel rounded-xl flex-1 overflow-hidden flex flex-col"
                style={{ minHeight: showPlan ? '300px' : 'calc(100vh - 320px)' }}
              >
                <InlineChat
                  messages={messages}
                  onSend={handlePlanningMessage}
                  isLoading={isLoading}
                  activityText={activityText}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
