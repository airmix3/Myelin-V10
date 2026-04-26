# 02 -- Agent System: Agent SDK, Souls, Agent Cards, Tools

## Overview

Myelin v10 uses the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) exclusively for all agent execution. There is NO custom BaseAgent class, NO manual `messages.create()` calls, NO custom tool loop, NO custom session management. The SDK handles everything: LLM calls, tool execution, session resume, skill discovery, cost tracking.

Each agent is defined by its **configuration** (soul, tools, card), not by a class. The Orchestrator holds configs and invokes agents via the SDK's `query()` function on demand.

## SDK-First Rule

When the Claude Agent SDK already provides a capability, Myelin should configure and use that capability rather than rebuilding it.

Use SDK built-ins for:

- built-in filesystem / shell / web tools
- skill discovery from `.claude/skills/`
- session resume via `session_id`
- custom tool exposure via `tool()` + `createSdkMcpServer()` + `mcpServers`
- permissioning / tool approval via `canUseTool` callback
- hooks
- subagents via `agents` option (AgentDefinition)
- `maxBudgetUsd` on `query()` for cost caps
- `outputFormat` for structured JSON output
- `includePartialMessages: true` for real-time build log streaming

Myelin custom code should be limited to:

- business workflow state and UI
- A2A task/domain models
- access control for company resources (via `canUseTool` callback)
- persistence, indexing, and company-specific policies

## Canonical Actor Model

Every task has four logical actor roles, even if one agent fills multiple roles:

- **planningAgentId** -- The department head who plans with the CEO
- **executorAgentId** -- The agent currently doing the approved work
- **supervisorAgentId** -- The department head responsible for final review and closure
- **currentActorId** -- The agent expected to act next

Default rules:

- CEO -> Tamir route -> dept head becomes `planningAgentId`
- On approval, the same dept head becomes `supervisorAgentId`
- If the dept head executes directly, that same agent is also `executorAgentId`
- If the dept head hires a temp employee, the temp becomes `executorAgentId`
- `currentActorId` changes as the task moves between planning, execution, review, and clarification

**Important**: do not keep a legacy `assignedTo` field in the canonical implementation. Use the four actor-role fields directly.

### Task Lifecycle (Derived from Timestamps, Not a Phase Field)

The task has NO explicit `phase` field. Lifecycle stage is derived from timestamps and actor state:

| Stage | Derived From | Description |
|-------|-------------|-------------|
| **Planning** | `approvedAt` is null | Dept head is planning with the CEO |
| **Execution** | `approvedAt` is set, `completedAt` is null, `currentActorId !== supervisorAgentId` | Executor is doing the approved work |
| **Review** | `currentActorId === supervisorAgentId` (after execution) | Supervisor is reviewing deliverables |
| **Done** | `completedAt` is set or status is terminal (`completed`, `failed`, `canceled`) | Task is finished |

Helper to derive lifecycle stage:

```typescript
type LifecycleStage = 'planning' | 'execution' | 'review' | 'done';

function deriveLifecycleStage(task: Task): LifecycleStage {
  if (task.status === 'completed' || task.status === 'failed' || task.status === 'canceled') {
    return 'done';
  }
  if (!task.approvedAt) {
    return 'planning';
  }
  if (task.currentActorId === task.supervisorAgentId && task.approvedAt) {
    return 'review';
  }
  return 'execution';
}
```

### A2A Task States (Standard Only)

Only the following standard A2A states are used:

| State | Meaning |
|-------|---------|
| `submitted` | Task created, awaiting planning |
| `working` | Agent is actively working (planning, executing, or reviewing) |
| `input-required` | Blocked -- needs human input (CEO clarification, hire approval, budget increase) |
| `completed` | Task finished successfully |
| `failed` | Task terminated with error or rejection |
| `canceled` | Task canceled by CEO |

Mappings from previously proposed non-standard states:

- ~~`review`~~ -> `working` with `currentActorId = supervisorAgentId`
- ~~`auth-required`~~ -> `input-required` with `metadata.inputType` indicating reason (`hire_approval`, `budget_increase`, `ceo_clarification`)
- ~~`rejected`~~ -> `failed` with `metadata.reason`

### What Each Agent Has

- **Soul** (`src/agents/{id}/soul.md`) -- System prompt defining personality, rules, capabilities
- **Agent Card** (`src/agents/{id}/card.json`) -- A2A-compliant JSON declaring skills for routing
- **Custom Tools** -- Myelin-specific tools (knowledge, vault, consult, etc.) exposed via an in-process MCP server at query time
- **CLAUDE.md per desk** -- Task-specific plan + constraints, loaded by SDK automatically from cwd
- **MEMORY.md** (`data/agents/{id}/MEMORY.md`) -- Personal persistent memory managed via global memory-management skill
- **Session ID** -- SDK-managed session resume across `query()` calls (NO custom JSONL)

## Agent Configuration (No BaseAgent Class)

Instead of a class hierarchy, each agent is a **config object**. The Orchestrator uses these configs to invoke `query()`:

```typescript
// src/agents/types.ts
import type { ReturnType } from '@anthropic-ai/claude-agent-sdk';

export interface AgentConfig {
  agentId: string;
  department: string | null;
  soulPath: string;               // Path to soul.md
  cardPath: string;               // Path to card.json
  builtInTools: string[];         // SDK built-ins exposed in Claude's context
  customToolNames: string[];      // Logical tool names used for policy / docs
}
```

**Canonical SDK rule**: Myelin custom tools are **not** passed to `query()` as plain `{ name, handler }` objects. They must be defined with the SDK `tool()` helper using **Zod schemas** for input validation, bundled into an in-process MCP server via `createSdkMcpServer()`, and passed to `query()` through `options.mcpServers`.

### Tool Definitions: Zod Raw Shapes + Content Array Returns

The SDK `tool()` function takes **positional arguments** with a **Zod raw shape** (NOT `z.object()`). Every tool handler must return the SDK content array format:

