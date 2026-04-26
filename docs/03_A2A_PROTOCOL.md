# 03 -- A2A Protocol: Agent-to-Agent Communication

## What is A2A?

A2A (Agent-to-Agent) is Google's open protocol for inter-agent communication. It defines how AI agents discover each other's capabilities, send tasks, track progress, and exchange results.

Myelin v10 adopts A2A's **data model** (TypeScript interfaces) for all internal agent communication. We use the standard A2A states with NO custom extensions. We do NOT use the HTTP transport yet -- agents communicate via direct function calls within the same Node.js process. The HTTP/JSON-RPC layer is added later when we need cross-server or external agent communication.

**Canonical rule**: Myelin v10 uses ONLY the standard A2A task states. No custom states. The protocol is implemented 100% as specified.

## A2A Reference Documentation

**IMPORTANT for the developer**: When implementing A2A features, consult these sources IN THIS ORDER. Only go to other sources if you cannot find the answer here.

1. **Primary**: Context7 A2A docs (full spec, searchable): `https://context7.com/google/a2a/llms.txt?tokens=10000`
2. **Official repo**: `https://github.com/google/A2A` -- JSON schemas, samples, spec
3. **TypeScript SDK**: `https://github.com/a2aproject/a2a-js` -- ready-made TS types and server/client implementation
4. **Official docs site**: `https://google.github.io/A2A/` -- rendered documentation

The Context7 URL is especially useful -- it returns the full spec as plain text that you can search through. Use it as your first stop for any A2A questions (Task schema, state transitions, Agent Cards, message format, etc.).

## Why A2A?

1. **Cross-department consultation** -- CMO can ask CTO a technical question directly (lateral communication)
2. **Structured task lifecycle** -- Formal states (submitted -> working -> input-required -> completed) instead of ad-hoc status strings
3. **Agent discovery** -- Tamir routes using LLM reasoning over company DNA + Agent Card capabilities
4. **Multi-turn tasks** -- A task can pause (input-required), get CEO input, and resume
5. **Audit trail** -- Every task state transition is logged with context_id threading
6. **Future-proof** -- When we need external agents or multi-server, add HTTP transport on top

## Core TypeScript Interfaces

```typescript
// src/a2a/types.ts

/** A2A Agent Card -- declares agent capabilities */
export interface AgentCard {
  protocolVersion: '0.2';
  name: string;
  description: string;
  url: string;                          // internal://agents/{id} for now
  provider?: {
    organization: string;
    url: string;
  };
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
  };
  defaultInputModes: string[];          // MIME types
  defaultOutputModes: string[];
  skills: AgentSkill[];
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

/** A2A Task -- central work unit */
export interface A2ATask {
  id: string;                           // task_xxxxxxxx
  contextId: string;                    // Groups related messages/tasks
  status: TaskStatus;
  planningAgentId: string;              // Dept head planning with CEO
  executorAgentId: string;              // Agent currently executing approved work
  supervisorAgentId: string;            // Agent responsible for review/closure
  currentActorId: string;               // Who is expected to act next
  artifacts: A2AArtifact[];
  history: A2AMessage[];
  metadata: Record<string, any>;
  referenceTaskIds: string[];           // Dependencies on other tasks
  createdAt: string;
  updatedAt: string;
}

export interface TaskStatus {
  state: TaskState;
  message?: string;                     // Human-readable status message
  timestamp: string;
}

/** Standard A2A states -- NO custom extensions */
export type TaskState =
  | 'submitted'       // Task created, not yet picked up
  | 'working'         // Agent actively executing (planning, execution, OR review)
  | 'input-required'  // Agent needs CEO clarification OR CEO approval (hire, budget)
  | 'completed'       // Done -- deliverable finalized
  | 'failed'          // Unrecoverable error OR agent determined task not feasible
  | 'canceled';       // CEO or Tamir canceled

// Lifecycle stage is derived from timestamps, NOT from a custom phase field:
// - Planning:  approvedAt is null
// - Execution: approvedAt is set, completedAt is null
// - Review:    currentActorId === supervisorAgentId (after executor finishes)
// - Done:      completedAt is set OR state is completed/failed/canceled
```

### State Mapping (How Myelin Concepts Map to Standard A2A)

