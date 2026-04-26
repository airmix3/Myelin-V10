'use client';

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Package, FileText, Code2, Image, Play, Database } from 'lucide-react';
import type { DeliverableListItem } from './DeliverableRow';
import Link from 'next/link';

interface DeliverablesListProps {
  deliverables: DeliverableListItem[];
}

// ── Constants ────────────────────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, string> = {
  tech:       '#38bdf8',
  marketing:  '#a78bfa',
  operations: '#34d399',
  cos:        '#f59e0b',
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  completed:        { color: '#34d399', label: 'Completed' },
  'in-progress':    { color: '#38bdf8', label: 'In Progress' },
  failed:           { color: '#f87171', label: 'Failed' },
  'input-required': { color: '#f59e0b', label: 'Input Required' },
  canceled:         { color: '#64748b', label: 'Canceled' },
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  document: FileText,
  report: FileText,
  code: Code2,
  image: Image,
  video: Play,
  data: Database,
};

const AGENT_AVATARS: Record<string, { avatar: string; color: string; name: string }> = {
  cto:   { avatar: 'CT', color: '#38bdf8', name: 'CTO' },
  cmo:   { avatar: 'CM', color: '#a78bfa', name: 'CMO' },
  coo:   { avatar: 'CO', color: '#34d399', name: 'COO' },
  tamir: { avatar: 'T',  color: '#f59e0b', name: 'Tamir' },
};

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── DeptRail ─────────────────────────────────────────────────────────────────────