```typescript
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// tool(name, description, inputSchema, handler, extras?)
// inputSchema is a RAW Zod shape -- { key: z.type() } -- NOT z.object()
const searchKnowledgeTool = tool(
  'search_knowledge',
  'Search department knowledge base',
  {
    query: z.string().describe('Search query'),
    scope: z.enum(['department', 'vault']).describe('Search scope'),
    limit: z.number().optional().default(10).describe('Max results'),
  },
  async (input) => {
    // input is typed: { query: string; scope: 'department' | 'vault'; limit: number }
    const results = await searchKnowledge(input.query, input.scope, input.limit);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
    };
  }
);
```

**Rules**:
- `tool()` takes **positional args**: `tool(name, description, inputSchema, handler, extras?)`
- `inputSchema` must be a **raw Zod shape** `{ key: z.string() }` -- never `z.object(...)` and never JSON Schema `{ type: 'object', properties: {...} }`
- Handler must return `{ content: [{ type: 'text', text: '...' }] }` -- never a plain string
- Use `.describe()` on each Zod field for tool documentation

## How Agents Run (SDK query() Exclusively)

Every agent invocation is a `query()` call. The SDK spawns a subprocess, runs the full agent loop (LLM + tools + multi-turn), and returns when done. Between calls, the agent doesn't exist as a process.

```typescript
// src/agents/invoke.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../db';
import { buildMyelinMcpServer } from '../tools';
import { buildCanUseTool } from '../tools/access-control';

export async function invokeAgent(
  config: AgentConfig,
  prompt: string,
  options: {
    cwd?: string;                    // Desk path (agent's working directory)
    sessionId?: string;              // Resume previous conversation
    extraSystemPrompt?: string;      // Additional context
    maxBudgetUsd?: number;           // SDK-level budget cap
    taskId?: string;                 // For cost tracking -- links cost_events to task
    outputFormat?: { type: 'json_schema'; schema: Record<string, any> };  // Structured output
    agents?: Record<string, AgentDefinition>;  // SDK subagents (temp employees)
  } = {}
): Promise<InvokeResult> {
  // Load soul from agent's directory
  const soul = readFileSync(config.soulPath, 'utf-8');
  const systemAppend = options.extraSystemPrompt
    ? `${soul}\n\n## Current Context\n${options.extraSystemPrompt}`
    : soul;

  // Built-in SDK tools exposed in Claude's context
  const builtInTools = [
    ...config.builtInTools,
    'Skill', // Native skill discovery from .claude/skills/
  ];

  // Build invocation-specific custom tools via the canonical ToolContext closure pattern
  const myelinServer = buildMyelinMcpServer({
    agentId: config.agentId,
    department: config.department,
    taskId: options.taskId ?? 'ad_hoc',
    supervisorAgentId: config.agentId,
    deskPath: options.cwd ?? '.',
    deliverablesPath: options.cwd ? join(options.cwd, '..', 'deliverables') : 'deliverables',
  });

  // Pre-approve tools that should run without prompting
  const allowedTools = [
    ...builtInTools,
    ...config.customToolNames.map((name) => `mcp__myelin__${name}`),
  ];

  let sessionId = options.sessionId;
  let totalCostUsd = 0;
  let resultText = '';

  for await (const message of query({
    prompt,
    options: {
      // Use preset to auto-load CLAUDE.md files from the desk
      systemPrompt: { type: 'preset', preset: 'claude_code', append: systemAppend },
      cwd: options.cwd,                                 // Desk = agent's filesystem sandbox
      settingSources: ['project'],                      // Load skills from desk/.claude/skills/
      tools: builtInTools,                              // Controls built-in tool availability
      mcpServers: { myelin: myelinServer },             // Custom tools exposed via MCP
      allowedTools,
      permissionMode: 'acceptEdits',
      includePartialMessages: true,                     // Stream partial messages for real-time build log
      maxBudgetUsd: options.maxBudgetUsd,               // SDK-level budget enforcement
      canUseTool: buildCanUseTool(config.agentId, config.department),  // Runtime access control
      ...(options.outputFormat ? { outputFormat: options.outputFormat } : {}),  // Structured output
      ...(options.agents ? { agents: options.agents } : {}),  // SDK subagents
      ...(sessionId ? { resume: sessionId } : {}),      // Resume if continuing conversation
    }
  })) {
    // Capture session ID for future resume
    if (message.type === 'system' && message.subtype === 'init') {
      sessionId = message.session_id;
    }

    // Stream partial messages to build log
    if (message.type === 'assistant' && message.partial) {
      eventBus.emit('task:buildlog', {
        agentId: config.agentId,
        content: message.content,
        partial: true,
      });
    }

    // Capture result (final message of query)
    if (message.type === 'result') {
      totalCostUsd = message.total_cost_usd ?? 0;
      resultText = message.result ?? '';

      // Track cost in database using SDK's built-in cost data
      await db.costEvent.create({
        data: {
          agentId: config.agentId,
          taskId: options.taskId || null,  // Links cost to specific task
          modelId: 'sdk-managed',   // SDK chooses model from env vars
          inputTokens: message.usage?.input_tokens ?? 0,
          outputTokens: message.usage?.output_tokens ?? 0,
          costCents: totalCostUsd * 100,
        }
      });
    }

    // Capture assistant text for logging
    if (message.type === 'assistant' && !message.partial) {
      const text = message.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('') || '';
      if (text) resultText = text;
    }
  }

  // Log activity
  await db.activityLog.create({
    data: {
      agentId: config.agentId,
      actionType: 'AGENT_INVOKED',
      description: resultText.substring(0, 200),
      metadata: JSON.stringify({ sessionId, costUsd: totalCostUsd }),
    }
  });

  return { sessionId: sessionId!, resultText, totalCostUsd };
}

export interface InvokeResult {
  sessionId: string;
  resultText: string;
  totalCostUsd: number;
}
```

### Access Control via `canUseTool`

Instead of building different MCP servers per role, use a single `canUseTool` callback that checks the agent's role at runtime. The callback must return `{ behavior: 'allow' | 'deny', message?: string }`:

```typescript
// src/tools/access-control.ts
import type { CanUseToolResult } from '@anthropic-ai/claude-agent-sdk';

const DENY = (msg: string): CanUseToolResult => ({ behavior: 'deny', message: msg });
const ALLOW: CanUseToolResult = { behavior: 'allow' };