| Myelin Concept | A2A State | How to Distinguish |
|---------------|-----------|-------------------|
| Planning (dept head drafting plan) | `working` | `approvedAt` is null |
| Clarification needed | `input-required` | Agent asks CEO a question |
| Execution (agent doing approved work) | `working` | `approvedAt` is set |
| Review (supervisor checking deliverables) | `working` | `currentActorId === supervisorAgentId` after execution |
| Hire approval needed | `input-required` | `metadata.inputType === 'hire_approval'` |
| Budget exceeded | `input-required` | `metadata.inputType === 'budget_increase'` |
| Task not feasible | `failed` | `metadata.failureReason === 'rejected'` |
| Completed | `completed` | Standard terminal state |
| Canceled | `canceled` | Standard terminal state |

### State Glossary (Canonical Reference)

| State | Who Triggers | What Happens Next | UI Renders |
|-------|-------------|-------------------|-----------|
| `submitted` | Tamir (via /api/tamir/route) | Dept head is invoked for first time | Routing buttons in chat |
| `working` | Dept head (done clarifying), or CEO (approves plan), or system (review starts) | Generates plan, executes work, or reviews deliverables | Context-dependent: canvas/spinner during planning, build log during execution |
| `input-required` | Dept head (needs info), or system (hire/budget approval needed) | CEO answers in chat or approves request | Chat input enabled, agent avatar asking, or approval button |
| `completed` | Supervisor (approves deliverable) | Tamir notified, CEO can browse | Deliverable tab active, green badge |
| `failed` | System (after retries) or agent (task not feasible) | CEO sees error/reason, can retry | Error in build log, red badge |
| `canceled` | CEO (via /api/tasks/{id}/cancel) | Task archived | Gray badge |

The **next UI action** must come from an explicit backend payload (structured output). Never infer UI behavior from freeform assistant text.

```typescript
/** A2A Message */
export interface A2AMessage {
  role: 'user' | 'agent';
  parts: A2APart[];
  messageId: string;
  contextId?: string;
  taskId?: string;
  referenceTaskIds?: string[];
  timestamp: string;
}

/** A2A Parts (content types) */
export type A2APart = TextPart | FilePart | DataPart;

export interface TextPart {
  kind: 'text';
  text: string;
}

export interface FilePart {
  kind: 'file';
  uri: string;                          // file path or URL
  mimeType: string;
  name: string;
  sizeBytes?: number;
}

export interface DataPart {
  kind: 'data';
  data: Record<string, any>;           // Structured JSON payload
}

/** A2A Artifact -- task output */
export interface A2AArtifact {
  artifactId: string;
  name: string;
  description?: string;
  parts: A2APart[];
  metadata?: Record<string, any>;
}

/** Task Handoff -- from Tamir to dept head */
export interface TaskHandoff {
  taskId: string;
  contextId: string;
  fromAgent: string;
  toAgent: string;
  message: A2AMessage;
  config: TaskConfig;
  referenceTaskIds: string[];
}

/** CEO-specified task configuration */
export interface TaskConfig {
  autonomyLevel: 'minimal' | 'balanced' | 'high' | 'full';
  maxBudgetCents: number;
  constraints: string;
  selectedTools: Array<{ id: string; name: string; hint: string }>;
  selectedSkills: Array<{ id: string; name: string; hint: string }>;
  department: string;
}

/** Structured output schema for planning AND review turns.
 *  Used with SDK outputFormat -- NOT parsed from freeform text.
 *  Canonical definition -- must match Doc 02's AGENT_TURN_SCHEMA. */
export interface AgentTurnResult {
  type:
    | 'ask_for_input'
    | 'plan_ready'
    | 'execution_update'
    | 'review_approved'
    | 'review_changes_requested'
    | 'task_failed';
  message: string;
  planMarkdown?: string;
  reviewFeedback?: string;
  inputType?: 'clarification' | 'hire_approval' | 'budget_increase';
  metadata?: Record<string, any>;
}

/** Structured output schema for Tamir routing.
 *  Used with SDK outputFormat -- NOT parsed from regex. */
export interface RoutingResult {
  department: string;       // 'tech' | 'marketing' | 'operations'
  reason: string;           // One sentence explaining routing decision
  suggestedAgent: string;   // 'cto' | 'cmo' | 'coo'
}
```

## Structured Output (SDK `outputFormat`)

**Canonical rule**: All agent responses that drive state transitions or UI behavior MUST use the SDK's `outputFormat` option for structured output. This guarantees valid JSON conforming to a schema. No regex parsing, no freeform text heuristics, no HTML comment footers.

