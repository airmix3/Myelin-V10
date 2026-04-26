'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Terminal, Activity } from 'lucide-react';
import { useSSE } from '@/components/useSSE';

/* ── Types ── */

interface OrgActiveTask {
  taskId: string;
  title: string;
  state: string;
}

interface OrgNode {
  id: string;
  name: string;
  role: string;
  department: string;
  agentId: string | null;
  status: string;
  activeTasks: OrgActiveTask[];
}

interface AgentLane {
  agentId: string;
  name: string;
  department: string;
  status: 'working' | 'idle';
  activeTasks: { taskId: string; title: string; state: string }[];
  logs: LaneLogEntry[];
}

interface LaneLogEntry {
  id: string;
  taskId: string;
  source: 'build' | 'activity';
  type: string;
  content: string;
  timestamp: Date;
}

/* ── Constants ── */

const AGENT_DEFS: Record<string, { label: string; color: string; dotClass: string; borderAccent: string }> = {
  tamir: { label: 'Tamir', color: 'text-amber-400', dotClass: 'bg-amber-400', borderAccent: 'rgba(251,191,36,0.3)' },
  cto: { label: 'CTO', color: 'text-blue-400', dotClass: 'bg-blue-400', borderAccent: 'rgba(96,165,250,0.3)' },
  cmo: { label: 'CMO', color: 'text-purple-400', dotClass: 'bg-purple-400', borderAccent: 'rgba(167,139,250,0.3)' },
  coo: { label: 'COO', color: 'text-emerald-400', dotClass: 'bg-emerald-400', borderAccent: 'rgba(52,211,153,0.3)' },
};

const MAX_LANE_LOGS = 300;

let logIdCounter = 0;
function nextLogId(): string {
  return `log-${++logIdCounter}-${Date.now()}`;
}