export function buildCanUseTool(agentId: string, department: string | null) {
  return async (toolName: string, input: unknown): Promise<CanUseToolResult> => {
    // Dept-head-only tools
    if (['mcp__myelin__hire_employee', 'mcp__myelin__approve_deliverable',
         'mcp__myelin__write_knowledge', 'mcp__myelin__request_changes'].includes(toolName)
        && !['cto', 'cmo', 'coo'].includes(agentId)) {
      return DENY('Only department heads can use this tool');
    }

    // Consultation requires dept head (no temps)
    if (toolName === 'mcp__myelin__consult_agent' && !['cto', 'cmo', 'coo'].includes(agentId)) {
      return DENY('Only department heads can consult other agents');
    }

    // Tamir-only tools
    if (['mcp__myelin__read_inbox', 'mcp__myelin__get_dept_status'].includes(toolName)
        && agentId !== 'tamir') {
      return DENY('Only Tamir can use this tool');
    }

    // Vault access: Tamir + dept heads
    if (toolName === 'mcp__myelin__file_to_vault'
        && !['tamir', 'cto', 'cmo', 'coo'].includes(agentId)) {
      return DENY('Only Tamir and department heads can write to vault');
    }

    // Tamir doesn't need shell
    if (toolName === 'Bash' && agentId === 'tamir') {
      return DENY('Tamir does not use shell commands');
    }

    return ALLOW;
  };
}
```

This replaces the pattern of building different MCP servers per role. All tools are registered once; access is enforced at runtime via the `canUseTool` callback which returns `{ behavior, message }`.

## Structured Agent Turn Contract (SDK outputFormat)

Planning and review must return explicit machine-readable intent. Use SDK `outputFormat` to guarantee valid JSON -- no `<!-- TURN: -->` footer parsing, no `interpretPlanningTurn()` string matching.

```typescript
/** JSON Schema for agent planning/review turns.
 *  Used with SDK outputFormat -- must be JSON Schema, NOT Zod. */
export const AGENT_TURN_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: [
      'ask_for_input',
      'plan_ready',
      'execution_update',
      'review_approved',
      'review_changes_requested',
      'task_failed',
    ] },
    message: { type: 'string', description: 'Human-facing text shown in chat/build log' },
    planMarkdown: { type: 'string', description: 'Present when type === plan_ready' },
    reviewFeedback: { type: 'string', description: 'Present when type === review_changes_requested' },
    metadata: { type: 'object' },
  },
  required: ['type', 'message'],
} as const;

/** TypeScript type matching the schema above */
export interface AgentTurnResult {
  type: 'ask_for_input' | 'plan_ready' | 'execution_update' | 'review_approved' | 'review_changes_requested' | 'task_failed';
  message: string;
  planMarkdown?: string;
  reviewFeedback?: string;
  metadata?: Record<string, any>;
}
```

When invoking a planning or review turn, pass `outputFormat` to the SDK:

```typescript
// Planning turn with structured output
// NOTE: outputFormat requires JSON Schema objects, NOT Zod schemas
for await (const message of query({
  prompt: ceoMessage,
  options: {
    systemPrompt: { type: 'preset', preset: 'claude_code', append: soul },
    cwd: planningDeskPath,
    outputFormat: {
      type: 'json_schema',
      schema: AGENT_TURN_SCHEMA,   // JSON Schema object -- SDK enforces valid JSON
    },
    // ... other options
  }
})) {
  if (message.type === 'result') {
    const turn: AgentTurnResult = JSON.parse(message.result);
    // turn.type is guaranteed to be one of the enum values
    // No string matching, no footer parsing
  }
}
```

### Key Points

- **No `messages.create()`** -- the SDK's `query()` handles the full LLM loop
- **No custom tool loop** -- the SDK calls tools, reads results, continues automatically
- **Custom tools use MCP + Zod** -- define them with `tool()` using Zod schemas, wrap with `createSdkMcpServer()`, pass them via `mcpServers`
- **No custom session JSONL** -- the SDK manages sessions via `session_id` / `resume`
- **Cost tracking is SDK-built-in** -- `message.total_cost_usd` on result message (see: https://platform.claude.com/docs/en/agent-sdk/cost-tracking)
- **Budget enforcement** -- use `maxBudgetUsd` on `query()` as primary cap, plus Myelin-level secondary check
- **Structured output** -- use `outputFormat` with Zod schemas, never parse natural language
- **Access control** -- use `canUseTool` callback, not per-role MCP server builds
- **Real-time streaming** -- use `includePartialMessages: true` for build log
- **CLAUDE.md auto-load** -- use `systemPrompt: { type: 'preset', preset: 'claude_code', append: soul }` so CLAUDE.md files from the desk are loaded automatically
- **State transitions are SDK-driven** -- the agent decides when it needs input vs when it's working. The SDK's behavior (asking questions, using tools, producing output) drives the A2A task state, not our code guessing from string matching
- **Do not reimplement SDK features** -- if hooks, subagents, permissions, skill loading, or tool calling can solve the problem, prefer that over new Myelin abstractions

### Session Resume

The SDK returns a `session_id` on the init message. Store it on the task record. Pass it as `resume` on the next `query()` to restore full conversation context:

```typescript
// First call: agent clarifies
const result1 = await invokeAgent(ctoConfig, ceoMessage, { cwd: deskPath });
// Save session_id to task: result1.sessionId

// Second call: CEO answers, agent resumes with full context
const result2 = await invokeAgent(ctoConfig, ceoAnswer, {
  cwd: deskPath,
  sessionId: result1.sessionId,  // Full prior conversation restored
});
```

### Skill Hot-Loading

Skills are rescanned from `desk/.claude/skills/` at EVERY `query()` start (including resume). If a new skill is approved between calls, the next invocation picks it up automatically. No code needed.

## Chat History on Filesystem

Chat history is stored as JSONL files on the filesystem, NOT in a database `chatHistory` JSON column.

| Context | Path | Format |
|---------|------|--------|
| Planning chat | `data/departments/{dept}/planning-desk/chat/{taskId}.jsonl` | One JSON object per line |
| Task execution chat | `data/departments/{dept}/tasks/{slug}/chat.jsonl` | One JSON object per line |

Each line is a JSON object:

```typescript
interface ChatLine {
  ts: string;          // ISO 8601 timestamp
  role: 'user' | 'assistant' | 'system';
  agentId: string;
  content: string;
  turnType?: string;   // AgentTurnResult.type if structured
  costUsd?: number;
}
```

```typescript
import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