```typescript
// Planning turn structured output
const PLANNING_TURN_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['ask_for_input', 'plan_ready', 'execution_update', 'task_failed'] },
    message: { type: 'string' },
    planMarkdown: { type: 'string' },
    inputType: { type: 'string', enum: ['clarification', 'hire_approval', 'budget_increase'] },
    metadata: { type: 'object' },
  },
  required: ['type', 'message'],
};

// Tamir routing structured output
const ROUTING_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    department: { type: 'string', enum: ['tech', 'marketing', 'operations'] },
    reason: { type: 'string' },
    suggestedAgent: { type: 'string', enum: ['cto', 'cmo', 'coo'] },
  },
  required: ['department', 'reason', 'suggestedAgent'],
};

// Usage in query():
for await (const message of query({
  prompt: ceoMessage,
  options: {
    outputFormat: { type: 'json_schema', schema: PLANNING_TURN_SCHEMA },
    // ... other options
  }
})) {
  if (message.type === 'result' && message.subtype === 'success') {
    const turn: AgentTurnResult = JSON.parse(message.result);
    // turn is guaranteed to conform to the schema
  }
}
```

This eliminates the entire class of "what if the LLM doesn't follow the format" bugs.

## Task State Machine

```typescript
// src/a2a/state-machine.ts

/** Standard A2A state transitions -- no custom states */
const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  'submitted':      ['working', 'canceled', 'failed'],
  'working':        ['working', 'input-required', 'completed', 'failed', 'canceled'],
  'input-required': ['working', 'canceled'],
  'completed':      [],  // Terminal
  'failed':         [],  // Terminal
  'canceled':       [],  // Terminal
};

export function canTransition(from: TaskState, to: TaskState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Transition a task to a new A2A state.
 *  @param options.message - Human-readable reason for the transition
 *  @param options.metadata - JSON-serializable metadata to store on the task (e.g. { inputType: 'hire_approval' })
 */
export async function transitionTask(
  taskId: string,
  newState: TaskState,
  options?: { message?: string; metadata?: Record<string, any> }
) {
  const task = await db.task.findUnique({ where: { taskId } });
  if (!task) throw new Error(`Task ${taskId} not found`);

  const currentState = task.status as TaskState;
  if (!canTransition(currentState, newState)) {
    throw new Error(`Invalid transition: ${currentState} -> ${newState}`);
  }

  const updateData: any = {
    status: newState,
    updatedAt: new Date(),
  };

  // Merge new metadata with existing metadata
  if (options?.metadata) {
    const existing = JSON.parse(task.metadata || '{}');
    updateData.metadata = JSON.stringify({ ...existing, ...options.metadata });
  }

  // Set completedAt on terminal states
  if (['completed', 'failed', 'canceled'].includes(newState)) {
    updateData.completedAt = new Date();
  }

  await db.task.update({ where: { taskId }, data: updateData });

  // Log state transition
  const msg = options?.message;
  await db.activityLog.create({
    data: {
      agentId: 'system',
      taskId,
      actionType: 'STATE_TRANSITION',
      description: `${taskId}: ${currentState} -> ${newState}${msg ? ': ' + msg : ''}`,
      metadata: JSON.stringify({ taskId, from: currentState, to: newState, message: msg }),
    }
  });
}
```

## Agent Cards (All Agents)

