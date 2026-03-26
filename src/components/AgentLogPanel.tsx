'use client';

import { useState } from 'react';

interface AgentLogEntry {
  id: string;
  taskId: string | null;
  agentId: string | null;
  actionType: string;
  description: string | null;
  metadata: string | null;
  createdAt: string;
}

interface AgentLogPanelProps {
  activityLog: AgentLogEntry[];
}

const ACTION_TYPE_BADGES: Record<string, { className: string; label: string }> = {
  'SDK_SESSION_INIT': { className: 'log-type-session', label: 'SESSION' },
  'SDK_ASSISTANT': { className: 'log-type-assistant', label: 'ASSISTANT' },
  'SDK_TOOL_PROGRESS': { className: 'log-type-progress', label: 'PROGRESS' },
  'SDK_TOOL_SUMMARY': { className: 'log-type-summary', label: 'TOOL' },
  'SDK_RESULT_SUCCESS': { className: 'log-type-success', label: 'SUCCESS' },
  'SDK_RESULT_ERROR': { className: 'log-type-error', label: 'ERROR' },
  'TASK_TRANSITION': { className: 'log-type-assistant', label: 'TRANSITION' },
  'WORKER_CLAIM': { className: 'log-type-session', label: 'WORKER' },
};

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AgentLogPanel({ activityLog }: AgentLogPanelProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  if (activityLog.length === 0) {
    return (
      <div className="empty-state">
        <h3>No activity recorded</h3>
        <p>Agent activity will appear here once execution begins.</p>
      </div>
    );
  }

  const toggleEntry = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ padding: '8px' }}>
      {activityLog.map(entry => {
        const badge = ACTION_TYPE_BADGES[entry.actionType] || { className: 'log-type-session', label: entry.actionType };
        const isOpen = openIds.has(entry.id);

        return (
          <div key={entry.id} className={`log-entry ${isOpen ? 'open' : ''}`}>
            <div className="log-entry-header" onClick={() => toggleEntry(entry.id)}>
              <span style={{ transition: 'transform 0.15s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                &#9654;
              </span>
              <span className={`badge ${badge.className}`}>{badge.label}</span>
              {entry.agentId && (
                <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>{entry.agentId}</span>
              )}
              <span style={{ flex: 1, fontSize: '10px' }}>
                {entry.description ? truncate(entry.description, 200) : ''}
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: '10px', flexShrink: 0 }}>
                {formatTimestamp(entry.createdAt)}
              </span>
            </div>
            <div className="log-entry-body">
              {entry.description && <div style={{ marginBottom: '8px' }}>{entry.description}</div>}
              {entry.metadata && (
                <pre style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                  {JSON.stringify(JSON.parse(entry.metadata), null, 2)}
                </pre>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