function appendChat(chatPath: string, line: ChatLine) {
  mkdirSync(dirname(chatPath), { recursive: true });
  appendFileSync(chatPath, JSON.stringify(line) + '\n');
}

// Planning phase chat
const planningChatPath = `data/departments/${dept}/planning-desk/chat/${taskId}.jsonl`;
appendChat(planningChatPath, { ts: new Date().toISOString(), role: 'user', agentId: 'ceo', content: ceoMessage });

// Execution phase chat
const taskChatPath = `data/departments/${dept}/tasks/${slug}/chat.jsonl`;
appendChat(taskChatPath, { ts: new Date().toISOString(), role: 'assistant', agentId: 'cto', content: resultText, costUsd: totalCostUsd });
```

## Orchestrator

The Orchestrator holds agent configs (not agent instances). It invokes agents via `invokeAgent()` on demand.

```typescript
// src/agents/orchestrator.ts
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { AgentConfig } from './types';
import { invokeAgent, InvokeResult } from './invoke';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getCustomToolNamesForRole } from '../tools';
import { eventBus } from '../lib/events';

export class Orchestrator {
  private static instance: Orchestrator;
  private configs: Record<string, AgentConfig> = {};

  private constructor() {
    this.loadAgentConfigs();
  }

  static get(): Orchestrator {
    if (!this.instance) this.instance = new Orchestrator();
    return this.instance;
  }

  private loadAgentConfigs() {
    const agents = ['tamir', 'cto', 'cmo', 'coo'];
    for (const id of agents) {
      const agentDir = join(__dirname, id);
      const card = JSON.parse(readFileSync(join(agentDir, 'card.json'), 'utf-8'));
      const department = card.department || null;

      this.configs[id] = {
        agentId: id,
        department,
        soulPath: join(agentDir, 'soul.md'),
        cardPath: join(agentDir, 'card.json'),
        builtInTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
        customToolNames: getCustomToolNamesForRole(id, department),
      };
    }
  }

  getConfig(agentId: string): AgentConfig {
    return this.configs[agentId];
  }

  /** Invoke an agent via SDK query() */
  async invoke(agentId: string, prompt: string, options?: {
    cwd?: string;
    sessionId?: string;
    extraSystemPrompt?: string;
    maxBudgetUsd?: number;
    taskId?: string;
    outputFormat?: { type: 'json_schema'; schema: Record<string, any> };
    agents?: Record<string, AgentDefinition>;
  }): Promise<InvokeResult> {
    const config = this.getConfig(agentId);
    if (!config) throw new Error(`Unknown agent: ${agentId}`);

    const result = await invokeAgent(config, prompt, options);

    // Emit event for SSE subscribers
    eventBus.emit('agent:invoked', {
      agentId,
      sessionId: result.sessionId,
      costUsd: result.totalCostUsd,
    });

    return result;
  }
}

export const getOrchestrator = () => Orchestrator.get();
```

**Canonical rule**: `Orchestrator.invoke()` exposes the same option surface that higher-level docs use during planning, routing, consultation, review, and delegation. In practice, that means it forwards `outputFormat` and `agents` to `invokeAgent()` in addition to `cwd`, `sessionId`, `extraSystemPrompt`, and `maxBudgetUsd`.

## Planning Desk

Each department head has a **persistent planning desk** at `data/departments/{dept}/planning-desk/`. During planning, the agent's `cwd` is this desk. The planning desk persists across tasks -- it is the dept head's "office" where they receive assignments, think, and draft plans.

```
data/departments/tech/
  planning-desk/
    .claude/
      skills/                    -- Symlinked dept + global skills
    CLAUDE.md                    -- Dept head's standing instructions
    chat/
      task_abc123.jsonl          -- Planning conversation for this task
      task_def456.jsonl          -- Planning conversation for another task
    drafts/                      -- Scratch space for planning
```

On approval, a NEW task-specific desk is created (see `createTaskWorkspace` below). The planning desk is never used for execution.

```typescript
function getPlanningDeskPath(department: string): string {
  return join('data/departments', department, 'planning-desk');
}

// Ensure planning desk exists at system init
function ensurePlanningDesk(department: string) {
  const desk = getPlanningDeskPath(department);
  mkdirSync(join(desk, '.claude', 'skills'), { recursive: true });
  mkdirSync(join(desk, 'chat'), { recursive: true });
  mkdirSync(join(desk, 'drafts'), { recursive: true });
  symlinkActiveSkills(department, join(desk, '.claude', 'skills'));
}
```

## Task Execution (Background, Concurrent)

After the CEO approves a plan, execution runs through a minimal durable job queue. The API should enqueue work and return quickly; a worker loop claims and runs it.

**Multiple task runs can execute concurrently** (e.g., CTO and CMO working on different tasks simultaneously). The worker loop polls for all queued runs and spawns them in parallel.

## Budget Enforcement

Budget is enforced at two levels:

1. **SDK-level** (`maxBudgetUsd`): Pass to `query()` -- the SDK will stop the agent if cost exceeds this cap within a single invocation.
2. **Myelin-level** (secondary check): Before and after each `query()` call, check the cumulative task cost against the task's budget. This catches multi-invocation budget overruns.

```typescript
function getRemainingBudgetUsd(task: Task): number {
  return (task.maxBudgetCents / 100) - task.totalCostUsd;
}

async function enforceBudgetBeforeInvoke(task: Task) {
  const remaining = getRemainingBudgetUsd(task);
  if (remaining <= 0) {
    await transitionTask(task.taskId, 'input-required', {
      message: `Budget exhausted ($${task.totalCostUsd.toFixed(2)} of $${(task.maxBudgetCents / 100).toFixed(2)} used)`,
      metadata: { inputType: 'budget_increase' },
    });
    throw new Error('Budget exceeded');
  }
}
```

**Runtime requirement**: this design assumes a persistent self-hosted Node.js process. It is valid for `next dev` / `next start` on a long-lived server. It is **not** safe for serverless or edge runtimes that may freeze or terminate the process after the HTTP response.

```typescript
// Called from POST /api/tasks/{taskId}/approve
export async function enqueueTaskExecution(taskId: string) {
  await db.taskRun.create({
    data: {
      id: generateId('run'),
      taskId,
      status: 'queued',
      startedAt: null,
      heartbeatAt: null,
    }
  });
}