```typescript
// src/agents/{agent_id}/card.json (loaded by src/a2a/cards.ts)
import { AgentCard } from './types';

export const AGENT_CARDS: Record<string, AgentCard> = {
  tamir: {
    protocolVersion: '0.2',
    name: 'Tamir',
    description: 'Chief of Staff. Routes CEO tasks, synthesizes results, manages escalations.',
    url: 'internal://agents/tamir',
    provider: { organization: 'Myelin', url: 'https://myelin.ai' },
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain', 'text/markdown'],
    skills: [
      { id: 'task-routing', name: 'Task Routing', description: 'Analyze CEO request and route to correct department', tags: ['route', 'delegate', 'assign', 'triage'] },
      { id: 'ceo-briefing', name: 'CEO Briefing', description: 'Synthesize work into concise outcome-first briefings', tags: ['brief', 'summarize', 'synthesis', 'report'] },
      { id: 'escalation-mgmt', name: 'Escalation Management', description: 'Handle blocked tasks and inter-dept conflicts', tags: ['escalation', 'blocker', 'resolve', 'conflict'] },
      { id: 'vault-filing', name: 'Vault Filing', description: 'File important documents to permanent vault', tags: ['vault', 'file', 'document', 'archive', 'save'] },
    ],
  },

  cto: {
    protocolVersion: '0.2',
    name: 'CTO',
    description: 'Head of Technology. EEG/BCI research, ML evaluation, AWS deployment, code architecture, feasibility studies.',
    url: 'internal://agents/cto',
    provider: { organization: 'Myelin', url: 'https://myelin.ai' },
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/markdown', 'application/json'],
    skills: [
      { id: 'eeg-research', name: 'EEG/BCI Research', description: 'Evaluate EEG models, compare headsets, analyze brain signals', tags: ['eeg', 'bci', 'ml', 'model-eval', 'neural', 'brainflow', 'mne', 'electrode', 'headset', 'signal'] },
      { id: 'aws-deploy', name: 'AWS Deployment', description: 'Deploy models and services on AWS', tags: ['aws', 'deploy', 'infrastructure', 'ec2', 's3', 'lambda', 'docker', 'server'] },
      { id: 'code-architecture', name: 'Code Architecture', description: 'System design, code review, API design', tags: ['code', 'architecture', 'api', 'design', 'python', 'typescript', 'review'] },
      { id: 'ml-evaluation', name: 'ML Model Evaluation', description: 'Benchmark and compare ML models with metrics', tags: ['ml', 'benchmark', 'evaluation', 'metrics', 'pytorch', 'tensorflow', 'model', 'accuracy'] },
      { id: 'feasibility-study', name: 'Feasibility Analysis', description: 'Technical feasibility studies for products and features', tags: ['feasibility', 'analysis', 'research', 'comparison', 'tradeoff'] },
    ],
  },

  cmo: {
    protocolVersion: '0.2',
    name: 'CMO',
    description: 'Head of Marketing. Content strategy, social media, developer advocacy, brand messaging, video production.',
    url: 'internal://agents/cmo',
    provider: { organization: 'Myelin', url: 'https://myelin.ai' },
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/markdown', 'text/plain'],
    skills: [
      { id: 'content-strategy', name: 'Content Strategy', description: 'Plan editorial calendars, content pillars, article series', tags: ['content', 'blog', 'article', 'editorial', 'long-form', 'writing', 'copy'] },
      { id: 'social-media', name: 'Social Media', description: 'Create posts, threads, campaigns for social platforms', tags: ['social', 'twitter', 'linkedin', 'post', 'thread', 'campaign', 'tweet'] },
      { id: 'developer-advocacy', name: 'Developer Advocacy', description: 'DevRel content, community building, developer tutorials', tags: ['devrel', 'developer', 'community', 'advocacy', 'tutorial', 'docs'] },
      { id: 'brand-messaging', name: 'Brand Messaging', description: 'Craft brand narratives, taglines, positioning', tags: ['brand', 'message', 'narrative', 'storytelling', 'positioning', 'hook'] },
      { id: 'video-scripts', name: 'Video Scripts', description: 'YouTube scripts, short-form video concepts', tags: ['video', 'youtube', 'script', 'short-form', 'creator', 'production'] },
    ],
  },

  coo: {
    protocolVersion: '0.2',
    name: 'COO',
    description: 'Head of Operations. Project planning, timeline management, resource allocation, process optimization.',
    url: 'internal://agents/coo',
    provider: { organization: 'Myelin', url: 'https://myelin.ai' },
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/markdown', 'application/json'],
    skills: [
      { id: 'project-planning', name: 'Project Planning', description: 'Create project plans, sprints, roadmaps', tags: ['project', 'plan', 'sprint', 'roadmap', 'milestone'] },
      { id: 'timeline-mgmt', name: 'Timeline Management', description: 'Manage deadlines, dependencies, schedules', tags: ['timeline', 'milestone', 'deadline', 'schedule', 'gantt'] },
      { id: 'resource-allocation', name: 'Resource Allocation', description: 'Budget planning, capacity management', tags: ['resource', 'budget', 'allocation', 'capacity', 'cost'] },
      { id: 'process-optimization', name: 'Process Optimization', description: 'Optimize workflows and operational processes', tags: ['process', 'workflow', 'optimization', 'ops', 'efficiency'] },
    ],
  },
};
```

## Cross-Department Consultation (via A2A)

Agents can talk to each other laterally. This uses the SAME A2A task infrastructure as CEO -> dept head communication. The `consult_agent` tool is a thin wrapper that creates an A2A Task and routes messages through the standard `/api/tasks/{id}/message` path.

