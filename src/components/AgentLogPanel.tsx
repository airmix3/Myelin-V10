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
  'SDK_SKILL_LOAD': { className: 'log-type-session', label: 'SKILL' },
  'SDK_ASSISTANT': { className: 'log-type-assistant', label: 'ASSISTANT' },
  'SDK_TOOL_CALL': { className: 'log-type-tool', label: 'TOOL' },
  'SDK_TOOL_PROGRESS': { className: 'log-type-progress', label: 'PROGRESS' },
  'SDK_TOOL_SUMMARY': { className: 'log-type-summary', label: 'TOOL' },
  'SDK_FILES_PERSISTED': { className: 'log-type-summary', label: 'FILES' },
  'SDK_API_RETRY': { className: 'log-type-error', label: 'RETRY' },
  'SDK_HOOK_STARTED': { className: 'log-type-session', label: 'HOOK' },
  'SDK_HOOK_PROGRESS': { className: 'log-type-progress', label: 'HOOK' },
  'SDK_HOOK_RESPONSE': { className: 'log-type-summary', label: 'HOOK' },
  'SDK_LOCAL_COMMAND': { className: 'log-type-assistant', label: 'LOCAL' },
  'SDK_RESULT_SUCCESS': { className: 'log-type-success', label: 'SUCCESS' },
  'SDK_RESULT_ERROR': { className: 'log-type-error', label: 'ERROR' },
  'TASK_TRANSITION': { className: 'log-type-assistant', label: 'TRANSITION' },
  'WORKER_CLAIM': { className: 'log-type-session', label: 'WORKER' },
  'INSTALL_TOOL_REQUESTED': { className: 'log-type-tool', label: 'INSTALL' },
  'INSTALL_SKILL_REQUESTED': { className: 'log-type-tool', label: 'INSTALL' },
  'AGENT_SWITCH_START': { className: 'log-type-session', label: 'AGENT SWITCH' },
  'AGENT_SWITCH_END': { className: 'log-type-session', label: 'AGENT SWITCH' },
};

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function parseMetadata(metadata: string | null): Record<string, unknown> | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function stringifyValue(value: unknown, maxLen = 140): string {
  if (typeof value === 'string') return truncate(value.replace(/\s+/g, ' ').trim(), maxLen);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return truncate(value.map(item => stringifyValue(item, 40)).join(', '), maxLen);
  if (value && typeof value === 'object') {
    try {
      return truncate(JSON.stringify(value), maxLen);
    } catch {
      return '[object]';
    }
  }
  return '';
}

function getInputPath(input: Record<string, unknown> | null): string {
  if (!input) return '';
  const candidates = [input.file_path, input.path, input.notebook_path, input.target_file, input.uri];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  if (Array.isArray(input.paths) && typeof input.paths[0] === 'string') return input.paths[0];
  return '';
}