// Worker loop claims queued runs and executes them CONCURRENTLY
async function workerLoop() {
  while (true) {
    const queuedRuns = await db.taskRun.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });

    // Spawn all queued runs concurrently -- do not await sequentially
    for (const run of queuedRuns) {
      // Claim with optimistic lock to prevent double-execution
      const claimed = await db.taskRun.updateMany({
        where: { id: run.id, status: 'queued' },
        data: { status: 'executing', startedAt: new Date(), heartbeatAt: new Date() },
      });
      if (claimed.count === 0) continue;  // Another worker got it

      // Fire and forget -- runs concurrently with other tasks
      executeQueuedRun(run.id).catch(async (err) => {
        await db.taskRun.update({
          where: { id: run.id },
          data: { status: 'failed', completedAt: new Date() },
        });
        console.error(`Run ${run.id} failed:`, err);
      });
    }

    await sleep(2000);  // Poll interval
  }
}

async function executeQueuedRun(runId: string) {
  const run = await db.taskRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error('Task run not found');

  const taskId = run.taskId;
  const task = await db.task.findUnique({ where: { taskId } });
  if (!task) throw new Error('Task not found');

  await enforceBudgetBeforeInvoke(task);

  const orch = getOrchestrator();
  await transitionTask(taskId, 'working');

  const remainingBudget = getRemainingBudgetUsd(task);

  // Invoke the canonical executor with SDK-level budget cap
  const result = await orch.invoke(task.executorAgentId, task.description, {
    cwd: task.deskPath,
    sessionId: task.sessionId || undefined,
    extraSystemPrompt: `Execute the approved plan. Your deliverables directory is at ${task.deliverablesPath}.`,
    maxBudgetUsd: remainingBudget,  // SDK enforces this cap
  });

  // Save session_id and update cost
  await db.task.update({
    where: { taskId },
    data: {
      sessionId: result.sessionId,
      totalCostUsd: { increment: result.totalCostUsd },
    },
  });

  // Append to task chat log
  appendChat(`data/departments/${task.department}/tasks/${task.slug}/chat.jsonl`, {
    ts: new Date().toISOString(),
    role: 'assistant',
    agentId: task.executorAgentId,
    content: result.resultText,
    costUsd: result.totalCostUsd,
  });

  // After agent finishes, transition to review by setting currentActorId to supervisor
  await db.task.update({
    where: { taskId },
    data: { currentActorId: task.supervisorAgentId },
  });
  await transitionTask(taskId, 'working');  // Still 'working', but lifecycle is now 'review'
  eventBus.emit('task:review', { taskId });

  await db.taskRun.update({
    where: { id: runId },
    data: { status: 'completed', completedAt: new Date() },
  });
}
```

### Worker Heartbeat

Long-running executions should emit periodic heartbeat signals so the UI can show liveness:

```typescript
const heartbeat = setInterval(async () => {
  await db.taskRun.update({
    where: { id: runId },
    data: { heartbeatAt: new Date() },
  });
  eventBus.emit('task:heartbeat', { taskId, agentId: task.executorAgentId, elapsedMs: Date.now() - startedAt });
}, 15000);
```

On worker startup, scan for `task_runs` with `status = 'executing'` and stale `heartbeatAt`, then mark them failed with reason `process_restart`.

### Concurrency: File-Level Locking

When multiple tasks run concurrently, shared resources (knowledge/ files, inbox.jsonl) need file-level locking:

```typescript
import { lockSync, unlockSync } from 'proper-lockfile';

async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const release = await lockSync(filePath, { retries: 5 });
  try {
    return await fn();
  } finally {
    release();
  }
}
```

## Delegation: SDK Subagents for Temp Employees

Department heads use **SDK subagents** (via the `agents` option in `query()`) instead of custom `provisionEmployee()` filesystem provisioning. The dept head defines an inline subagent with tools, prompt, and model override. The SDK manages the subagent lifecycle.

```typescript
import { z } from 'zod';

// The hire_employee tool now creates a subagent definition for the SDK
// tool() takes positional args: name, description, inputSchema (raw Zod shape), handler
const hireEmployeeTool = tool(
  'hire_employee',
  'Request to hire a temporary employee for this task. The CEO must approve before the employee starts.',
  {
    name: z.string().describe('Employee name (e.g. "Dr. Neural")'),
    role: z.string().describe('Role (e.g. "ML Researcher", "Data Scientist")'),
    specialty: z.string().describe('What they specialize in for this task'),
  },
  async (input) => {
    const hireId = generateId('hire');
    await db.hireRequest.create({
      data: {
        id: hireId,
        requestedBy: agentId,
        name: input.name,
        role: input.role,
        department: agentDepartment,
        specialty: input.specialty,
        taskDescription: currentTaskDescription,
        status: 'pending',
      }
    });

    await transitionTask(currentTaskId, 'input-required', {
      message: `Hire request for ${input.name} (${input.role})`,
      metadata: { inputType: 'hire_approval', hireId, name: input.name, role: input.role },
    });
    eventBus.emit('hire:requested', { hireId, taskId: currentTaskId });

    return {
      content: [{ type: 'text' as const, text: `Hire request submitted for ${input.name} (${input.role}). Waiting for CEO approval. Task paused.` }],
    };
  }
);
```

After CEO approves the hire, the dept head is re-invoked with the employee defined as an SDK subagent:

```typescript
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

