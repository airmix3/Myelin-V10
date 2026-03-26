'use client';

import { useState, useRef, useEffect } from 'react';
import ApprovalCard from './ApprovalCard';

interface BuildLogEntry {
  type: string;
  agentId?: string;
  content?: unknown;
  message?: string;
  timestamp?: string;
  attempt?: number;
  retry_delay_ms?: number;
}

interface BuildLogPanelProps {
  entries: BuildLogEntry[];
  taskId: string;
  taskState: string;
  taskMetadata: Record<string, unknown>;
  hireRequests: Array<Record<string, unknown>>;
  onApprovalAction: (action: string, payload?: Record<string, unknown>) => void;
}

const ENTRY_TYPE_BADGES: Record<string, { className: string; label: string }> = {
  'assistant': { className: 'log-type-assistant', label: 'ASSISTANT' },
  'stream_event': { className: 'log-type-progress', label: 'STREAM' },
  'tool_progress': { className: 'log-type-progress', label: 'PROGRESS' },
  'budget_exceeded': { className: 'log-type-error', label: 'BUDGET' },
};

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function BuildLogPanel({
  entries,
  taskId,
  taskState,
  taskMetadata,
  hireRequests,
  onApprovalAction,
}: BuildLogPanelProps) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll if near bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [entries.length]);

  const toggleEntry = (idx: number) => {
    setOpenIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Show inline approval card when task is input-required
  const showHireApproval = taskState === 'input-required' && taskMetadata.inputType === 'hire_approval';
  const showBudgetApproval = taskState === 'input-required' && taskMetadata.inputType === 'budget_increase';

  return (
    <div ref={scrollContainerRef} style={{ padding: '8px', height: '100%', overflowY: 'auto' }}>
      {entries.length === 0 && !showHireApproval && !showBudgetApproval && (
        <div className="empty-state">
          <h3>Waiting for agent</h3>
          <p>Build log entries will appear here once the agent starts working.</p>
        </div>
      )}

      {entries.map((entry, i) => {
        // Heartbeat entry
        if (entry.type === 'heartbeat') {
          return (
            <div key={i} className="log-entry log-entry-heartbeat">
              <div className="log-entry-header">
                <span style={{ fontSize: '10px' }}>{formatTimestamp(entry.timestamp)}</span>
                <span style={{ flex: 1, fontSize: '10px' }}>Agent is still working...</span>
              </div>
            </div>
          );
        }

        // API retry entry
        if (entry.type === 'api_retry') {
          const delaySeconds = entry.retry_delay_ms ? Math.round(entry.retry_delay_ms / 1000) : 0;
          return (
            <div key={i} className="log-entry log-entry-retry">
              <div className="log-entry-header">
                <span className="badge log-type-progress">RETRY</span>
                <span style={{ flex: 1, fontSize: '10px' }}>
                  {entry.attempt
                    ? `Retrying... (attempt ${entry.attempt})`
                    : 'Retrying...'}
                </span>
                {delaySeconds > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                    API returned an error. Retrying in {delaySeconds}s.
                  </span>
                )}
              </div>
            </div>
          );
        }

        // Budget exceeded entry -> render as approval card
        if (entry.type === 'budget_exceeded') {
          return (
            <ApprovalCard
              key={i}
              type="budget_increase"
              data={{ taskId, currentBudget: (entry.content as Record<string, unknown>)?.maxBudgetUsd || 0 }}
              onAction={onApprovalAction}
            />
          );
        }

        // Standard log entry
        const badge = ENTRY_TYPE_BADGES[entry.type] || { className: 'log-type-session', label: entry.type.toUpperCase() };
        const isOpen = openIndices.has(i);
        const description = entry.message || (typeof entry.content === 'string' ? entry.content : '');

        return (
          <div key={i} className={`log-entry ${isOpen ? 'open' : ''}`}>
            <div className="log-entry-header" onClick={() => toggleEntry(i)}>
              <span style={{ transition: 'transform 0.15s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                &#9654;
              </span>
              <span className={`badge ${badge.className}`}>{badge.label}</span>
              {entry.agentId && (
                <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>{entry.agentId}</span>
              )}
              <span style={{ flex: 1, fontSize: '10px' }}>
                {typeof description === 'string' ? truncate(description, 200) : ''}
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: '10px', flexShrink: 0 }}>
                {formatTimestamp(entry.timestamp)}
              </span>
            </div>
            <div className="log-entry-body">
              {typeof description === 'string' && description && <div style={{ marginBottom: '8px' }}>{description}</div>}
              {entry.content && typeof entry.content === 'object' && (
                <pre style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                  {JSON.stringify(entry.content, null, 2)}
                </pre>
              )}
            </div>
          </div>
        );
      })}

      {/* Inline approval cards for hire/budget when task is input-required */}
      {showHireApproval && hireRequests.map(hr => (
        <ApprovalCard
          key={hr.id as string}
          type="hire_approval"
          data={hr}
          onAction={onApprovalAction}
        />
      ))}

      {showBudgetApproval && (
        <ApprovalCard
          type="budget_increase"
          data={{ taskId, currentBudget: taskMetadata.maxBudgetUsd || 0 }}
          onAction={onApprovalAction}
        />
      )}
    </div>
  );
}