/* ── Helpers ── */

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function eventTypeBadge(type: string, source: 'build' | 'activity'): { label: string; className: string } {
  if (source === 'activity') {
    return { label: 'LOG', className: 'text-teal-400 bg-teal-500/10 border-teal-500/20' };
  }
  switch (type) {
    case 'tool_call':
      return { label: 'CALL', className: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    case 'tool_activity':
      return { label: 'ACT', className: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    case 'tool_summary':
      return { label: 'DONE', className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    default:
      return { label: type.toUpperCase().slice(0, 4), className: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
  }
}

function stateBadgeColor(state: string): string {
  switch (state) {
    case 'working': return '#ffb347';
    case 'completed': return '#00d68f';
    case 'failed': return '#e94560';
    default: return '#64748b';
  }
}

/* ── Component ── */

export default function TerminalClient() {
  const lanesRef = useRef<Map<string, AgentLane>>(new Map());
  const taskToAgentRef = useRef<Map<string, string>>(new Map());
  const [lanes, setLanes] = useState<AgentLane[]>([]);
  const scrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isUserScrolling = useRef<Set<string>>(new Set());

  // Fetch org-graph on mount to get initial agent/task state
  useEffect(() => {
    async function fetchOrgGraph() {
      try {
        const res = await fetch('/api/org-graph');
        const data = await res.json();
        if (!data.nodes) return;

        const newLanes = new Map<string, AgentLane>();
        const taskMap = new Map<string, string>();

        for (const node of data.nodes as OrgNode[]) {
          const agentId = node.agentId;
          if (!agentId || !AGENT_DEFS[agentId]) continue;

          const hasWorking = node.activeTasks.some((t: OrgActiveTask) => t.state === 'working');
          newLanes.set(agentId, {
            agentId,
            name: AGENT_DEFS[agentId].label,
            department: node.department,
            status: hasWorking ? 'working' : 'idle',
            activeTasks: node.activeTasks.map((t: OrgActiveTask) => ({
              taskId: t.taskId,
              title: t.title,
              state: t.state,
            })),
            logs: [],
          });

          for (const task of node.activeTasks) {
            taskMap.set(task.taskId, agentId);
          }
        }

        // Ensure all known agents have lanes
        for (const [id, def] of Object.entries(AGENT_DEFS)) {
          if (!newLanes.has(id)) {
            newLanes.set(id, {
              agentId: id,
              name: def.label,
              department: '',
              status: 'idle',
              activeTasks: [],
              logs: [],
            });
          }
        }

        lanesRef.current = newLanes;
        taskToAgentRef.current = taskMap;
        setLanes(Array.from(newLanes.values()));
      } catch {
        // Initialize empty lanes for all agents on error
        const newLanes = new Map<string, AgentLane>();
        for (const [id, def] of Object.entries(AGENT_DEFS)) {
          newLanes.set(id, {
            agentId: id,
            name: def.label,
            department: '',
            status: 'idle',
            activeTasks: [],
            logs: [],
          });
        }
        lanesRef.current = newLanes;
        setLanes(Array.from(newLanes.values()));
      }
    }
    fetchOrgGraph();
  }, []);

  // SSE handlers
  const handleBuildLog = useCallback((data: Record<string, unknown>) => {
    const d = data as unknown as { taskId: string; event: { type: string; agentId: string; tool_name?: string; summary?: string; elapsed_time_seconds?: number } };
    const taskId = d.taskId;
    const evt = d.event;
    if (!taskId || !evt) return;

    // Determine agentId from event or task mapping
    const agentId = evt.agentId || taskToAgentRef.current.get(taskId);
    if (!agentId || !AGENT_DEFS[agentId]) return;

    // Build content string
    let content = '';
    if (evt.type === 'tool_call') {
      content = `Calling ${evt.tool_name ?? 'unknown'}`;
    } else if (evt.type === 'tool_summary') {
      content = `${evt.summary ?? ''}${evt.elapsed_time_seconds != null ? ` (${evt.elapsed_time_seconds}s)` : ''}`;
    } else {
      content = evt.summary ?? '';
    }
    if (!content) return;

    const entry: LaneLogEntry = {
      id: nextLogId(),
      taskId,
      source: 'build',
      type: evt.type || 'unknown',
      content,
      timestamp: new Date(),
    };

    const lane = lanesRef.current.get(agentId);
    if (lane) {
      lane.logs = [...lane.logs.slice(-(MAX_LANE_LOGS - 1)), entry];
      if (lane.status !== 'working') lane.status = 'working';
      setLanes(Array.from(lanesRef.current.values()));
    }

    // Update task mapping if new
    if (!taskToAgentRef.current.has(taskId)) {
      taskToAgentRef.current.set(taskId, agentId);
    }
  }, []);

  const handleActivity = useCallback((data: Record<string, unknown>) => {
    const d = data as unknown as { taskId: string; actionType: string; description: string };
    const taskId = d.taskId;
    if (!taskId) return;

    // Skip unhelpful entries
    if (d.actionType === 'SDK_ASSISTANT' && (!d.description || d.description === 'Assistant message')) return;

    const agentId = taskToAgentRef.current.get(taskId);
    if (!agentId || !AGENT_DEFS[agentId]) return;

    const entry: LaneLogEntry = {
      id: nextLogId(),
      taskId,
      source: 'activity',
      type: d.actionType || 'activity',
      content: d.description || d.actionType || 'activity',
      timestamp: new Date(),
    };

    const lane = lanesRef.current.get(agentId);
    if (lane) {
      lane.logs = [...lane.logs.slice(-(MAX_LANE_LOGS - 1)), entry];
      setLanes(Array.from(lanesRef.current.values()));
    }
  }, []);

  useSSE({
    'task:buildlog': handleBuildLog,
    'task:activity': handleActivity,
  });

  // Auto-scroll each lane independently
  useEffect(() => {
    for (const [agentId, el] of scrollRefs.current.entries()) {
      if (!isUserScrolling.current.has(agentId)) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [lanes]);

  const handleLaneScroll = useCallback((agentId: string) => {
    const el = scrollRefs.current.get(agentId);
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom) {
      isUserScrolling.current.delete(agentId);
    } else {
      isUserScrolling.current.add(agentId);
    }
  }, []);

  const setScrollRef = useCallback((agentId: string, el: HTMLDivElement | null) => {
    if (el) {
      scrollRefs.current.set(agentId, el);
    } else {
      scrollRefs.current.delete(agentId);
    }
  }, []);

  // Summary stats
  const workingCount = lanes.filter(l => l.status === 'working').length;
  const activeTaskCount = lanes.reduce((sum, l) => sum + l.activeTasks.length, 0);

  // Sort: working agents first, then by agent order
  const agentOrder = ['tamir', 'cto', 'cmo', 'coo'];
  const sortedLanes = [...lanes].sort((a, b) => {
    if (a.status === 'working' && b.status !== 'working') return -1;
    if (a.status !== 'working' && b.status === 'working') return 1;
    return agentOrder.indexOf(a.agentId) - agentOrder.indexOf(b.agentId);
  });

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Terminal className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Terminal</h1>
              <p className="text-sm text-slate-500">Real-time agent execution logs</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Summary bar */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
              {workingCount > 0 && (
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
                </div>
              )}
              <span className="text-xs text-slate-400">
                <span className="text-white font-semibold">{workingCount}</span> agent{workingCount !== 1 ? 's' : ''} working,{' '}
                <span className="text-white font-semibold">{activeTaskCount}</span> active task{activeTaskCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Connected indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
              </div>
              <span className="text-xs text-slate-400">Connected</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Agent lanes grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedLanes.map((lane, index) => {
          const def = AGENT_DEFS[lane.agentId];
          if (!def) return null;
          const isWorking = lane.status === 'working';
          const hasLogs = lane.logs.length > 0;

          return (
            <motion.div
              key={lane.agentId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.08 }}
              className="glass-card rounded-xl overflow-hidden flex flex-col"
              style={{
                borderTop: `2px solid ${def.borderAccent}`,
                boxShadow: isWorking ? `0 0 20px ${def.borderAccent.replace('0.3', '0.1')}` : undefined,
                minHeight: isWorking || hasLogs ? '420px' : '120px',
              }}
            >
              {/* Lane header */}
              <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${def.dotClass}`} />
                    <span className={`text-sm font-bold ${def.color}`}>{def.label}</span>
                    {lane.department && (
                      <span className="text-[10px] text-slate-600 uppercase tracking-wider">{lane.department}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isWorking ? (
                      <>
                        <div className="relative">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping opacity-75" />
                        </div>
                        <span className="text-[10px] font-semibold text-amber-400">working</span>
                      </>
                    ) : (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        <span className="text-[10px] text-slate-600">idle</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Active task pills */}
                {lane.activeTasks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {lane.activeTasks.map(task => (
                      <div
                        key={task.taskId}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px]"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <Activity size={9} className="text-slate-500" />
                        <span className="text-slate-300 truncate max-w-[140px]">{task.title}</span>
                        <span
                          className="text-[8px] font-bold px-1 rounded"
                          style={{ background: `${stateBadgeColor(task.state)}20`, color: stateBadgeColor(task.state) }}
                        >
                          {task.state}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Log area */}
              {isWorking || hasLogs ? (
                <div
                  ref={(el) => setScrollRef(lane.agentId, el)}
                  onScroll={() => handleLaneScroll(lane.agentId)}
                  className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    maxHeight: '360px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(255,255,255,0.06) transparent',
                  }}
                >
                  {lane.logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-8">
                      <Terminal size={16} className="text-slate-700" />
                      <p className="text-[10px] text-slate-700">Waiting for output...</p>
                    </div>
                  ) : (
                    <>
                      {lane.logs.map((entry) => {
                        const badge = eventTypeBadge(entry.type, entry.source);
                        return (
                          <div
                            key={entry.id}
                            className="flex items-start gap-2 py-0.5 hover:bg-white/[0.02] rounded px-1 -mx-1"
                          >
                            <span className="text-slate-600 shrink-0 select-none tabular-nums text-[10px]">
                              {formatTime(entry.timestamp)}
                            </span>
                            <span className={`shrink-0 px-1 py-0 rounded text-[8px] font-medium border ${badge.className}`}>
                              {badge.label}
                            </span>
                            <span className="text-slate-300 break-all text-[10px]">
                              {entry.content}
                            </span>
                          </div>
                        );
                      })}
                      {/* Blinking cursor */}
                      {isWorking && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`${def.color} font-bold animate-pulse`}>_</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center py-4">
                  <p className="text-[11px] text-slate-700">No active tasks</p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