// Called when CEO clicks "Approve" on hire request
async function approveHireAndStart(hireId: string) {
  const hire = await db.hireRequest.findUnique({ where: { id: hireId } });
  if (!hire) throw new Error('Hire not found');

  await db.hireRequest.update({
    where: { id: hireId },
    data: { status: 'approved', reviewedBy: 'ceo' },
  });

  // Define the employee as an SDK subagent
  // NOTE: agents option is Record<string, AgentDefinition>, NOT an array
  const employeeKey = hire.name.toLowerCase().replace(/\s+/g, '_');
  const employeeAgent: AgentDefinition = {
    description: `${hire.role} specializing in ${hire.specialty}`,
    systemPrompt: `You are ${hire.name}, a temporary ${hire.role} hired for a specific task.
You report to the ${hire.department} department head.
Specialty: ${hire.specialty}

## Rules
- Work within your desk directory (your cwd)
- Use promote_to_deliverable to submit finished work
- Be thorough, cite sources, produce reproducible results`,
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
    model: 'claude-sonnet-4-20250514',  // Cost-effective model for workers
  };

  // Find the parent task and resume the dept head with the subagent available
  const parentTask = await db.task.findFirst({
    where: { status: 'input-required', supervisorAgentId: hire.requestedBy },
  });

  if (parentTask) {
    await transitionTask(parentTask.taskId, 'working');

    const orch = getOrchestrator();
    const result = await orch.invoke(parentTask.supervisorAgentId,
      `Your hire request for ${hire.name} (${hire.role}) was approved. Delegate the task to them now.`, {
      cwd: parentTask.deskPath,
      sessionId: parentTask.sessionId || undefined,
      // SDK agents option is Record<string, AgentDefinition>
      agents: { [employeeKey]: employeeAgent },
    });
  }
}
```

The SDK handles all subagent lifecycle: spawning, tool access, conversation management, and termination. No custom filesystem provisioning needed.

## Review Flow: Executor -> Supervisor -> Completed

All executors, including department heads executing their own task, use `submit_for_review`. It sets `currentActorId` to the supervisor (deriving the lifecycle to "review"):

```typescript
// In src/tools/review.ts
const submitForReviewTool = tool(
  'submit_for_review',
  'Submit your work for department head review. Call this when your deliverables are ready in the deliverables/ directory.',
  {
    summary: z.string().describe('Brief summary of what you produced'),
  },
  async (input) => {
    // Set currentActorId to supervisor -- this derives lifecycle to 'review'
    await db.task.update({
      where: { taskId: currentTaskId },
      data: { currentActorId: supervisorAgentId },
    });
    await db.activityLog.create({
      data: {
        agentId,
        actionType: 'SUBMITTED_FOR_REVIEW',
        description: `Submitted: ${input.summary}`,
        metadata: JSON.stringify({ taskId: currentTaskId, summary: input.summary }),
      }
    });
    eventBus.emit('task:review', { taskId: currentTaskId, summary: input.summary });
    return {
      content: [{ type: 'text' as const, text: 'Work submitted for review. Your department head will evaluate it.' }],
    };
  }
);
```

The supervisor review is triggered when the system detects `currentActorId === supervisorAgentId` (lifecycle = review):

```typescript
async function triggerDeptHeadReview(taskId: string) {
  const task = await db.task.findUnique({ where: { taskId } });
  const orch = getOrchestrator();

  const result = await orch.invoke(task.supervisorAgentId, 'Review the deliverables for this task.', {
    cwd: task.deskPath,
    sessionId: task.sessionId || undefined,
    extraSystemPrompt: `Review round ${task.reviewRound + 1}. Check deliverables/ against the original CEO request and approved plan. If satisfactory, call approve_deliverable. If it needs changes, call request_changes with specific feedback. If you were also the executor, still perform a formal review and record the decision explicitly.`,
  });
}
```

### Review Loop: Feedback Storage and Resume

When the dept head calls `request_changes`:
1. Task `reviewFeedback` is set to the feedback text
2. Task `reviewRound` is incremented
3. `currentActorId` is set back to the executor
4. Employee is re-invoked with the feedback:

```typescript
// request_changes tool handler
const requestChangesTool = tool(
  'request_changes',
  'Request changes to the submitted deliverables.',
  {
    feedback: z.string().describe('Specific feedback on what needs to change'),
  },
  async (input) => {
    await db.task.update({
      where: { taskId: currentTaskId },
      data: {
        reviewFeedback: input.feedback,
        reviewRound: { increment: 1 },
        currentActorId: task.executorAgentId,  // Back to executor
      }
    });
    await transitionTask(currentTaskId, 'working');

    // Re-invoke the canonical executor with feedback
    const task = await db.task.findUnique({ where: { taskId: currentTaskId } });
    const orch = getOrchestrator();
    orch.invoke(task.executorAgentId, `Supervisor feedback (round ${task.reviewRound}): ${input.feedback}. Please revise your deliverables.`, {
      cwd: task.deskPath,
      sessionId: task.sessionId || undefined,
    }).catch(console.error);

    return {
      content: [{ type: 'text' as const, text: `Changes requested. Employee will revise. Round: ${task.reviewRound}` }],
    };
  }
);
```

When `approve_deliverable` is called, `completedAt` is set and the task status transitions to `completed`. Tamir is notified.

## Memory Access (MEMORY.md Outside CWD)

MEMORY.md lives at `data/agents/{agent_id}/MEMORY.md` -- outside the desk CWD. **Canonical rule**: agents access it via two custom tools. Do not rely on native filesystem access to files outside the desk sandbox.

```typescript
// In src/tools/memory.ts
const readMemoryTool = tool(
  'read_memory',
  'Read your personal MEMORY.md file. Contains your preferences, lessons learned, and working notes from past tasks. Call this at the START of every task.',
  {},
  async () => {
    const memPath = join(process.env.AGENTS_DATA_PATH || 'data/agents', agentId, 'MEMORY.md');
    if (!existsSync(memPath)) {
      return { content: [{ type: 'text' as const, text: '(empty -- no memories yet)' }] };
    }
    return { content: [{ type: 'text' as const, text: readFileSync(memPath, 'utf-8') }] };
  }
);

