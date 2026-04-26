'use client';

import { useState, useMemo, lazy, Suspense } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Users, ChevronRight, CheckCircle, Search, List, GitBranch } from 'lucide-react';

const OrgGraphView = lazy(() => import('./OrgGraphView'));

// ── Types ────────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  role: string;
  department: string;
  agentId: string | null;
  status: string;
  hasRunningTask: boolean;
  currentTaskTitle: string | null;
}

// ── Department config ────────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, string> = {
  cos: 'bg-teal-500',
  tech: 'bg-blue-500',
  marketing: 'bg-purple-500',
  operations: 'bg-emerald-500',
  global: 'bg-rose-500',
};

const statusConfig = {
  active:     { color: '#34d399', label: 'Active'  },
  busy:       { color: '#f59e0b', label: 'Busy'    },
  idle:       { color: '#64748b', label: 'Idle'    },
  terminated: { color: '#f43f5e', label: 'Offline' },
} as const;

const DEPT_ORDER = ['cos', 'tech', 'marketing', 'operations', 'global'];
const DEPT_LABELS: Record<string, string> = {
  cos: 'Executive',
  tech: 'Tech',
  marketing: 'Marketing',
  operations: 'Operations',
  global: 'Global',
};

// ── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: Agent }) {
  const deptColor = DEPT_COLORS[agent.department] ?? 'bg-slate-500';
  const initials = agent.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const stKey = agent.hasRunningTask ? 'busy' : agent.status === 'terminated' ? 'terminated' : 'idle';
  const st = statusConfig[stKey as keyof typeof statusConfig] ?? statusConfig.idle;

  return (
    <Link href={`/agents/${agent.agentId ?? agent.id}`}>
      <motion.div
        whileHover={{ y: -2, scale: 1.01 }}
        transition={{ duration: 0.15 }}
        className="rounded-xl p-4 flex flex-col gap-3 cursor-pointer h-full"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div
              className={`w-10 h-10 rounded-full ${deptColor} flex items-center justify-center text-[13px] font-bold text-white`}
            >
              {initials}
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0f172a]"
              style={{ backgroundColor: st.color }}
              title={st.label}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate">{agent.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{agent.role}</p>
          </div>
          <ChevronRight size={12} className="text-slate-700 shrink-0" />
        </div>

        {/* Current task */}
        {agent.currentTaskTitle ? (
          <div className="flex items-start gap-1.5 min-w-0">
            {agent.hasRunningTask && (
              <motion.div
                className="w-1.5 h-1.5 rounded-full shrink-0 mt-1"
                style={{ background: st.color }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
              {agent.currentTaskTitle}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-slate-600 italic">No active task</p>
        )}

        {/* Footer */}
        <div
          className="flex items-center gap-2 pt-2 mt-auto"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <CheckCircle size={10} className="text-emerald-500" />
          <span className="text-[10px] text-slate-500">0 tasks done</span>
          <span
            className="ml-auto text-[9px] px-1.5 py-0.5 rounded-md font-medium"
            style={{ background: `${st.color}15`, color: st.color }}
          >
            {st.label}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}

// ── Sidebar department item ─────────────────────────────────────────────────

const DEPT_DOT_COLORS: Record<string, string> = {
  cos: '#2dd4bf',
  tech: '#38bdf8',
  marketing: '#a78bfa',
  operations: '#34d399',
  global: '#fb7185',
};

function DeptItem({
  label, dept, count, selected, onClick,
}: {
  label: string; dept: string; count: number; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all cursor-pointer"
      style={{
        background: selected ? 'rgba(255,255,255,0.07)' : 'transparent',
        border: `1px solid ${selected ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
      }}
    >
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: DEPT_DOT_COLORS[dept] ?? 'rgba(255,255,255,0.15)' }}
      />
      <span
        className="flex-1 text-[12px] font-medium truncate"
        style={{ color: selected ? 'white' : 'rgba(255,255,255,0.5)' }}
      >
        {label}
      </span>
      <span className="text-[10px] text-slate-600 shrink-0">{count}</span>
    </button>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AgentsClient({ agents }: { agents: Agent[] }) {
  const [selected, setSelected] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');

  const activeCount = agents.filter((a) => a.hasRunningTask).length;

  // Group agents by department
  const grouped = useMemo(() => {
    const base = query
      ? agents.filter(a =>
          a.name.toLowerCase().includes(query.toLowerCase()) ||
          a.role.toLowerCase().includes(query.toLowerCase()) ||
          a.department.toLowerCase().includes(query.toLowerCase())
        )
      : agents;

    const map: Record<string, Agent[]> = {};
    base.forEach(a => {
      if (!map[a.department]) map[a.department] = [];
      map[a.department].push(a);
    });
    return map;
  }, [agents, query]);

  // Filter by selected department
  const deptList = selected === 'all'
    ? DEPT_ORDER.filter(d => grouped[d]?.length)
    : [selected].filter(d => grouped[d]?.length);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Left sidebar ── */}
      <div
        className="w-52 shrink-0 flex flex-col h-full overflow-hidden"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3 shrink-0">
          <h1 className="text-[14px] font-bold text-white mb-0.5">People & Teams</h1>
          <p className="text-[11px] text-slate-500">{activeCount} active · {agents.length} total</p>

          {/* View toggle */}
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => setViewMode('list')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all cursor-pointer"
              style={{
                background: viewMode === 'list' ? 'rgba(45,212,191,0.15)' : 'transparent',
                border: `1px solid ${viewMode === 'list' ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.07)'}`,
                color: viewMode === 'list' ? '#2dd4bf' : 'rgba(255,255,255,0.4)',
              }}
            >
              <List size={10} /> List
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all cursor-pointer"
              style={{
                background: viewMode === 'graph' ? 'rgba(45,212,191,0.15)' : 'transparent',
                border: `1px solid ${viewMode === 'graph' ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.07)'}`,
                color: viewMode === 'graph' ? '#2dd4bf' : 'rgba(255,255,255,0.4)',
              }}
            >
              <GitBranch size={10} /> Graph
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pb-3 shrink-0">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected('all'); }}
              placeholder="Search agents..."
              className="w-full pl-7 pr-3 py-1.5 rounded-lg text-[11px] text-white placeholder-slate-600 outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            />
          </div>
        </div>

        {/* All Agents */}
        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={() => setSelected('all')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all cursor-pointer"
            style={{
              background: selected === 'all' ? 'rgba(255,255,255,0.07)' : 'transparent',
              border: `1px solid ${selected === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
            }}
          >
            <Users size={12} style={{ color: selected === 'all' ? 'white' : 'rgba(255,255,255,0.4)' }} />
            <span
              className="flex-1 text-[12px] font-medium"
              style={{ color: selected === 'all' ? 'white' : 'rgba(255,255,255,0.5)' }}
            >
              All Agents
            </span>
            <span className="text-[10px] text-slate-600">{agents.length}</span>
          </button>
        </div>

        {/* Departments */}
        <div className="px-3 space-y-0.5 overflow-y-auto flex-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 px-3 pt-2 pb-1">
            Departments
          </p>
          {DEPT_ORDER.map(dept => {
            const count = grouped[dept]?.length ?? 0;
            if (count === 0 && dept !== selected) return null;
            return (
              <DeptItem
                key={dept}
                label={DEPT_LABELS[dept] ?? dept}
                dept={dept}
                count={count}
                selected={selected === dept}
                onClick={() => setSelected(dept)}
              />
            );
          })}
        </div>
      </div>

      {/* ── Main content ── */}
      {viewMode === 'list' ? (
        <div className="flex-1 overflow-y-auto p-7 space-y-8">
          {deptList.length === 0 && (
            <div className="text-center py-20 text-slate-600 text-[13px]">
              {query ? `No agents match "${query}"` : 'No agents in this department'}
            </div>
          )}
          {deptList.map(dept => (
            <div key={dept}>
              <div className="flex items-baseline gap-2 mb-3">
                <h3 className="text-[13px] font-bold text-slate-300">{DEPT_LABELS[dept] ?? dept}</h3>
                <span className="text-[10px] text-slate-600">{grouped[dept].length} agent{grouped[dept].length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {grouped[dept].map(agent => <AgentCard key={agent.id} agent={agent} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 min-h-0 h-[calc(100vh-64px)]">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full text-slate-600 text-[13px]">
              Loading org graph...
            </div>
          }>
            <OrgGraphView key="org-graph" />
          </Suspense>
        </div>
      )}
    </div>
  );
}
