'use client';

import { useEffect, useRef } from 'react';

interface TaskDetails {
  id: string;
  title: string;
  state: string;
  department: string;
  description?: string | null;
  metadata?: string | null;
  planMarkdown?: string | null;
  createdAt: string;
  deliverables?: Array<{ id: string; title: string; status: string }>;
}

// Priority colors
const priorityColors: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(244,63,94,0.20)', text: '#f43f5e' },
  high: { bg: 'rgba(245,158,11,0.20)', text: '#fbbf24' },
  medium: { bg: 'rgba(100,116,139,0.20)', text: '#94a3b8' },
  low: { bg: 'rgba(100,116,139,0.15)', text: '#64748b' },
};

// Stage badge mapping
const stageMap: Record<string, { label: string; bg: string; text: string }> = {
  submitted: { label: 'Submitted', bg: 'rgba(148,163,184,0.20)', text: '#94a3b8' },
  working: { label: 'In Progress', bg: 'rgba(251,191,36,0.20)', text: '#fbbf24' },
  'input-required': { label: 'Needs Input', bg: 'rgba(56,189,248,0.20)', text: '#38bdf8' },
  completed: { label: 'Complete', bg: 'rgba(52,211,153,0.20)', text: '#34d399' },
  failed: { label: 'Failed', bg: 'rgba(244,63,94,0.20)', text: '#f43f5e' },
  canceled: { label: 'Canceled', bg: 'rgba(148,163,184,0.20)', text: '#94a3b8' },
};

// Deliverable status icon (SVG inline to avoid external deps)
function DelivStatusIcon({ status }: { status: string }) {
  if (status === 'completed' || status === 'approved') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  }
  if (status === 'in-progress') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

export default function MissionDetailsPanel({
  task,
  onClose,
}: {
  task: TaskDetails;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Slide-in animation on mount
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transform = 'translateX(100%)';
    el.style.opacity = '0';
    requestAnimationFrame(() => {
      el.style.transition = 'transform 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease';
      el.style.transform = 'translateX(0)';
      el.style.opacity = '1';
    });
  }, []);

  const meta = task.metadata ? (() => { try { return JSON.parse(task.metadata!); } catch { return {}; } })() : {};
  const priority = meta.priority || 'medium';
  const pColor = priorityColors[priority] || priorityColors.medium;
  const stage = stageMap[task.state] || stageMap.submitted;
  const assignee = meta.assignee || `${task.department} dept`;
  const warning = meta.warning || null;

  return (
    <div
      ref={panelRef}
      style={{
        width: '280px',
        height: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        background: 'var(--card-bg, rgba(255,255,255,0.03))',
        borderRadius: 'var(--radius, 12px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-cyan, #0ef)' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>Mission Details</span>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '4px',
            borderRadius: '8px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-dim, #64748b)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
          aria-label="Close mission details"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Task title */}
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #fff)', lineHeight: 1.4, margin: 0 }}>
          {task.title}
        </h3>

        {/* Assignee */}
        <div style={{ fontSize: '12px', color: 'var(--text-dim, #64748b)' }}>
          <span style={{ color: 'var(--text-muted, #475569)' }}>Assignee:</span>{' '}
          <span style={{ color: 'var(--text-secondary, #94a3b8)', textTransform: 'capitalize' }}>{assignee}</span>
        </div>

        {/* Priority + Stage badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted, #475569)', marginBottom: '4px' }}>Priority</div>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'capitalize',
                background: pColor.bg,
                color: pColor.text,
              }}
            >
              {priority}
            </span>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted, #475569)', marginBottom: '4px' }}>Stage</div>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                background: stage.bg,
                color: stage.text,
              }}
            >
              {stage.label}
            </span>
          </div>
        </div>

        {/* Warning */}
        {warning && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.18)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: '11px', color: '#fbbf24', lineHeight: 1.5 }}>{warning}</span>
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted, #475569)', marginBottom: '6px' }}>Description</div>
            <p style={{ fontSize: '12px', color: 'var(--text-dim, #64748b)', lineHeight: 1.5, margin: 0 }}>{task.description}</p>
          </div>
        )}

        {/* Deliverables */}
        {task.deliverables && task.deliverables.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted, #475569)', marginBottom: '8px' }}>Deliverables</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {task.deliverables.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <DelivStatusIcon status={d.status} />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.title}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted, #475569)', textTransform: 'capitalize' }}>{d.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Created date */}
        <div style={{ fontSize: '10px', color: 'var(--text-muted, #475569)', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          Created {new Date(task.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
