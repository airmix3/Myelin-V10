'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, DollarSign, AlertTriangle, Package, MessageSquare,
  Target, Clock, FileText, FileCode, Image, Film, Send,
  CheckCircle2, XCircle, ChevronRight, User,
} from 'lucide-react';
import ChatThread, { type ChatMessage } from '@/components/tamir/ChatThread';
import ChatInput from '@/components/tamir/ChatInput';
import { useSSE } from '@/components/useSSE';

// ── Types ───────────────────────────────────────────────────────────────────────

interface TaskDeliverable {
  id: string;
  title: string;
  type: string | null;
  status: string;
  primaryFile: string | null;
  createdAt: string;
}

interface TaskEscalation {
  id: string;
  agentId: string;
  type: string;
  urgency: string;
  status: string;
  summary: string;
  createdAt: string;
}

interface TaskHireRequest {
  id: string;
  requestedBy: string;
  employeeName: string;
  employeeRole: string;
  justification: string | null;
  status: string;
  createdAt: string;
}

interface TaskExecutor {
  id: string;
  name: string;
  role: string;
  department: string;
  agentId: string | null;
}

interface ActiveTask {
  id: string;
  title: string;
  description: string | null;
  department: string;
  state: string;
  metadata: string | null;
  currentActorId: string | null;
  planMarkdown: string | null;
  createdAt: string;
  updatedAt: string;
  taskRuns: Array<{
    id: string;
    status: string;
    employeeId: string;
    createdAt: string;
    claimedAt: string | null;
  }>;
  deliverables: TaskDeliverable[];
  escalations: TaskEscalation[];
  hireRequests: TaskHireRequest[];
  budgetUsed: number;
  budgetLimit: number;
  executor: TaskExecutor | null;
}

interface WorkspaceClientProps {
  activeTasks: ActiveTask[];
}

// ── Constants ───────────────────────────────────────────────────────────────────

const deptColors: Record<string, string> = {
  tech: '#38bdf8',
  marketing: '#a78bfa',
  operations: '#34d399',
  cos: '#f59e0b',
  global: '#64748b',
};

const urgencyConfig: Record<string, { color: string; label: string }> = {
  low: { color: '#64748b', label: 'L1' },
  normal: { color: '#38bdf8', label: 'L2' },
  high: { color: '#f59e0b', label: 'L3' },
  critical: { color: '#f43f5e', label: 'L4' },
};

const deliverableIcons: Record<string, React.ElementType> = {
  document: FileText,
  code: FileCode,
  image: Image,
  video: Film,
  analysis: FileText,
  report: FileText,
};

const deliverableStatusStyle: Record<string, { bg: string; color: string; label: string }> = {
  'in-progress': { bg: 'rgba(56,189,248,0.12)', color: '#7dd3fc', label: 'In Progress' },
  completed: { bg: 'rgba(52,211,153,0.12)', color: '#6ee7b7', label: 'Ready' },
  reviewed: { bg: 'rgba(167,139,250,0.15)', color: '#c4b5fd', label: 'Approved' },
};

// ── Activity Log Entry ──────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string;
  actionType: string;
  description: string;
  timestamp: string;
}

function activityColor(actionType: string): string {
  if (actionType.includes('TOOL')) return '#38bdf8';
  if (actionType.includes('ERROR') || actionType.includes('FAIL')) return '#f43f5e';
  return '#94a3b8';
}

// ── Tab Component ───────────────────────────────────────────────────────────────

function TaskTab({
  task,
  isActive,
  onClick,
}: {
  task: ActiveTask;
  isActive: boolean;
  onClick: () => void;
}) {
  const color = deptColors[task.department] || deptColors.global;
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="shrink-0 flex items-center gap-2.5 px-3.5 py-2 rounded-lg cursor-pointer transition-all"
      style={{
        background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
        border: isActive ? `1px solid ${color}40` : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isActive ? `0 0 12px ${color}15` : 'none',
      }}
    >
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span
        className={`text-[12px] font-medium truncate max-w-[140px] ${isActive ? 'text-white' : 'text-slate-400'}`}
      >
        {task.title}
      </span>
      <span
        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
        style={{ background: `${color}15`, color }}
      >
        {task.department}
      </span>
    </motion.button>
  );
}