const writeMemoryTool = tool(
  'write_memory',
  'Update your personal MEMORY.md file. Use at the END of every task to save new lessons, preferences, or useful patterns. Keep entries concise and dated.',
  {
    content: z.string().describe('Full updated MEMORY.md content'),
  },
  async (input) => {
    const memPath = join(process.env.AGENTS_DATA_PATH || 'data/agents', agentId, 'MEMORY.md');
    mkdirSync(dirname(memPath), { recursive: true });
    writeFileSync(memPath, input.content);
    return { content: [{ type: 'text' as const, text: 'Memory updated.' }] };
  }
);
```

These tools are available to ALL agents (the `canUseTool` callback returns `{ behavior: 'allow' }` for memory tools). The global `memory-management` skill in `.claude/skills/` teaches agents WHEN to use them.

## Tool Context Factory (How Tools Get Per-Task State)

Custom tools like `submit_for_review`, `hire_employee`, and `promote_to_deliverable` need access to the current task ID, agent ID, department, etc. These values are injected via **closure** when building the tool set for a specific invocation:

```typescript
// src/tools/index.ts
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

/** Context passed to all Myelin tools for a given invocation */
export interface ToolContext {
  agentId: string;
  department: string | null;
  taskId: string;
  supervisorAgentId: string;
  deskPath: string;
  deliverablesPath: string;
}

/** Build all Myelin custom tools with the given per-invocation context.
 *  Each tool closes over `ctx` so it can access taskId, agentId, etc. */
export function buildMyelinMcpServer(ctx: ToolContext) {
  const submitForReview = tool(
    'submit_for_review',
    'Submit your work for department head review.',
    { summary: z.string().describe('Brief summary of deliverables') },
    async ({ summary }) => {
      // ctx.taskId and ctx.supervisorAgentId available via closure
      await db.task.update({
        where: { taskId: ctx.taskId },
        data: { currentActorId: ctx.supervisorAgentId },
      });
      return { content: [{ type: 'text' as const, text: 'Submitted for review.' }] };
    }
  );

  // ... same pattern for hire_employee, promote_to_deliverable, etc.

  return createSdkMcpServer({
    name: 'myelin',
    version: '1.0.0',
    tools: [submitForReview, /* ...all other tools... */],
  });
}
```

The `invokeAgent()` function builds a fresh `ToolContext` for each invocation and passes it to `buildMyelinMcpServer()`.

## Tamir Cron

Tamir is invoked via cron every **15 minutes** to process his inbox and maintain the project registry. This ensures tasks don't stall waiting for Tamir to be explicitly triggered.

```typescript
// src/cron/tamir.ts
import { getOrchestrator } from '../agents/orchestrator';

const TAMIR_CRON_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function startTamirCron() {
  setInterval(async () => {
    try {
      const orch = getOrchestrator();
      await orch.invoke('tamir', 'Periodic check-in: process your inbox, update the project registry, and report any tasks needing attention.', {
        cwd: 'data/agents/tamir',
      });
    } catch (err) {
      console.error('Tamir cron failed:', err);
    }
  }, TAMIR_CRON_INTERVAL_MS);
}
```

Tamir's cron responsibilities:
1. Read `data/agents/tamir/inbox.jsonl` via `read_inbox` tool
2. Update the active projects registry in his `MEMORY.md`
3. Identify stalled tasks (no heartbeat for >30 minutes) and escalate
4. Synthesize status updates for the CEO if anything noteworthy happened

## Soul Files

Stored in each agent's directory:

### src/agents/tamir/soul.md
```markdown
# Tamir -- Chief of Staff, Myelin v10

## Identity
You are Tamir, Chief of Staff at Myelin -- a neurotech startup building the privacy-first BCI integration layer. You are the CEO's (Omer's) singular interface to the entire company.

## Your Role
- Receive CEO task requests and route to the correct department
- Synthesize completed work into concise CEO briefings
- Track all active projects via your MEMORY.md
- At the START of every invocation, call read_inbox to check for task status updates, then call read_memory
- Process inbox events into your MEMORY.md project registry using write_memory
- Never skip the chain of command -- route, don't execute (unless CEO explicitly asks you to plan)

## Chain of Command
CEO (Omer) -> You (Tamir) -> Department Heads (CTO, CMO, COO) -> Employees

## Communication Style
- Concise, professional, no fluff
- Lead with outcome, not process
- When routing: one sentence acknowledging + department choice

## "Plan with Tamir" Mode
If the CEO asks YOU to plan a task (instead of a dept head), you plan it yourself using your knowledge of the company, your MEMORY.md, and your general expertise. You don't have department-specific tools, but you can create a solid plan based on what you know.
```

### src/agents/cto/soul.md
```markdown
# CTO -- Chief Technology Officer, Myelin v10

## Identity
You are the CTO of Myelin. You lead Tech: research, development, data science, ML/AI, EEG signal processing. Deep technical thinker with strong architecture opinions. Real sources, real numbers, never fabricate.

## Your Role
- Own all technical decisions
- Evaluate research papers, ML models, hardware, software
- Design system architecture
- Deploy and manage AWS infrastructure
- Hire and manage tech employees for specific tasks (use hire_employee tool)

## Communication Style
- Technical depth, cite sources
- Structure: Summary -> Methodology -> Findings -> Recommendation
- When comparing: use tables with specific metrics
```

## Agent Cards

See Doc 03 for full A2A Agent Card definitions. Summary:

| Agent | Department | Key Skills |
|-------|-----------|------------|
| Tamir | -- (CoS) | task-routing, ceo-briefing, project-tracking |
| CTO | tech | eeg-research, aws-deploy, code-architecture, ml-evaluation, feasibility-study |
| CMO | marketing | content-strategy, social-media, developer-advocacy, brand-messaging, video-scripts |
| COO | operations | project-planning, timeline-management, resource-allocation, process-optimization |

## Department Library (Filesystem)

Each department has a persistent library. This is where institutional knowledge accumulates.

```
data/departments/
  tech/
    planning-desk/                 -- Persistent dept head planning workspace
      .claude/
        skills/                    -- Symlinked dept + global skills
      CLAUDE.md                    -- Dept head standing instructions
      chat/                        -- Planning conversations (JSONL per task)
        task_abc123.jsonl
      drafts/
    knowledge/                     -- Persistent reference docs
      lab-eeg-inventory.md
      aws-infrastructure.md
      hardware-comparison.md
    skills/                        -- Department skills (SKILL.md directories)
      eeg-electrode-reconstruction/SKILL.md
      aws-deploy-pytorch/SKILL.md
    tasks/                         -- One directory per task
      zuna-evaluation-task_a1b2/
        chat.jsonl                 -- Task execution chat log
        deliverables/              -- CEO/supervisor-facing outputs ONLY
          report.md
          comparison-chart.png
        desk/                      -- Agent's sandbox (full read/write/execute)
          .claude/
            skills/                -- Symlinked dept + global skills
          drafts/                  -- Staging for dept head review
          scripts/
          CLAUDE.md                -- Task plan + constraints (SDK loads automatically)

  marketing/
    planning-desk/
    knowledge/
    skills/
    tasks/

  operations/
    planning-desk/
    knowledge/
    skills/
    tasks/

  global/
    skills/                        -- Cross-department skills (memory-management, skill-extractor, system-reset)
