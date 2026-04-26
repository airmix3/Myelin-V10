/**
 * timeline.ts -- Groups activity logs into agent sessions for the Task Flow timeline.
 * Sessions are bounded by SDK_SESSION_INIT → SDK_RESULT_SUCCESS/SDK_RESULT_ERROR.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TimelineNode {
  sessionIndex: number;
  agentId: string;
  agentName: string;       // human-readable (e.g., "CTO", "Tamir")
  department: string;
  startedAt: string;       // ISO timestamp
  endedAt: string | null;
  actionCount: number;     // number of activity log entries in this session
  rawActions: Array<{ actionType: string; description: string | null; createdAt: string }>;
  isShadow: boolean;       // true for memory reviewer, tool installer, system maintainer
  summary: string | null;  // filled by summarizer, null initially
  nodeLabel: string | null; // short label like "Planning", "Executing", filled by summarizer
}

export interface TimelineConnector {
  fromIndex: number;
  toIndex: number;
  label: string;           // "Routed", "Delegated", "Sent for Review", etc.
}

export interface TaskTimeline {
  taskId: string;
  nodes: TimelineNode[];
  connectors: TimelineConnector[];
  summarized: boolean;     // whether LLM summarization has been applied
}

interface ActivityLogEntry {
  id: string;
  taskId: string | null;
  agentId: string | null;
  actionType: string;
  description: string | null;
  metadata: string | null;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SHADOW_PATTERNS = ['memory', 'installer', 'maintainer'];

const AGENT_NAMES: Record<string, string> = {
  tamir: 'Tamir',
  cto: 'CTO',
  cmo: 'CMO',
  coo: 'COO',
  'system-maintainer': 'System Maintainer',
};

const AGENT_DEPARTMENTS: Record<string, string> = {
  tamir: 'cos',
  cto: 'tech',
  cmo: 'marketing',
  coo: 'operations',
  'system-maintainer': 'cos',
};

const SESSION_END_TYPES = new Set(['SDK_RESULT_SUCCESS', 'SDK_RESULT_ERROR', 'SDK_RESULT_FAILURE']);

// ── Helpers ────────────────────────────────────────────────────────────────────

function isShadowAgent(agentId: string, metadata: string | null): boolean {
  const lower = agentId.toLowerCase();
  if (SHADOW_PATTERNS.some((p) => lower.includes(p))) return true;
  if (metadata) {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed?.shadow === true) return true;
    } catch { /* ignore */ }
  }
  return false;
}

function resolveAgentName(agentId: string): string {
  return AGENT_NAMES[agentId] ?? agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

function resolveAgentDepartment(agentId: string): string {
  return AGENT_DEPARTMENTS[agentId] ?? 'unknown';
}

function inferConnectorLabel(
  prevNode: TimelineNode,
  nextNode: TimelineNode,
  prevEndType: string | null,
): string {
  if (prevEndType && SESSION_END_TYPES.has(prevEndType) && prevEndType !== 'SDK_RESULT_SUCCESS') {
    return 'Retry';
  }
  if (prevNode.agentId !== nextNode.agentId) {
    return prevNode.agentId === 'tamir' ? 'Routed' : 'Delegated';
  }
  return 'Resumed';
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function groupActivityLogsIntoSessions(
  taskId: string,
  logs: ActivityLogEntry[],
): TaskTimeline {
  // Sort chronologically
  const sorted = [...logs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const nodes: TimelineNode[] = [];
  let current: TimelineNode | null = null;
  let lastEndActionType: string | null = null;

  for (const log of sorted) {
    const agentId = log.agentId ?? 'unknown';

    if (log.actionType === 'SDK_SESSION_INIT') {
      // Close any open session
      if (current) {
        nodes.push(current);
      }

      current = {
        sessionIndex: nodes.length,
        agentId,
        agentName: resolveAgentName(agentId),
        department: resolveAgentDepartment(agentId),
        startedAt: log.createdAt,
        endedAt: null,
        actionCount: 1,
        rawActions: [{ actionType: log.actionType, description: log.description, createdAt: log.createdAt }],
        isShadow: isShadowAgent(agentId, log.metadata),
        summary: null,
        nodeLabel: null,
      };
    } else if (SESSION_END_TYPES.has(log.actionType)) {
      if (current) {
        current.endedAt = log.createdAt;
        current.actionCount++;
        current.rawActions.push({ actionType: log.actionType, description: log.description, createdAt: log.createdAt });
        lastEndActionType = log.actionType;
        nodes.push(current);
        current = null;
      }
    } else {
      // Accumulate into current session
      if (current) {
        current.actionCount++;
        current.rawActions.push({ actionType: log.actionType, description: log.description, createdAt: log.createdAt });
      }
    }
  }

  // Close any unclosed session
  if (current) {
    nodes.push(current);
  }

  // Fix session indices after building
  nodes.forEach((n, i) => { n.sessionIndex = i; });

  // Generate connectors between consecutive sessions
  const connectors: TimelineConnector[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const prevEndType = nodes[i].rawActions.length > 0
      ? nodes[i].rawActions[nodes[i].rawActions.length - 1].actionType
      : null;

    connectors.push({
      fromIndex: i,
      toIndex: i + 1,
      label: inferConnectorLabel(nodes[i], nodes[i + 1], prevEndType),
    });
  }

  return {
    taskId,
    nodes,
    connectors,
    summarized: false,
  };
}
