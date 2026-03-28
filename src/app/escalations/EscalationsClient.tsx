'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSSE } from '@/components/useSSE';

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
  pendingEscalations: EscalationItem[];
  resolvedEscalations: EscalationItem[];
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString();
}

export default function EscalationsClient({ pendingEscalations, resolvedEscalations }: EscalationsClientProps) {
  const router = useRouter();
  const [pending, setPending] = useState<EscalationItem[]>(pendingEscalations);
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);

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
      setPending((prev) => [newEsc, ...prev]);
    },
  });

  async function handleAction(id: string, resolution: 'approved' | 'declined') {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/escalations/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: resolution, resolution }),
      });
      setPending((prev) => prev.filter((e) => e.id !== id));
      router.refresh();
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleRespond(id: string) {
    const text = responseText[id]?.trim();
    if (!text) return;
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/escalations/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: text, resolution: 'answered' }),
      });
      setPending((prev) => prev.filter((e) => e.id !== id));
      setResponseText((prev) => ({ ...prev, [id]: '' }));
      router.refresh();
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleDismiss(id: string) {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/escalations/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setPending((prev) => prev.filter((e) => e.id !== id));
      router.refresh();
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '18px', marginBottom: '20px', color: 'var(--text)' }}>
        Escalations
      </h1>

      {pending.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', padding: '40px 0', textAlign: 'center' }}>
          No pending escalations
        </div>
      ) : (
        <div>
          {pending.map((esc) => (
            <div key={esc.id} className="escalation-card" data-urgency={esc.urgency}>
              <div className="escalation-card-header">
                <span className={`esc-type-badge esc-type-${esc.type}`}>{esc.type.replace('_', ' ')}</span>
                <span className={`esc-urgency-badge esc-urgency-${esc.urgency}`}>{esc.urgency}</span>
                <span className="esc-agent">{esc.agentId}</span>
                <span className="esc-time">{formatTime(esc.createdAt)}</span>
              </div>
              <div className="escalation-card-task">{esc.task.title} -- {esc.task.department}</div>
              <div className="escalation-card-summary">{esc.summary}</div>
              {esc.reason && <div className="escalation-card-reason">{esc.reason}</div>}
              <div className="escalation-card-actions">
                {(esc.type === 'hire_approval' || esc.type === 'budget_increase') && (
                  <div className="esc-action-buttons">
                    <button
                      onClick={() => handleAction(esc.id, 'approved')}
                      className="esc-btn esc-btn-approve"
                      disabled={loading[esc.id]}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(esc.id, 'declined')}
                      className="esc-btn esc-btn-decline"
                      disabled={loading[esc.id]}
                    >
                      Decline
                    </button>
                  </div>
                )}
                <div className="esc-response-row">
                  <input
                    value={responseText[esc.id] || ''}
                    onChange={(e) => setResponseText((prev) => ({ ...prev, [esc.id]: e.target.value }))}
                    placeholder="Type response..."
                    className="esc-response-input"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRespond(esc.id); }}
                  />
                  <button
                    onClick={() => handleRespond(esc.id)}
                    className="esc-btn esc-btn-send"
                    disabled={loading[esc.id] || !responseText[esc.id]?.trim()}
                  >
                    Send
                  </button>
                </div>
                <button
                  onClick={() => handleDismiss(esc.id)}
                  className="esc-btn esc-btn-dismiss"
                  disabled={loading[esc.id]}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History section */}
      {resolvedEscalations.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'var(--font)',
            }}
          >
            {showHistory ? '\u25BC' : '\u25B6'} History ({resolvedEscalations.length})
          </button>
          {showHistory && (
            <div style={{ marginTop: '12px', opacity: 0.6 }}>
              {resolvedEscalations.map((esc) => (
                <div key={esc.id} className="escalation-card" data-urgency={esc.urgency} style={{ opacity: 0.5 }}>
                  <div className="escalation-card-header">
                    <span className={`esc-type-badge esc-type-${esc.type}`}>{esc.type.replace('_', ' ')}</span>
                    <span className={`esc-urgency-badge esc-urgency-${esc.urgency}`}>{esc.urgency}</span>
                    <span className="esc-agent">{esc.agentId}</span>
                    <span className="esc-time">{esc.resolvedAt ? formatTime(esc.resolvedAt) : ''}</span>
                    <span style={{ color: esc.status === 'responded' ? 'var(--green)' : 'var(--gray)', fontSize: '11px' }}>
                      {esc.status}
                    </span>
                  </div>
                  <div className="escalation-card-summary">{esc.summary}</div>
                  {esc.response && (
                    <div style={{ color: 'var(--green)', fontSize: '12px', marginTop: '4px' }}>
                      Response: {esc.response}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
