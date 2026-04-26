'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { marked } from 'marked';
import { motion } from 'motion/react';
import { ArrowLeft, Brain, Zap, ClipboardList, User, Activity } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentCard {
  agentId: string;
  name: string;
  department: string;
  role: string;
  description: string;
  tools: string[];
  skills: string[];
  avatarColor: string;
}

interface DeliverableRef {
  id: string;
  title: string;
}

interface TaskData {
  id: string;
  title: string;
  state: string;
  department: string;
  createdAt: string;
  deliverables: DeliverableRef[];
}

interface EmployeeData {
  id: string;
  name: string;
  role: string;
  department: string;
  status: string;
}

interface ActivityLogEntry {
  id: string;
  actionType: string;
  description: string | null;
  metadata: string | null;
  createdAt: string;
  taskId: string | null;
  agentId: string | null;
}

interface AgentData {
  card: AgentCard | null;
  memory: string;
  employee: EmployeeData | null;
  tasks: TaskData[];
  activityLog: ActivityLogEntry[];
}

// ── Color configs ────────────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, string> = {
  tech: 'bg-blue-500',
  marketing: 'bg-purple-500',
  operations: 'bg-emerald-500',
  global: 'bg-rose-500',
};

const DEPT_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  tech:       { bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/25' },
  marketing:  { bg: 'bg-purple-500/15',  text: 'text-purple-400',  border: 'border-purple-500/25' },
  operations: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25' },
  global:     { bg: 'bg-rose-500/15',    text: 'text-rose-400',    border: 'border-rose-500/25' },
};

