// A2A TypeScript interfaces — Per AGENT-05
// Re-export TaskState from state-machine for convenience
export type { TaskState } from '@/lib/state-machine';

export interface AgentCard {
  agentId: string;
  name: string;
  department: string;
  role: 'executive' | 'temp';
  description: string;
  tools: string[];           // tool names this agent can use
  skills: string[];          // skill names loaded
  avatarColor: string;       // CSS color for UI (e.g., '#FF4444' for Tamir)
}

export interface A2AMessage {
  role: 'user' | 'assistant';
  agentId: string;
  content: string;
  timestamp: string;         // ISO 8601
  turnType?: string;         // from structured output (e.g., 'question', 'plan_ready', 'routing')
  metadata?: Record<string, unknown>;
}

export interface TaskConfig {
  autonomyLevel: 'minimal' | 'balanced' | 'high' | 'full';
  maxBudgetUsd: number;
  constraints: string;
  selectedTools: string[];
  selectedSkills: string[];
  toolHints: Record<string, string>;  // toolId -> CEO hint text
}

export interface TaskHandoff {
  fromAgentId: string;
  toAgentId: string;
  reason: string;
  timestamp: string;
}

export interface A2ATask {
  id: string;
  title: string;
  description: string | null;
  department: string;
  state: import('@/lib/state-machine').TaskState;
  config: TaskConfig | null;
  planningAgentId: string | null;
  executorAgentId: string | null;
  supervisorAgentId: string | null;
  currentActorId: string | null;
  contextId: string | null;
  chatFilePath: string | null;
  planMarkdown: string | null;
  reviewFeedback: string | null;
  reviewRound: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// Per AGENT-04: structured output schemas for routing and planning turns
export interface RoutingResult {
  department: 'tech' | 'marketing' | 'operations';
  confidence: number;
  reasoning: string;
  suggested_title: string;
}

export interface AgentTurnResult {
  turn_type: 'question' | 'clarification' | 'plan_ready' | 'plan_update' | 'done';
  message: string;
  plan_markdown?: string;    // present when turn_type is 'plan_ready' or 'plan_update'
}