function getMetadataHighlights(entry: AgentLogEntry, metadata: Record<string, unknown> | null): string[] {
  if (!metadata) return [];

  switch (entry.actionType) {
    case 'SDK_SESSION_INIT':
      return [
        typeof metadata.model === 'string' ? `Model: ${metadata.model}` : '',
        typeof metadata.cwd === 'string' ? `CWD: ${metadata.cwd}` : '',
        Array.isArray(metadata.tools) ? `Tools: ${metadata.tools.length}` : '',
        Array.isArray(metadata.skills) ? `Skills: ${metadata.skills.length}` : '',
      ].filter(Boolean);

    case 'SDK_SKILL_LOAD':
      return [typeof metadata.skill === 'string' ? `Skill: ${metadata.skill}` : ''].filter(Boolean);

    case 'SDK_TOOL_CALL': {
      const input = metadata.input && typeof metadata.input === 'object' && !Array.isArray(metadata.input)
        ? metadata.input as Record<string, unknown>
        : null;
      const path = getInputPath(input);
      const command = input && typeof input.command === 'string' ? input.command : '';
      const pattern = input && typeof input.pattern === 'string'
        ? input.pattern
        : input && typeof input.query === 'string'
          ? input.query
          : '';

      return [
        typeof metadata.toolName === 'string' ? `Tool: ${metadata.toolName}` : '',
        command ? `Command: ${truncate(command, 140)}` : '',
        path ? `Path: ${path}` : '',
        pattern ? `Query: ${truncate(pattern, 120)}` : '',
      ].filter(Boolean);
    }

    case 'SDK_TOOL_PROGRESS':
      return [
        typeof metadata.toolName === 'string' ? `Tool: ${metadata.toolName}` : '',
        typeof metadata.elapsedTimeSeconds === 'number' ? `Elapsed: ${Math.round(metadata.elapsedTimeSeconds)}s` : '',
      ].filter(Boolean);

    case 'SDK_FILES_PERSISTED':
      return [
        Array.isArray(metadata.files) ? `Saved: ${metadata.files.length} file(s)` : '',
        Array.isArray(metadata.failed) && metadata.failed.length > 0 ? `Failed: ${metadata.failed.length}` : '',
      ].filter(Boolean);

    case 'SDK_RESULT_SUCCESS':
      return [
        typeof metadata.numTurns === 'number' ? `Turns: ${metadata.numTurns}` : '',
        typeof metadata.durationMs === 'number' ? `Duration: ${Math.round(metadata.durationMs / 1000)}s` : '',
        typeof metadata.totalCostUsd === 'number' ? `Cost: $${metadata.totalCostUsd.toFixed(3)}` : '',
      ].filter(Boolean);

    case 'SDK_RESULT_ERROR':
      return [
        typeof metadata.subtype === 'string' ? `Subtype: ${metadata.subtype}` : '',
        Array.isArray(metadata.errors) ? `Errors: ${metadata.errors.length}` : '',
      ].filter(Boolean);

    case 'SDK_API_RETRY':
      return [
        typeof metadata.retryDelayMs === 'number' ? `Delay: ${Math.round(metadata.retryDelayMs / 1000)}s` : '',
        metadata.errorStatus !== null && metadata.errorStatus !== undefined ? `HTTP: ${metadata.errorStatus}` : '',
      ].filter(Boolean);

    case 'TASK_TRANSITION':
      return Object.entries(metadata).map(([key, value]) => `${key}: ${stringifyValue(value, 100)}`);

    case 'INSTALL_TOOL_REQUESTED':
    case 'INSTALL_SKILL_REQUESTED':
      return [
        typeof metadata.package_name === 'string' ? `Package: ${metadata.package_name}` : '',
        typeof metadata.skill_name === 'string' ? `Skill: ${metadata.skill_name}` : '',
        typeof metadata.justification === 'string' ? `Reason: ${truncate(String(metadata.justification), 100)}` : '',
      ].filter(Boolean);

    case 'AGENT_SWITCH_START':
      return [
        typeof metadata.toAgent === 'string' ? `Switched to: ${metadata.toAgent}` : '',
        typeof metadata.reason === 'string' ? `Reason: ${metadata.reason}` : '',
      ].filter(Boolean);

    case 'AGENT_SWITCH_END':
      return [
        typeof metadata.fromAgent === 'string' ? `Returned from: ${metadata.fromAgent}` : '',
      ].filter(Boolean);

    default:
      return [];
  }
}

function isUsefulEntry(entry: AgentLogEntry): boolean {
  if (entry.actionType !== 'SDK_ASSISTANT') return true;
  const description = entry.description?.trim();
  return Boolean(description && description !== 'Assistant message');
}

