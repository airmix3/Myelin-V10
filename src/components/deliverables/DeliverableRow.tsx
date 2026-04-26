'use client';

import Link from 'next/link';
import { FileText, Code2, Image, Play, Database, ChevronRight } from 'lucide-react';

export interface DeliverableListItem {
  id: string;
  title: string;
  type: string | null;
  status: string;
  department: string;
  creatorId: string | null;
  createdAt: string;
  taskTitle: string | null;
  taskState: string | null;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  document: FileText,
  report: FileText,
  code: Code2,
  image: Image,
  video: Play,
  data: Database,
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  'in-progress':    { bg: 'rgba(56,189,248,0.12)',  color: '#7dd3fc', label: 'In Progress' },
  completed:        { bg: 'rgba(52,211,153,0.12)',  color: '#6ee7b7', label: 'Completed' },
  failed:           { bg: 'rgba(244,63,94,0.12)',   color: '#fda4af', label: 'Failed' },
  'input-required': { bg: 'rgba(245,158,11,0.12)',  color: '#fcd34d', label: 'Input Required' },
  canceled:         { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: 'Canceled' },
};

const DEPT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  tech:       { text: '#7dd3fc', bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.15)' },
  marketing:  { text: '#c4b5fd', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.15)' },
  operations: { text: '#6ee7b7', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.15)' },
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

interface DeliverableRowProps {
  deliverable: DeliverableListItem;
}

export default function DeliverableRow({ deliverable }: DeliverableRowProps) {
  const Icon = TYPE_ICONS[deliverable.type ?? ''] ?? FileText;
  const st = STATUS_STYLES[deliverable.status] ?? STATUS_STYLES.canceled;
  const dept = DEPT_COLORS[deliverable.department] ?? { text: '#94a3b8', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.12)' };

  return (
    <Link
      href={`/deliverables/${deliverable.id}`}
      className="flex items-center gap-3.5 px-4 py-4 rounded-xl transition-all group"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.08)',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.045)';
        e.currentTarget.style.borderColor = 'rgba(56,189,248,0.18)';
        e.currentTarget.style.boxShadow = '0 0 24px rgba(56,189,248,0.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Type icon in colored circle */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ background: st.bg, border: `1px solid ${st.color}20` }}
      >
        <Icon size={16} style={{ color: st.color }} />
      </div>

      {/* Center: title + task + dept */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-slate-200 truncate leading-tight">
          {deliverable.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {deliverable.taskTitle && (
            <span className="text-[10px] text-slate-600 truncate max-w-[260px]">{deliverable.taskTitle}</span>
          )}
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0"
            style={{ background: dept.bg, color: dept.text, border: `1px solid ${dept.border}` }}
          >
            {deliverable.department}
          </span>
        </div>
      </div>

      {/* Right: date + status + chevron */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[10px] text-slate-600 tabular-nums">
          {relativeDate(deliverable.createdAt)}
        </span>
        <span
          className="text-[10px] font-semibold px-2.5 py-1 rounded-lg shrink-0"
          style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}18` }}
        >
          {st.label}
        </span>
        <ChevronRight size={14} className="text-slate-700 shrink-0 group-hover:text-slate-400 transition-colors" />
      </div>
    </Link>
  );
}