// ── Deliverable Card ────────────────────────────────────────────────────────────

function DeliverableCard({ d }: { d: TaskDeliverable }) {
  const Icon = deliverableIcons[d.type || ''] || FileText;
  const st = deliverableStatusStyle[d.status] || deliverableStatusStyle['in-progress'];
  return (
    <a
      href={`/deliverables/${d.id}`}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all hover:brightness-110 cursor-pointer"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: st.bg }}
      >
        <Icon size={14} style={{ color: st.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-slate-200 truncate">{d.title}</p>
        <span className="text-[9px] text-slate-600">
          {new Date(d.createdAt).toLocaleDateString()}
        </span>
      </div>
      <span
        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
        style={{ background: st.bg, color: st.color }}
      >
        {st.label}
      </span>
    </a>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────

export default function WorkspaceClient({ activeTasks }: WorkspaceClientProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    activeTasks[0]?.id ?? null,
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const activityEndRef = useRef<HTMLDivElement>(null);

  const selectedTask = activeTasks.find((t) => t.id === selectedTaskId) ?? null;

  // ── Fetch chat history when task changes ──────────────────────────────────
  useEffect(() => {
    if (!selectedTaskId) {
      setChatMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tasks/${selectedTaskId}/chat`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const msgs: ChatMessage[] = (data.messages ?? []).map(
          (m: Record<string, unknown>, i: number) => ({
            id: String(m.id ?? `chat-${i}`),
            role: m.role === 'user' ? 'user' : 'assistant',
            content: String(m.content ?? ''),
            agentId: m.agentId ? String(m.agentId) : undefined,
            timestamp: m.timestamp ? String(m.timestamp) : undefined,
          }),
        );
        setChatMessages(msgs);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTaskId]);

  // ── Fetch activity log ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedTaskId) {
      setActivityLog([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tasks/${selectedTaskId}/activity`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setActivityLog(
          (data.entries ?? []).map((e: Record<string, unknown>) => ({
            id: String(e.id ?? ''),
            actionType: String(e.actionType ?? ''),
            description: String(e.description ?? ''),
            timestamp: String(e.createdAt ?? ''),
          })),
        );
      } catch {
        /* ignore - API may not exist yet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTaskId]);

  // ── SSE for live activity updates ─────────────────────────────────────────
  useSSE({
    'task:buildlog': useCallback(
      (data: Record<string, unknown>) => {
        if (data.taskId !== selectedTaskId) return;
        setActivityLog((prev) => [
          ...prev,
          {
            id: `sse-${Date.now()}`,
            actionType: String(data.actionType ?? 'SDK_TOOL_PROGRESS'),
            description: String(data.description ?? data.content ?? ''),
            timestamp: new Date().toISOString(),
          },
        ]);
      },
      [selectedTaskId],
    ),
    'task:activity': useCallback(
      (data: Record<string, unknown>) => {
        if (data.taskId !== selectedTaskId) return;
        setActivityLog((prev) => [
          ...prev,
          {
            id: `sse-${Date.now()}`,
            actionType: String(data.actionType ?? ''),
            description: String(data.description ?? ''),
            timestamp: new Date().toISOString(),
          },
        ]);
      },
      [selectedTaskId],
    ),
  });

  // Auto-scroll activity log
  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activityLog.length]);

  // ── Send chat message ─────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedTaskId) return;
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, userMsg]);
      setChatLoading(true);
      try {
        const res = await fetch(`/api/tasks/${selectedTaskId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, role: 'user' }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.reply) {
            setChatMessages((prev) => [
              ...prev,
              {
                id: `agent-${Date.now()}`,
                role: 'assistant',
                content: data.reply,
                agentId: selectedTask?.executor?.agentId ?? undefined,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        }
      } catch {
        /* ignore */
      } finally {
        setChatLoading(false);
      }
    },
    [selectedTaskId, selectedTask?.executor?.agentId],
  );

  // ── Hire request actions ──────────────────────────────────────────────────
  const handleHireApprove = useCallback(async (hireRequestId: string) => {
    try {
      await fetch(`/api/hire_requests/${hireRequestId}/approve`, { method: 'POST' });
    } catch {
      /* ignore */
    }
  }, []);

  const handleHireReject = useCallback(async (hireRequestId: string) => {
    try {
      await fetch(`/api/hire_requests/${hireRequestId}/reject`, { method: 'POST' });
    } catch {
      /* ignore */
    }
  }, []);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (activeTasks.length === 0 || !selectedTask) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="glass-card px-8 py-10 flex flex-col items-center gap-4 max-w-md text-center"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(100,116,139,0.15)',
              border: '1px solid rgba(100,116,139,0.20)',
            }}
          >
            <Target className="w-6 h-6 text-slate-500" />
          </div>
          <h2 className="text-lg font-bold text-white">No active tasks</h2>
          <p className="text-sm text-slate-400">
            Approve a plan to start execution. Active tasks will appear here
            with real-time monitoring.
          </p>
        </motion.div>
      </div>
    );
  }

  const budgetPct =
    selectedTask.budgetLimit > 0
      ? (selectedTask.budgetUsed / selectedTask.budgetLimit) * 100
      : 0;
  const budgetColor =
    budgetPct > 80 ? '#f43f5e' : budgetPct > 50 ? '#f59e0b' : '#34d399';

  const hasPendingDecisions =
    selectedTask.hireRequests.length > 0 || selectedTask.escalations.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Tab bar ── */}
      <div
        className="shrink-0 flex items-center gap-2 px-5 py-2.5 overflow-x-auto"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          scrollbarWidth: 'none',
        }}
      >
        <div className="flex items-center gap-1.5 shrink-0 mr-2">
          <Target size={13} className="text-sky-400" />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Active Tasks
          </span>
        </div>
        <div
          className="w-px h-5 shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        />
        {activeTasks.map((task) => (
          <TaskTab
            key={task.id}
            task={task}
            isActive={task.id === selectedTaskId}
            onClick={() => setSelectedTaskId(task.id)}
          />
        ))}
      </div>

      {/* ── 3-Column Layout ── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* ════════════ LEFT: Context Panel ════════════ */}
        <div
          className="shrink-0 flex flex-col overflow-y-auto lg:w-[22%] lg:min-w-[240px] lg:max-w-[320px]"
          style={{
            background: 'rgba(6,10,24,0.60)',
            backdropFilter: 'blur(20px) saturate(140%)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            scrollbarWidth: 'none',
          }}
        >
          {/* Task Description */}
          <div
            className="px-4 pt-4 pb-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h2 className="text-[15px] font-bold text-white leading-snug mb-1.5">
              {selectedTask.title}
            </h2>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {selectedTask.description || 'No description provided.'}
            </p>
          </div>

          {/* Owner */}
          <div
            className="px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p className="text-[9px] text-slate-600 uppercase tracking-wider font-medium mb-2">
              Executor
            </p>
            {selectedTask.executor ? (
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                  style={{
                    background:
                      deptColors[selectedTask.executor.department] ||
                      deptColors.global,
                  }}
                >
                  {selectedTask.executor.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-white">
                    {selectedTask.executor.name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {selectedTask.executor.role} &middot;{' '}
                    {selectedTask.executor.department}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500">
                <User size={14} />
                <span className="text-[11px]">Unassigned</span>
              </div>
            )}
          </div>

          {/* Open Escalations */}
          <div
            className="px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={10} className="text-slate-500" />
              <p className="text-[9px] text-slate-600 uppercase tracking-wider font-medium">
                Open Escalations
              </p>
            </div>
            {selectedTask.escalations.length > 0 ? (
              <div className="space-y-1.5">
                {selectedTask.escalations.map((esc) => {
                  const urg =
                    urgencyConfig[esc.urgency] || urgencyConfig.normal;
                  return (
                    <div
                      key={esc.id}
                      className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
                      style={{
                        background: `${urg.color}10`,
                        border: `1px solid ${urg.color}25`,
                      }}
                    >
                      <span
                        className="text-[8px] font-bold px-1 py-0.5 rounded shrink-0"
                        style={{
                          background: `${urg.color}20`,
                          color: urg.color,
                        }}
                      >
                        {urg.label}
                      </span>
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        {esc.summary}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-slate-600">
                No open escalations
              </p>
            )}
          </div>

          {/* Budget */}
          <div
            className="px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign size={10} className="text-slate-500" />
              <p className="text-[9px] text-slate-600 uppercase tracking-wider font-medium">
                Budget
              </p>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div>
                <p className="text-[10px] text-slate-500">Used</p>
                <p className="text-[13px] font-bold text-white">
                  ${selectedTask.budgetUsed.toFixed(2)}
                </p>
              </div>
              <ChevronRight size={10} className="text-slate-600" />
              <div>
                <p className="text-[10px] text-slate-500">Projected</p>
                <p className="text-[13px] font-bold text-slate-500">N/A</p>
              </div>
              <div className="ml-auto">
                <p className="text-[10px] text-slate-500">Limit</p>
                <p className="text-[13px] font-bold text-slate-400">
                  ${selectedTask.budgetLimit.toFixed(2)}
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(budgetPct, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ background: budgetColor }}
              />
            </div>
            <p className="text-[9px] text-slate-600 mt-1">
              {budgetPct.toFixed(0)}% of limit
            </p>
          </div>

          {/* Activity Log */}
          <div className="px-4 py-3 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={10} className="text-slate-500" />
              <p className="text-[9px] text-slate-600 uppercase tracking-wider font-medium">
                Activity
              </p>
            </div>
            <div
              className="flex-1 overflow-y-auto space-y-0"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.08) transparent',
              }}
            >
              {activityLog.length === 0 ? (
                <p className="text-[10px] text-slate-600">
                  No activity yet
                </p>
              ) : (
                activityLog.map((entry, i) => (
                  <div key={entry.id} className="flex items-start gap-2.5 py-1.5">
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1"
                        style={{
                          background:
                            i === activityLog.length - 1
                              ? activityColor(entry.actionType)
                              : '#334155',
                        }}
                      />
                      {i < activityLog.length - 1 && (
                        <div
                          className="w-px flex-1 mt-0.5"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            minHeight: '16px',
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[10px] leading-relaxed"
                        style={{ color: activityColor(entry.actionType) }}
                      >
                        {entry.description || entry.actionType}
                      </p>
                      <span className="text-[9px] text-slate-600">
                        {entry.timestamp
                          ? new Date(entry.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={activityEndRef} />
            </div>
          </div>
        </div>

        {/* ════════════ CENTER: Execution Panel ════════════ */}
        <div
          className="flex-1 min-w-0 flex flex-col overflow-y-auto p-5 gap-5"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.08) transparent',
          }}
        >
          {/* CEO Decisions — conditional */}
          <AnimatePresence>
            {hasPendingDecisions && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <p className="text-[9px] text-slate-600 uppercase tracking-wider font-medium">
                  Pending Decisions
                </p>

                {/* Hire Requests */}
                {selectedTask.hireRequests.map((hr) => (
                  <div
                    key={hr.id}
                    className="rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(56,189,248,0.06)',
                      border: '1px solid rgba(56,189,248,0.20)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[12px] font-medium text-white">
                          Hire Request: {hr.employeeName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Role: {hr.employeeRole} &middot; Requested by:{' '}
                          {hr.requestedBy}
                        </p>
                      </div>
                    </div>
                    {hr.justification && (
                      <p className="text-[10px] text-slate-400 mb-3">
                        {hr.justification}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleHireApprove(hr.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-emerald-400 transition-all hover:brightness-125"
                        style={{
                          background: 'rgba(52,211,153,0.12)',
                          border: '1px solid rgba(52,211,153,0.25)',
                        }}
                      >
                        <CheckCircle2 size={12} />
                        Approve
                      </button>
                      <button
                        onClick={() => handleHireReject(hr.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-rose-400 transition-all hover:brightness-125"
                        style={{
                          background: 'rgba(244,63,94,0.12)',
                          border: '1px solid rgba(244,63,94,0.25)',
                        }}
                      >
                        <XCircle size={12} />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}

                {/* Escalation decisions that need CEO response */}
                {selectedTask.escalations
                  .filter((e) => e.type === 'budget_increase')
                  .map((esc) => (
                    <div
                      key={esc.id}
                      className="rounded-xl px-4 py-3"
                      style={{
                        background: 'rgba(245,158,11,0.06)',
                        border: '1px solid rgba(245,158,11,0.20)',
                      }}
                    >
                      <p className="text-[12px] font-medium text-white mb-1">
                        Budget Increase Request
                      </p>
                      <p className="text-[10px] text-slate-400 mb-2">
                        {esc.summary}
                      </p>
                      <button
                        onClick={async () => {
                          try {
                            await fetch(
                              `/api/tasks/${selectedTask.id}/budget`,
                              {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ maxBudgetUsd: 10 }),
                              },
                            );
                          } catch {
                            /* ignore */
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-amber-400 transition-all hover:brightness-125"
                        style={{
                          background: 'rgba(245,158,11,0.12)',
                          border: '1px solid rgba(245,158,11,0.25)',
                        }}
                      >
                        <DollarSign size={12} />
                        Approve Increase
                      </button>
                    </div>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agent Card */}
          {selectedTask.executor && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl px-4 py-4"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <p className="text-[9px] text-slate-600 uppercase tracking-wider font-medium mb-3">
                Executor Agent
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white"
                  style={{
                    background:
                      deptColors[selectedTask.executor.department] ||
                      deptColors.global,
                    boxShadow: `0 0 12px ${deptColors[selectedTask.executor.department] || deptColors.global}30`,
                  }}
                >
                  {selectedTask.executor.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-white">
                    {selectedTask.executor.name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {selectedTask.executor.department} &middot;{' '}
                    {selectedTask.executor.role}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-emerald-400"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="text-[10px] font-medium text-emerald-400">
                    Executing
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Deliverables */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Package size={12} className="text-slate-500" />
              <p className="text-[9px] text-slate-600 uppercase tracking-wider font-medium">
                Deliverables
              </p>
              <span className="text-[9px] text-slate-600 ml-1">
                ({selectedTask.deliverables.length})
              </span>
            </div>
            {selectedTask.deliverables.length > 0 ? (
              <div className="space-y-2">
                {selectedTask.deliverables.map((d) => (
                  <DeliverableCard key={d.id} d={d} />
                ))}
              </div>
            ) : (
              <div
                className="rounded-lg px-4 py-6 text-center"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <Package
                  size={20}
                  className="text-slate-600 mx-auto mb-2"
                />
                <p className="text-[11px] text-slate-500">
                  No deliverables yet
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ════════════ RIGHT: Chat Panel ════════════ */}
        <div
          className="shrink-0 flex flex-col lg:w-[28%] lg:min-w-[260px] lg:max-w-[400px]"
          style={{
            background: 'rgba(6,10,24,0.40)',
            backdropFilter: 'blur(12px) saturate(130%)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Chat Header */}
          <div
            className="shrink-0 px-4 py-3 flex items-center gap-2"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <MessageSquare size={13} className="text-sky-400" />
            <span className="text-[11px] font-medium text-white">
              Chat with Executor
            </span>
            {selectedTask.executor && (
              <span className="text-[10px] text-slate-500">
                &middot; {selectedTask.executor.name}
              </span>
            )}
          </div>

          {/* Chat Thread */}
          <ChatThread
            messages={chatMessages}
            loading={chatLoading}
          />

          {/* Chat Input */}
          <ChatInput
            onSend={handleSendMessage}
            disabled={chatLoading}
            placeholder={`Message ${selectedTask.executor?.name ?? 'executor'}...`}
          />
        </div>
      </div>
    </div>
  );
}