export default function AgentLogPanel({ activityLog }: AgentLogPanelProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const visibleEntries = activityLog.filter(isUsefulEntry);

  if (visibleEntries.length === 0) {
    return (
      <div className="empty-state">
        <h3>No useful activity yet</h3>
        <p>Tool calls, file operations, bash commands, and real assistant messages will appear here.</p>
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

  // Build set of entry indices that are inside AGENT_SWITCH bounded regions
  const boundedIndices = new Set<number>();
  const switchAgents = new Map<number, string>(); // START index -> toAgent
  let currentSwitchStart = -1;
  for (let i = 0; i < visibleEntries.length; i++) {
    if (visibleEntries[i].actionType === 'AGENT_SWITCH_START') {
      currentSwitchStart = i;
      const meta = parseMetadata(visibleEntries[i].metadata);
      if (meta && typeof meta.toAgent === 'string') {
        switchAgents.set(i, meta.toAgent);
      }
    } else if (visibleEntries[i].actionType === 'AGENT_SWITCH_END' && currentSwitchStart >= 0) {
      // Mark all entries between START and END (exclusive of START/END themselves)
      for (let j = currentSwitchStart + 1; j < i; j++) {
        boundedIndices.add(j);
      }
      currentSwitchStart = -1;
    }
  }

  const renderEntry = (entry: AgentLogEntry) => {
    const badge = ACTION_TYPE_BADGES[entry.actionType] || { className: 'log-type-session', label: entry.actionType };
    const isOpen = openIds.has(entry.id);
    const metadata = parseMetadata(entry.metadata);
    const highlights = getMetadataHighlights(entry, metadata);
    const description = entry.description || entry.actionType;

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
            {truncate(description, 200)}
          </span>
          <span style={{ color: 'var(--text-dim)', fontSize: '10px', flexShrink: 0 }}>
            {formatTimestamp(entry.createdAt)}
          </span>
        </div>
        <div className="log-entry-body">
          <div style={{ marginBottom: highlights.length > 0 || metadata ? '8px' : '0' }}>{description}</div>
          {highlights.length > 0 && (
            <div style={{ marginBottom: metadata ? '8px' : '0', display: 'grid', gap: '4px' }}>
              {highlights.map((line, idx) => (
                <div key={idx} style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                  {line}
                </div>
              ))}
            </div>
          )}
          {metadata && (
            <pre style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
              {JSON.stringify(metadata, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  };

  // Render with bounded regions for agent switches
  const rendered: React.ReactNode[] = [];
  let inBoundedRegion = false;
  let boundedChildren: React.ReactNode[] = [];
  let boundedAgent = '';

  for (let i = 0; i < visibleEntries.length; i++) {
    const entry = visibleEntries[i];

    // Render phase dividers for clean visual separation
    if (entry.actionType === 'TASK_TRANSITION' && entry.description?.includes('submitted -> working')) {
      rendered.push(
        <div key={`phase-divider-${entry.id}`} className="chat-divider" style={{ margin: '12px 0' }}>
          routed — planning
        </div>
      );
      continue;
    }

    // Render execution divider when worker claims a run (planning → execution boundary)
    if (entry.actionType === 'WORKER_CLAIM') {
      rendered.push(
        <div key={`exec-divider-${entry.id}`} className="chat-divider" style={{ margin: '12px 0' }}>
          plan approved — executing
        </div>
      );
      continue;
    }

    if (entry.actionType === 'AGENT_SWITCH_START') {
      boundedAgent = switchAgents.get(i) ?? 'unknown';
      inBoundedRegion = true;
      boundedChildren = [];

      // Render the START entry itself (outside the bounded region)
      rendered.push(renderEntry(entry));

      // Render separator line and agent label
      rendered.push(
        <div key={`switch-sep-start-${entry.id}`}>
          <div style={{
            height: '3px',
            background: 'var(--border-accent, #4a9eff)',
            margin: '12px 0 4px 0',
          }} />
          <div style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--border-accent, #4a9eff)',
            marginBottom: '4px',
          }}>
            Department Head: {boundedAgent}
          </div>
        </div>
      );
      continue;
    }

    if (entry.actionType === 'AGENT_SWITCH_END' && inBoundedRegion) {
      // Render bounded region container with all children
      rendered.push(
        <div key={`bounded-region-${entry.id}`} style={{
          borderLeft: '3px solid var(--border-accent, #4a9eff)',
          background: 'var(--bg-surface-hover, rgba(74, 158, 255, 0.05))',
          paddingLeft: '12px',
          marginTop: '8px',
          marginBottom: '8px',
        }}>
          {boundedChildren}
        </div>
      );

      // Render end separator
      rendered.push(
        <div key={`switch-sep-end-${entry.id}`} style={{
          height: '3px',
          background: 'var(--border-accent, #4a9eff)',
          margin: '4px 0 12px 0',
        }} />
      );

      // Render the END entry itself
      rendered.push(renderEntry(entry));

      inBoundedRegion = false;
      boundedChildren = [];
      continue;
    }

    if (inBoundedRegion) {
      boundedChildren.push(renderEntry(entry));
    } else {
      rendered.push(renderEntry(entry));
    }
  }

  // If bounded region was never closed, flush remaining children with end separator
  if (inBoundedRegion && boundedChildren.length > 0) {
    rendered.push(
      <div key="bounded-region-unclosed" style={{
        borderLeft: '3px solid var(--border-accent, #4a9eff)',
        background: 'var(--bg-surface-hover, rgba(74, 158, 255, 0.05))',
        paddingLeft: '12px',
        marginTop: '8px',
        marginBottom: '8px',
      }}>
        {boundedChildren}
      </div>
    );
    rendered.push(
      <div key="switch-sep-end-unclosed" style={{
        height: '3px',
        background: 'var(--border-accent, #4a9eff)',
        margin: '4px 0 12px 0',
      }} />
    );
  }

  return (
    <div style={{ padding: '8px' }}>
      {rendered}
    </div>
  );
}