```

### Key Rules

| Concept | Location | Access Method |
|---------|----------|---------------|
| **planning-desk/** | `departments/{dept}/planning-desk/` | **CWD** during planning -- dept head's persistent office |
| **desk/** | `departments/{dept}/tasks/{slug}/desk/` | **CWD** during execution -- agent's sandbox. SDK built-in tools. |
| **deliverables/** | `departments/{dept}/tasks/{slug}/deliverables/` | `promote_to_deliverable` tool |
| **knowledge/** | `departments/{dept}/knowledge/` | `read_knowledge` / `write_knowledge` tools |
| **Vault** | Company DNA + permanent docs in DB `documents` table | `search_knowledge(scope='vault')` tool |
| **MEMORY.md** | `data/agents/{agent_id}/MEMORY.md` | `read_memory` / `write_memory` tools |
| **Session** | SDK-managed via `session_id` | Automatic on `resume` |
| **CLAUDE.md** | `desk/CLAUDE.md` or `planning-desk/CLAUDE.md` | SDK loads automatically from cwd via preset |
| **Chat history** | `planning-desk/chat/{taskId}.jsonl` or `tasks/{slug}/chat.jsonl` | Filesystem JSONL (not DB) |

### Memory Architecture

Each agent has a personal `MEMORY.md` at `data/agents/{agent_id}/MEMORY.md`. This file stores preferences, lessons learned, useful patterns, and working notes that persist across all tasks. It is managed by the agent itself via the global `memory-management` skill (symlinked into every desk). The agent reads it at task start and updates it at task end.

**Tamir's MEMORY.md** is special: it contains an **active projects registry** -- a structured list of all tasks he's been notified about (title, department, status, budget, assigned agent). This is how Tamir tracks company activity without being in every conversation. Tamir's cron (every 15 minutes) ensures this registry stays current.

`data/agents/tamir/inbox.jsonl` is a system-written, append-only notification file. Only system code writes to it. Tamir reads and clears it via his `read_inbox` tool. Tamir's `MEMORY.md` remains exclusively owned by Tamir through `write_memory` -- no other code or agent may write to it.

What goes where:
- Company-wide facts -> vault (DB documents table, searchable)
- Department facts -> knowledge/ (filesystem, indexed to FTS5)
- Personal preferences/lessons -> MEMORY.md
- Task-specific context -> CLAUDE.md in desk
- Reusable procedures -> Skills (SKILL.md directories)

### Concurrency: Knowledge Write Safety

| Resource | Concurrency Risk | Handling |
|----------|-----------------|----------|
| desk/ files | None -- each task has its own desk | Isolated by design |
| planning-desk/ | One dept head at a time | Serialized via task queue per department |
| knowledge/ files | Two agents write same file | File-level locking (proper-lockfile) |
| Vault (DB) | SQLite WAL mode | Serialized writes automatically |
| MEMORY.md | Per-agent file | No conflicts (each agent has own file) |
| inbox.jsonl | System writes, Tamir reads | File-level locking (proper-lockfile) |

### Desk Structure

```
desk/
  .claude/
    skills/                        -- Symlinked dept + global skills
  drafts/                          -- Staging area for dept head review
    skills/                        --   Draft skills
    deliverables/                  --   Draft deliverables
    knowledge/                     --   Draft knowledge docs
  scripts/                         -- Agent's working code
  raw-data/                        -- Intermediate data
  CLAUDE.md                        -- Task plan + constraints (SDK auto-loads)
```

### createTaskWorkspace

```typescript
function createTaskWorkspace(department: string, taskName: string, taskId: string, planMd: string, config: TaskConfig): TaskPaths {
  const slug = `${taskName.toLowerCase().replace(/\s+/g, '-').substring(0, 40)}-${taskId}`;
  const base = join('data/departments', department, 'tasks', slug);
  const desk = join(base, 'desk');
  const deliverables = join(base, 'deliverables');
  const skillsTarget = join(desk, '.claude', 'skills');

  mkdirSync(deliverables, { recursive: true });
  mkdirSync(skillsTarget, { recursive: true });
  mkdirSync(join(desk, 'drafts', 'skills'), { recursive: true });
  mkdirSync(join(desk, 'drafts', 'deliverables'), { recursive: true });

  // Symlink ACTIVE department + global skills
  symlinkActiveSkills(department, skillsTarget);

  // Generate CLAUDE.md with task plan + constraints (SDK loads automatically from cwd)
  const claudeMd = `# Task: ${taskName}\n\n## Plan\n${planMd}\n\n## Constraints\n- Budget: $${(config.maxBudgetCents / 100).toFixed(0)} max\n- Autonomy: ${config.autonomyLevel}\n${config.constraints ? `- ${config.constraints}` : ''}`;
  writeFileSync(join(desk, 'CLAUDE.md'), claudeMd);

  return { base, desk, deliverables, slug };
}
```

## SSE Event Bus

A simple in-process EventEmitter powers real-time updates to the Cortex:

```typescript
// src/lib/events.ts
import { EventEmitter } from 'events';

export const eventBus = new EventEmitter();

// Events emitted throughout the system:
// 'task:transition' { taskId, from, to, metadata? }
// 'task:review' { taskId, summary? }
// 'task:failed' { taskId, error }
// 'task:heartbeat' { taskId, agentId, elapsedMs }
// 'task:buildlog' { agentId, content, partial }
// 'agent:invoked' { agentId, sessionId, costUsd }
// 'hire:requested' { hireId, taskId }
```