const TYPE_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  executive: { bg: 'bg-amber-500/15',  text: 'text-amber-400',  border: 'border-amber-500/25' },
  permanent: { bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/25' },
  temp:      { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/25' },
};

const STATE_BADGE: Record<string, { bg: string; text: string }> = {
  completed: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  working:   { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
  submitted: { bg: 'bg-sky-500/15',     text: 'text-sky-400' },
  failed:    { bg: 'bg-rose-500/15',    text: 'text-rose-400' },
  canceled:  { bg: 'bg-slate-500/15',   text: 'text-slate-400' },
  'input-required': { bg: 'bg-violet-500/15', text: 'text-violet-400' },
};

const ACTION_TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  SDK_SESSION_INIT:    { bg: 'bg-sky-500/15',     text: 'text-sky-400' },
  SDK_TOOL_CALL:       { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
  SDK_TOOL_PROGRESS:   { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
  SDK_TOOL_SUMMARY:    { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
  SDK_ASSISTANT:       { bg: 'bg-violet-500/15',   text: 'text-violet-400' },
  SDK_RESULT_SUCCESS:  { bg: 'bg-emerald-500/15',  text: 'text-emerald-400' },
  SDK_RESULT_ERROR:    { bg: 'bg-rose-500/15',     text: 'text-rose-400' },
  TASK_TRANSITION:     { bg: 'bg-emerald-500/15',  text: 'text-emerald-400' },
  WORKER_CLAIM:        { bg: 'bg-blue-500/15',     text: 'text-blue-400' },
};

function groupLogByTask(entries: ActivityLogEntry[]): { taskId: string | null; entries: ActivityLogEntry[] }[] {
  const groups: { taskId: string | null; entries: ActivityLogEntry[] }[] = [];
  let current: { taskId: string | null; entries: ActivityLogEntry[] } | null = null;

  for (const entry of entries) {
    if (!current || current.taskId !== entry.taskId) {
      current = { taskId: entry.taskId, entries: [entry] };
      groups.push(current);
    } else {
      current.entries.push(entry);
    }
  }

  return groups;
}

function parseMetadataSummary(metadata: string | null): string {
  if (!metadata) return '';
  try {
    const parsed = JSON.parse(metadata);
    if (parsed.toolName) return parsed.toolName;
    if (parsed.description) return parsed.description;
    if (parsed.tool_name) return parsed.tool_name;
    if (typeof parsed === 'string') return parsed;
    return '';
  } catch {
    return '';
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    fetch(`/api/agents/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  function renderMarkdown(md: string): string {
    return marked.parse(md, { async: false }) as string;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500 text-[13px]">Loading agent profile...</div>
        </div>
      </AppShell>
    );
  }

  if (!data || (!data.card && !data.employee)) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Link
            href="/agents"
            className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Agents
          </Link>
          <div className="text-center py-20 text-slate-500 text-[13px]">Agent not found.</div>
        </div>
      </AppShell>
    );
  }

  const card = data.card;
  const emp = data.employee;
  const name = card?.name || emp?.name || id;
  const dept = card?.department || emp?.department || 'global';
  const role = card?.role || emp?.role || '';
  const deptColor = DEPT_COLORS[dept] ?? 'bg-slate-500';
  const deptBadge = DEPT_BADGE[dept] ?? { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/25' };
  const typeBadge = TYPE_BADGE[role] ?? { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/25' };
  const initials = name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        {/* Back button */}
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Agents
        </Link>

        {/* ── Profile Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="glass-card rounded-xl p-6"
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-full ${deptColor} flex items-center justify-center text-[22px] font-bold text-white shrink-0`}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[22px] font-bold text-white mb-1">{name}</h1>
              {card?.description && (
                <p className="text-[12px] text-slate-400 mb-2">{card.description}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`glass-pill text-[10px] px-2 py-0.5 rounded-md font-medium border ${deptBadge.bg} ${deptBadge.border} ${deptBadge.text}`}
                >
                  {dept}
                </span>
                <span
                  className={`glass-pill text-[10px] px-2 py-0.5 rounded-md font-medium border ${typeBadge.bg} ${typeBadge.border} ${typeBadge.text}`}
                >
                  {role}
                </span>
                {emp?.status && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                      emp.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                    }`}
                  >
                    {emp.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Skills ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="glass-card rounded-xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-amber-400" />
            <h2 className="text-[14px] font-bold text-white">Skills</h2>
          </div>
          {card?.skills && card.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {card.skills.map((skill) => (
                <span
                  key={skill}
                  className="glass-pill text-[11px] px-3 py-1 rounded-lg font-medium text-slate-300"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-slate-600 italic">No skills configured</p>
          )}

          {/* Tools */}
          {card?.tools && card.tools.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">
                Tools
              </p>
              <div className="flex flex-wrap gap-2">
                {card.tools.map((tool) => (
                  <span
                    key={tool}
                    className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Memory ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.16 }}
          className="glass-card rounded-xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Brain size={14} className="text-violet-400" />
            <h2 className="text-[14px] font-bold text-white">Memory</h2>
          </div>
          {data.memory ? (
            <div
              className="prose prose-invert prose-sm max-w-none text-[12px] text-slate-300 leading-relaxed
                [&_h1]:text-[16px] [&_h1]:text-white [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                [&_h2]:text-[14px] [&_h2]:text-white [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5
                [&_h3]:text-[13px] [&_h3]:text-slate-200 [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4
                [&_li]:mb-0.5
                [&_code]:bg-white/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_code]:text-sky-300
                [&_pre]:bg-white/[0.03] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto
                [&_a]:text-sky-400 [&_a]:no-underline hover:[&_a]:underline
                [&_blockquote]:border-l-2 [&_blockquote]:border-white/10 [&_blockquote]:pl-3 [&_blockquote]:text-slate-400
              "
              dangerouslySetInnerHTML={{ __html: renderMarkdown(data.memory) }}
            />
          ) : (
            <p className="text-[12px] text-slate-600 italic">No memory entries</p>
          )}
        </motion.div>

        {/* ── Recent Tasks ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.24 }}
          className="glass-card rounded-xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList size={14} className="text-sky-400" />
            <h2 className="text-[14px] font-bold text-white">Recent Tasks</h2>
            {data.tasks.length > 0 && (
              <span className="text-[10px] text-slate-600 ml-1">{data.tasks.length}</span>
            )}
          </div>
          {data.tasks.length === 0 ? (
            <p className="text-[12px] text-slate-600 italic">No tasks yet</p>
          ) : (
            <div className="space-y-1">
              {data.tasks.map((task) => {
                const stateBadge = STATE_BADGE[task.state] ?? {
                  bg: 'bg-slate-500/15',
                  text: 'text-slate-400',
                };
                const taskDeptBadge = DEPT_BADGE[task.department] ?? {
                  bg: 'bg-slate-500/15',
                  text: 'text-slate-400',
                  border: 'border-slate-500/25',
                };

                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-white/[0.03] group"
                    style={{ border: '1px solid transparent' }}
                  >
                    <span className="text-[12px] font-medium text-slate-300 flex-1 truncate group-hover:text-white transition-colors">
                      {task.title}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${stateBadge.bg} ${stateBadge.text}`}
                    >
                      {task.state}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 border ${taskDeptBadge.bg} ${taskDeptBadge.border} ${taskDeptBadge.text}`}
                    >
                      {task.department}
                    </span>
                    <span className="text-[10px] text-slate-600 shrink-0">
                      {formatDate(task.createdAt)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Activity Log ── */}
        {data.activityLog && data.activityLog.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.32 }}
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity size={14} className="text-cyan-400" />
              <h2 className="text-[14px] font-bold text-white">Activity Log</h2>
              <span className="text-[10px] text-slate-600 ml-1">{data.activityLog.length}</span>
            </div>
            <div className="space-y-3">
              {groupLogByTask(data.activityLog).map((group, gi) => {
                const taskTitle = group.taskId
                  ? data.tasks.find((t) => t.id === group.taskId)?.title || group.taskId.slice(0, 12)
                  : 'System';

                return (
                  <div
                    key={`group-${gi}`}
                    className="glass-card rounded-lg p-4 border-l-2 border-sky-500/30"
                  >
                    <p className="text-[11px] font-medium text-slate-400 mb-2 truncate">
                      {taskTitle}
                    </p>
                    <div className="space-y-1.5">
                      {group.entries.map((entry) => {
                        const badge = ACTION_TYPE_BADGE[entry.actionType] ?? { bg: 'bg-slate-500/15', text: 'text-slate-400' };
                        const summary = entry.description || parseMetadataSummary(entry.metadata);

                        return (
                          <div key={entry.id} className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-600 shrink-0 w-[70px]">
                              {new Date(entry.createdAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false,
                              })}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${badge.bg} ${badge.text}`}
                            >
                              {entry.actionType}
                            </span>
                            {summary && (
                              <span className="text-[11px] text-slate-400 truncate">
                                {summary}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