function DeptRail({
  departments,
  deliverables,
  selectedDept,
  onSelect,
}: {
  departments: string[];
  deliverables: DeliverableListItem[];
  selectedDept: string | null;
  onSelect: (dept: string | null) => void;
}) {
  return (
    <div
      className="shrink-0 flex items-center gap-1 px-4 overflow-x-auto"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', scrollbarWidth: 'none', minHeight: 44 }}
    >
      <button
        onClick={() => onSelect(null)}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
        style={{
          color: selectedDept === null ? 'white' : '#64748b',
          background: selectedDept === null ? 'rgba(255,255,255,0.07)' : 'transparent',
          border: selectedDept === null ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
        }}
      >
        <Package size={11} style={{ color: selectedDept === null ? '#94a3b8' : '#475569' }} />
        All
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
          style={{
            color: selectedDept === null ? '#94a3b8' : '#475569',
            background: selectedDept === null ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
          }}
        >
          {deliverables.length}
        </span>
      </button>

      <div className="w-px h-4 shrink-0 mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {departments.map((dept) => {
        const deptFiles = deliverables.filter((d) => d.department === dept);
        const activeCount = deptFiles.filter((d) => d.status === 'in-progress').length;
        const isActive = selectedDept === dept;
        const color = DEPT_COLORS[dept] ?? '#64748b';

        return (
          <button
            key={dept}
            onClick={() => onSelect(dept)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
            style={{
              color: isActive ? 'white' : '#64748b',
              background: isActive ? `${color}12` : 'transparent',
              border: isActive ? `1px solid ${color}30` : '1px solid transparent',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: isActive ? color : '#334155' }}
            />
            {dept.charAt(0).toUpperCase() + dept.slice(1)}
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
              style={{
                color: isActive ? color : '#475569',
                background: isActive ? `${color}18` : 'rgba(255,255,255,0.04)',
              }}
            >
              {deptFiles.length}
            </span>
            {activeCount > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: '#38bdf8', boxShadow: '0 0 4px rgba(56,189,248,0.6)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── DeliverableCard ──────────────────────────────────────────────────────────────

function DeliverableCard({ item, index }: { item: DeliverableListItem; index: number }) {
  const st = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.canceled;
  const Icon = TYPE_ICONS[item.type ?? ''] ?? FileText;
  const agent = AGENT_AVATARS[item.creatorId ?? ''];
  const deptColor = DEPT_COLORS[item.department] ?? '#64748b';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.03 }}
    >
      <Link
        href={`/deliverables/${item.id}`}
        className="group relative block rounded-xl cursor-pointer overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.07)',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        {/* Left status accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[2px] rounded-l-xl"
          style={{ background: st.color, opacity: 0.35 }}
        />

        {/* Hover border */}
        <div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)' }}
        />

        <div className="px-4 pt-3.5 pb-3 pl-5">
          {/* Row 1: title (bold) */}
          <p
            className="text-[14px] font-bold leading-snug mb-1"
            style={{ color: '#e2e8f0' }}
            title={item.title}
          >
            {item.title}
          </p>
          <p className="text-[11px] mb-3" style={{ color: '#475569' }}>
            {item.department} · {item.type ?? 'file'}
          </p>

          {/* Row 2: task title as mission row */}
          {item.taskTitle && (
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-[11px] truncate" style={{ color: '#64748b' }}>{item.taskTitle}</span>
              <span className="text-[10px] font-semibold shrink-0" style={{ color: st.color + '99' }}>
                {st.label.toLowerCase()}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="h-px my-3" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* Footer: status summary + agent avatar */}
          <div className="flex items-center justify-between">
            <p className="text-[10.5px]" style={{ color: '#475569' }}>
              {relativeDate(item.createdAt)}
            </p>
            {agent && (
              <div
                className="rounded-full flex items-center justify-center shrink-0 font-bold ring-1 ring-[rgba(6,10,19,0.9)]"
                style={{
                  width: 20, height: 20,
                  background: `${agent.color}20`,
                  border: `1px solid ${agent.color}40`,
                  color: agent.color,
                  fontSize: '8px',
                }}
              >
                {agent.avatar}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────────

export default function DeliverablesList({ deliverables }: DeliverablesListProps) {
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const departments = useMemo(() => {
    const depts = new Set(deliverables.map((d) => d.department));
    return Array.from(depts).sort();
  }, [deliverables]);

  const filtered = selectedDept
    ? deliverables.filter((d) => d.department === selectedDept)
    : deliverables;

  const completedCount = deliverables.filter((d) => d.status === 'completed').length;
  const inProgressCount = deliverables.filter((d) => d.status === 'in-progress').length;
  const failedCount = deliverables.filter((d) => d.status === 'failed').length;

  return (
    <div className="flex flex-col h-full">
      {/* Page title bar */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-1.5"
        style={{
          height: 44,
          background: 'rgba(6,10,19,0.6)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(16px) saturate(140%)',
          WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        }}
      >
        <h1 className="text-[14px] font-semibold text-white">Deliverables</h1>
      </div>

      {/* DeptRail */}
      <DeptRail
        departments={departments}
        deliverables={deliverables}
        selectedDept={selectedDept}
        onSelect={setSelectedDept}
      />

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto px-6 py-6"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
      >
        {/* Summary strip */}
        <div className="flex items-center gap-6 mb-6">
          <div>
            <p className="text-[22px] font-bold text-white leading-none">{filtered.length}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Total files</p>
          </div>
          {[
            { label: 'Completed',   value: completedCount,  color: '#34d399' },
            { label: 'In progress', value: inProgressCount, color: '#38bdf8' },
            { label: 'Failed',      value: failedCount,     color: '#f87171' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className="w-[3px] h-8 rounded-full shrink-0" style={{ background: s.color }} />
              <div>
                <p className="text-[16px] font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
          <p className="ml-auto text-[11px] text-slate-600">Filter by department using the tabs above</p>
        </div>

        {/* Deliverable cards grid */}
        {filtered.length === 0 ? (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <FileText className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">No deliverables yet</p>
            <p className="text-xs text-slate-600 mt-1">
              Deliverables will appear here as agents complete tasks
            </p>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {filtered.map((d, i) => (
              <DeliverableCard key={d.id} item={d} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