### How It Works

```
CMO's LLM decides it needs technical input
  |
  v
Calls tool: consult_agent("cto", "Which EEG headsets?")
  |
  v
consult_agent() internally:
  1. Creates A2A Task: { taskId, contextId, fromAgent: cmo, toAgent: cto, status: submitted }
  2. Invokes CTO agent via orch.invoke()
  3. CTO agent thinks, responds
  4. If CTO needs more info: task status -> input-required, returns question to CMO
  5. CMO calls consult_agent again (same contextId) -> resumes the task
  6. When CTO is satisfied: task status -> completed, returns answer
  |
  v
CMO's LLM receives string response from tool, continues its work
```

### Who Can Use It

| Agent | Can Consult | Cannot Consult |
|-------|------------|----------------|
| CTO | CMO, COO | -- |
| CMO | CTO, COO | -- |
| COO | CTO, CMO | -- |
| Tamir | -- (routes, doesn't consult) | CTO, CMO, COO |
| Temp employees | -- (no lateral access) | Anyone |

**Temp employees cannot consult.** They work within their department under their dept head's supervision. If they need cross-department input, they escalate to their dept head who makes the consultation.

### Tool Definition

```typescript
// Registered on CTO, CMO, COO agents only
// NOTE: Uses Zod schema (SDK requirement) and correct handler return format
import { z } from 'zod';

const consultAgentTool = tool(
  'consult_agent',
  'Ask another department head a question. Creates an A2A task for the consultation. Use when you need expertise outside your department.',
  {
    target_agent: z.enum(['cto', 'cmo', 'coo']).describe('Which department head to consult'),
    question: z.string().describe('Your question for them. Be specific about what you need.'),
  },
  async (args) => {
    const response = await consultAgent(callingAgentId, args.target_agent, args.question, parentTaskId, parentContextId);
    return { content: [{ type: 'text', text: response }] };
  }
);
```

### Implementation

```typescript
// src/a2a/consultation.ts
import { getOrchestrator } from '../agents/orchestrator';
import { transitionTask } from './state-machine';
import { db } from '../db';
import { generateId } from '../lib/id';

// Active consultations are tracked in the DB (not in-memory) so they survive restarts.
// A consultation is an A2A Task with assignedBy = fromAgent, status not terminal.

export async function consultAgent(
  fromAgentId: string,
  toAgentId: string,
  question: string,
  parentTaskId?: string,
  parentContextId?: string,
): Promise<string> {
  const orch = getOrchestrator();

  // Check if continuing an existing consultation (DB query, not in-memory Map)
  const existingTask = parentContextId
    ? await db.task.findFirst({
        where: {
          assignedBy: fromAgentId,
          executorAgentId: toAgentId,
          status: { in: ['submitted', 'working', 'input-required'] },
          referenceTaskIds: { contains: parentTaskId || '' },
        },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  let taskId: string;
  let contextId: string;

  if (existingTask) {
    taskId = existingTask.taskId;
    contextId = existingTask.contextId || generateId('ctx');
    await transitionTask(taskId, 'working');
  } else {
    taskId = generateId('task');
    contextId = generateId('ctx');

    await db.task.create({
      data: {
        taskId,
        contextId,
        department: getDepartmentForAgent(toAgentId),
        planningAgentId: toAgentId,
        executorAgentId: toAgentId,
        supervisorAgentId: toAgentId,
        currentActorId: toAgentId,
        assignedBy: fromAgentId,
        description: `Consultation: ${question.substring(0, 200)}`,
        status: 'submitted',
        referenceTaskIds: JSON.stringify(parentTaskId ? [parentTaskId] : []),
      }
    });

    await transitionTask(taskId, 'working');
  }

  // Invoke target agent via SDK query() with structured output
  const result = await orch.invoke(toAgentId, question, {
    extraSystemPrompt: `Colleague ${fromAgentId.toUpperCase()} is consulting you. Answer concisely and technically. If you need more information, respond with type "ask_for_input".`,
    outputFormat: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['ask_for_input', 'execution_update'] },
          message: { type: 'string' },
        },
        required: ['type', 'message'],
      },
    },
  });

  // Log
  await db.activityLog.create({
    data: {
      agentId: toAgentId,
      taskId,
      actionType: 'CONSULTATION',
      description: `${fromAgentId} -> ${toAgentId}: ${question.substring(0, 80)}`,
      metadata: JSON.stringify({ fromAgent: fromAgentId, taskId, contextId }),
    }
  });

  // Parse structured response (guaranteed valid JSON by SDK)
  const consultationTurn = JSON.parse(result.resultText);

  if (consultationTurn.type === 'ask_for_input') {
    await transitionTask(taskId, 'input-required', { message: `${toAgentId} asked follow-up` });
    return consultationTurn.message;
  }

  // Consultation complete
  await transitionTask(taskId, 'completed');
  return consultationTurn.message;
}
```

### Key Points

1. **Same A2A protocol** -- Consultation creates a Task with the same state machine (submitted -> working -> input-required -> completed). It's not a separate system.
2. **Multi-turn is natural** -- If CTO asks a follow-up, the task goes to `input-required`. When CMO calls `consult_agent` again, the same task resumes (same contextId).
3. **Visible in Cortex** -- Consultations appear in the activity log and build log, so the CEO can see cross-department communication.
4. **The LLM sees a tool** -- The calling agent's LLM sees `consult_agent` as a normal tool that takes a string and returns a string. It doesn't know about A2A, tasks, or state machines. That's all infrastructure.
5. **Structured output** -- Consultation turn type is parsed from SDK structured output, not freeform text.

## LLM-Based Routing (Tamir) -- With Structured Output

Tamir routes via his own LLM reasoning -- NOT keyword matching or tag scoring. He reads the CEO's request against company DNA (org structure from the vault) and Agent Card capabilities, then decides. The result is returned as **structured output**, not parsed from regex.

```typescript
export async function routeRequest(ceoMessage: string): Promise<RoutingResult> {
  const companyDNA = await loadCompanyDNA();

  const context = `
You are Tamir, Chief of Staff at Myelin.

COMPANY ORGANIZATION (from vault):
${companyDNA.departments.map(d =>
  `- ${d.id} (${d.name}): ${d.description}. Head: ${d.head}. Responsibilities: ${d.responsibilities}`
).join('\n')}

AGENT CAPABILITIES:
${Object.values(AGENT_CARDS).filter(c => c.name !== 'Tamir').map(c =>
  `- ${c.name}: ${c.skills.map(s => s.name).join(', ')}`
).join('\n')}

CEO REQUEST: "${ceoMessage}"

Which department should handle this task? Return structured JSON with department, reason, and suggestedAgent.
`;

  const result = await orch.invoke("tamir", ceoMessage, {
    extraSystemPrompt: context,
    outputFormat: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          department: { type: 'string', enum: ['tech', 'marketing', 'operations'] },
          reason: { type: 'string' },
          suggestedAgent: { type: 'string', enum: ['cto', 'cmo', 'coo'] },
        },
        required: ['department', 'reason', 'suggestedAgent'],
      },
    },
  });

  // Guaranteed valid JSON by SDK structured output
  return JSON.parse(result.resultText) as RoutingResult;
}
```

**Why LLM-based, not tag-scoring?**
- Handles ambiguous requests ("make a technical blog post" -- marketing or tech?)
- Adapts when CEO adds new departments or changes responsibilities
- No hardcoded keyword lists to maintain
- Tamir can explain his reasoning to the CEO
- Company DNA is the single source of truth for org structure

**Why structured output, not regex?**
- SDK guarantees valid JSON conforming to the schema
- No fallback logic, no default department on parse failure
- The enum constraint ensures only valid department/agent values
- Zero parsing code to maintain

## A2A Error Codes

Following the A2A spec:

```typescript
export enum A2AErrorCode {
  TaskNotFound = -32001,
  TaskNotCancelable = -32002,
  UnsupportedOperation = -32004,
  ContentTypeNotSupported = -32005,
  InvalidParams = -32602,
}
```

## Migration Path

### Phase 1: Internal Data Model (v10 build)
- All TypeScript interfaces defined
- Agent Cards stored as static config
- Task state machine enforced in database (standard A2A states only)
- context_id threading on all tasks
- Skill-based routing in Tamir via structured output

### Phase 2: Consultation Tools (v10.1)
- consult_agent tool on all dept heads
- Multi-turn consultation with input-required pauses
- Consultation history visible in Cortex

### Phase 3: HTTP Transport (future)
- Each agent gets a JSON-RPC endpoint
- Agent Cards served at /.well-known/agent-card.json
- External agents can discover and send tasks
- SSE streaming for long-running tasks
