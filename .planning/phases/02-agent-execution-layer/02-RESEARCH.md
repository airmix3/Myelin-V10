# Phase 2: Agent Execution Layer - Research

**Researched:** 2026-03-26
**Domain:** Claude Agent SDK integration, MCP custom tools, agent identity, session management
**Confidence:** HIGH

## Summary

Phase 2 replaces the Phase 1 `executeRun()` stub with a real `invokeAgent()` implementation using the Claude Agent SDK's `query()` function. The SDK spawns a Claude Code subprocess per invocation, handles the tool loop autonomously, and returns structured streaming messages. Custom MCP tools are defined using `createSdkMcpServer()` and `tool()` helpers from the SDK -- these run in-process (not as separate servers) and are passed to each `query()` call via the `mcpServers` option.

The critical architectural insight is that each `query()` call spawns an independent subprocess. This means per-invocation MCP tool context isolation is achievable by creating a fresh `createSdkMcpServer()` with a closure-bound ToolContext for each invocation -- the MCP server instance lives in the parent process and handles tool calls from the subprocess via the SDK's bridge transport. The `canUseTool` callback receives `toolName` and `input` and returns `{behavior:'allow'}` or `{behavior:'deny', message:'...'}`, which provides the hook for role-based access control.

**Primary recommendation:** Build `invokeAgent()` as a thin wrapper around `query()` that: (1) creates a per-invocation MCP server with closure-bound context, (2) sets `systemPrompt: {type:'preset', preset:'claude_code', append: soulMd}` for agent identity, (3) uses `permissionMode: 'bypassPermissions'` with `allowDangerouslySkipPermissions: true` for autonomous execution, (4) iterates the async generator to stream events to the build log and extract cost data from the `result` message.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Plan 1 is a spike-embedded plan: delivers real production code for `invokeAgent()` + MCP server + 3-4 core tools. Validates the concurrent-agent + per-invocation MCP isolation model while shipping shippable work. If concurrent isolation breaks, we discover it at Plan 1 (50-100 lines), not after Plan 3 (1,000+ lines).
- **D-02:** Validation criterion for the spike: 2 agents run concurrently, each with its own ToolContext closure, and tools from one agent cannot affect the other's state. If this fails, replanning happens before proceeding.
- **D-03:** All soul.md files are comprehensive guides -- 2-4 pages each. Not minimal personas. They define persona, tone, decision-making philosophy, how to handle ambiguity, cross-department behavior, tool usage patterns.
- **D-04:** Tamir is a sharp operator -- direct, no filler, but substantive. Clear answer + reasoning + next step, no padding.
- **D-05:** CTO, CMO, COO are domain experts with strong opinions. They push back when something doesn't make sense.
- **D-06:** Agent names for now: role titles only (CTO, CMO, COO). Names can be added later.
- **D-07:** All 3 global skills are step-by-step procedures with clear why/goal.
- **D-08:** memory-management: Agent's discretion, MEMORY.md is a structured employee journal with sections: Recent Projects, Company Conventions, Goals. Read at task start, write at task end only when genuinely new.
- **D-09:** skill-extractor: Both executor and supervisor extract skills. Executor calls `propose_skill` during task, supervisor does review pass after approving deliverable.
- **D-10:** system-reset: CEO triggers via Tamir, with summary confirmation before executing. Not a direct API call.
- **D-11:** `POST /api/hire_requests/[id]/approve` built in Phase 2. Business logic belongs in agent layer.
- **D-12:** `POST /api/hire_requests/[id]/reject` for completeness.

### Claude's Discretion
- Exact MCP server wiring pattern (how `buildMyelinMcpServer(ctx)` is called inside `invokeAgent()`)
- Cost event schema fields beyond what AGENT-01 specifies
- Internal helper structure for the 14 tools (e.g., shared file path utilities)
- Exact content of CTO, CMO, COO soul.md beyond the persona direction above
- skill-extractor criteria detail beyond what's captured in D-09

### Deferred Ideas (OUT OF SCOPE)
- `consult_agent` tool -- deferred to v2 (COORD-01). Not in TOOL-01 through TOOL-14.
- Tamir 15-minute cron (COORD-02) -- deferred to v2. Tamir in Phase 2 is invoked on demand only.
- Named personas for CTO/CMO/COO -- left as role titles for now.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGENT-01 | `invokeAgent()` wrapper around SDK `query()` with preset systemPrompt, session resume, streaming, cost logging | SDK `query()` API fully documented: `systemPrompt`, `resume`, `includePartialMessages`, `maxBudgetUsd` options. Cost from `SDKResultSuccess.total_cost_usd` and `modelUsage` |
| AGENT-02 | Orchestrator singleton with configs for 4 agents; `invoke()` method with outputFormat, agents, maxBudgetUsd, cwd, sessionId | `Options` type supports all these fields. `outputFormat: {type:'json_schema', schema}`, `agents: Record<string, AgentDefinition>`, `cwd`, `resume` for sessionId |
| AGENT-03 | Agent directories (`src/agents/{tamir,cto,cmo,coo}/`) with soul.md + card.json + agent.ts; 4 executives seeded to DB | Filesystem structure for soul.md content. card.json maps to AgentCard A2A interface. agent.ts exports config |
| AGENT-04 | SDK structured output for ALL turn routing -- no regex | `outputFormat: {type:'json_schema', schema: Record<string,unknown>}` confirmed. Result in `SDKResultSuccess.structured_output` |
| AGENT-05 | A2A TypeScript interfaces | Define in `src/a2a/types.ts` -- pure TypeScript interfaces, no @a2a-js/sdk dependency needed for types |
| AGENT-06 | Temp employee hire flow | SDK `agents` option for AgentDefinition subagents. `tools` field restricts subagent access. HireRequest model already in Prisma schema |
| TOOL-01 | Single in-process MCP server via `createSdkMcpServer()` with per-invocation ToolContext closure | `createSdkMcpServer({name, tools})` returns `McpSdkServerConfigWithInstance`. Tool handlers get args via closure-captured ToolContext |
| TOOL-02 | `buildCanUseTool(agentId, department)` role-based access control | `canUseTool` callback in Options: `(toolName, input, options) => Promise<PermissionResult>`. MCP tools named `mcp__myelin__toolname` |
| TOOL-03 | `read_memory` / `write_memory` | MCP tool with `tool()` helper, reads/writes `data/agents/{agentId}/MEMORY.md` |
| TOOL-04 | `promote_to_deliverable` | Copies file from desk to deliverables, updates manifest JSON, indexes FTS5 |
| TOOL-05 | `read_knowledge` / `write_knowledge` | File operations on `data/departments/{dept}/knowledge/`, FTS5 indexing, proper-lockfile for writes |
| TOOL-06 | `search_knowledge` | FTS5 BM25 search using existing `searchDocuments()` from fts.ts |
| TOOL-07 | `submit_for_review` | Updates `currentActorId` to supervisor via sqlite |
| TOOL-08 | `approve_deliverable` (dept heads only) | Transitions task to completed, notifies Tamir inbox |
| TOOL-09 | `request_changes` (dept heads only) | Stores feedback, increments reviewRound, sets currentActorId back |
| TOOL-10 | `file_to_vault` (Tamir + dept heads) | Copies to `data/vault/`, upserts documents table, FTS5 index |
| TOOL-11 | `propose_skill` | Creates skill directory and SKILL.md, upserts DB record |
| TOOL-12 | `read_inbox` (Tamir only) | Reads/clears `data/agents/tamir/inbox.jsonl` with proper-lockfile |
| TOOL-13 | `get_dept_status` (Tamir only) | Queries active tasks per department from DB |
| TOOL-14 | `hire_employee` (dept heads only) | Creates HireRequest record, transitions task to input-required |
| GSKILL-01 | `memory-management` global skill | Markdown file at `data/departments/global/skills/memory-management/SKILL.md` |
| GSKILL-02 | `skill-extractor` global skill | Markdown file at `data/departments/global/skills/skill-extractor/SKILL.md` |
| GSKILL-03 | `system-reset` global skill | Markdown file at `data/departments/global/skills/system-reset/SKILL.md` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **TypeScript/Node.js only** -- no Python in application layer
- **CSS**: Custom CSS variables only -- no Tailwind/Bootstrap (not relevant to Phase 2)
- **LLM Provider**: AWS Bedrock via `CLAUDE_CODE_USE_BEDROCK=1` -- SDK reads this env var automatically
- **Database**: SQLite via Prisma + better-sqlite3 dual access pattern
- **A2A States**: Standard 6 states only -- submitted, working, input-required, completed, failed, canceled
- **SDK First**: Use Claude Agent SDK built-ins before custom implementation
- **Zod v4 only** -- NOT v3 (SDK peer dependency)
- **Prisma 7.5** with `@prisma/adapter-better-sqlite3` -- all three packages must be same version
- **proper-lockfile** for concurrent file access
- **pino** for structured logging

## Standard Stack

### Core (to install for Phase 2)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/claude-agent-sdk | 0.2.84 | Agent execution engine | Official SDK; `query()` handles tool loop, sessions, cost tracking, MCP server integration, subagents |
| @modelcontextprotocol/sdk | 1.28.0 | MCP types (CallToolResult, ToolAnnotations) | Peer types used by `createSdkMcpServer` tool definitions |
| proper-lockfile | 4.1.2 | Filesystem locking | Concurrent JSONL writes (inbox), knowledge file writes |
| marked | 17.0.5 | Markdown rendering | May be needed for soul.md processing |

### Already Installed (Phase 1)
| Library | Version | Purpose |
|---------|---------|---------|
| zod | 4.3.6 | Schema validation for MCP tool inputs, structured output schemas |
| prisma + @prisma/client | 7.5.0 | ORM for task/employee/cost queries |
| better-sqlite3 | 12.8.0 | Direct SQL for FTS5, activity_log, raw queries |
| pino | 10.3.1 | Structured logging |
| gray-matter | 4.0.3 | Frontmatter parsing for soul.md |

### Not Needed
| Library | Reason |
|---------|--------|
| @a2a-js/sdk | A2A types are simple interfaces -- define in-house in `src/a2a/types.ts` instead of adding a dependency |

**Installation:**
```bash
pnpm add @anthropic-ai/claude-agent-sdk@0.2.84 @modelcontextprotocol/sdk@1.28.0 proper-lockfile@4.1.2 marked@17.0.5
pnpm add -D @types/proper-lockfile
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  agents/
    tamir/
      soul.md              # Comprehensive persona + behavior guide
      card.json            # AgentCard metadata (name, dept, role, tools)
      agent.ts             # Exports agent config (systemPrompt builder, tool restrictions)
    cto/
      soul.md, card.json, agent.ts
    cmo/
      soul.md, card.json, agent.ts
    coo/
      soul.md, card.json, agent.ts
  a2a/
    types.ts               # A2A interfaces (AgentCard, A2ATask, etc.)
  lib/
    invoke-agent.ts        # invokeAgent() wrapper around SDK query()
    orchestrator.ts        # Agent registry + invoke() dispatcher
    mcp/
      server.ts            # buildMyelinMcpServer(ctx) factory
      tools/
        memory.ts          # read_memory, write_memory
        deliverable.ts     # promote_to_deliverable
        knowledge.ts       # read_knowledge, write_knowledge, search_knowledge
        review.ts          # submit_for_review, approve_deliverable, request_changes
        vault.ts           # file_to_vault
        skills.ts          # propose_skill
        inbox.ts           # read_inbox, get_dept_status
        hire.ts            # hire_employee
      access-control.ts    # buildCanUseTool(agentId, dept) -> canUseTool callback
      tool-context.ts      # ToolContext type + factory
  app/
    api/
      hire_requests/
        [id]/
          approve/route.ts # POST handler
          reject/route.ts  # POST handler
data/
  departments/
    global/
      skills/
        memory-management/SKILL.md
        skill-extractor/SKILL.md
        system-reset/SKILL.md
```

### Pattern 1: Per-Invocation MCP Server with ToolContext Closure
**What:** Each `invokeAgent()` call creates a fresh MCP server with tools bound to that invocation's context (taskId, agentId, dept, workspace paths). No shared mutable state.
**When to use:** Every agent invocation.
**Example:**
```typescript
// Source: SDK official docs + type definitions
import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

interface ToolContext {
  taskId: string;
  agentId: string;
  department: string;
  deskDir: string;
  delivDir: string;
  manifestPath: string;
}

function buildMyelinMcpServer(ctx: ToolContext) {
  const readMemory = tool(
    'read_memory',
    'Read your MEMORY.md file to recall past context',
    {},  // no input params
    async () => {
      const memPath = path.resolve('data', 'agents', ctx.agentId, 'MEMORY.md');
      try {
        const content = fs.readFileSync(memPath, 'utf-8');
        return { content: [{ type: 'text', text: content }] };
      } catch {
        return { content: [{ type: 'text', text: 'No memory file found.' }] };
      }
    },
    { annotations: { readOnlyHint: true } }
  );

  // ... define all 14 tools similarly, all closing over ctx ...

  return createSdkMcpServer({
    name: 'myelin',
    tools: [readMemory, /* ... all tools ... */],
  });
}
```

### Pattern 2: invokeAgent() Wrapper
**What:** Thin async function that wires SDK `query()` with the right options, iterates the stream, logs events, and extracts results.
**When to use:** Called from `executeRun()` replacement in worker.ts.
**Example:**
```typescript
// Source: SDK type definitions (Options, SDKMessage, SDKResultSuccess, SDKResultError)
import { query, type SDKMessage, type SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk';

interface InvokeAgentOptions {
  taskId: string;
  runId: string;
  agentId: string;
  department: string;
  prompt: string;
  deskDir: string;
  delivDir: string;
  manifestPath: string;
  sessionId?: string;       // for resume
  maxBudgetUsd?: number;
  outputFormat?: { type: 'json_schema'; schema: Record<string, unknown> };
  agents?: Record<string, AgentDefinition>;
}

async function invokeAgent(opts: InvokeAgentOptions): Promise<{
  sessionId: string;
  totalCostUsd: number;
  result?: string;
  structuredOutput?: unknown;
}> {
  const ctx: ToolContext = {
    taskId: opts.taskId,
    agentId: opts.agentId,
    department: opts.department,
    deskDir: opts.deskDir,
    delivDir: opts.delivDir,
    manifestPath: opts.manifestPath,
  };

  const myelinServer = buildMyelinMcpServer(ctx);
  const canUseTool = buildCanUseTool(opts.agentId, opts.department);
  const soulMd = loadSoulMd(opts.agentId);

  let sessionId = '';
  const q = query({
    prompt: opts.prompt,
    options: {
      systemPrompt: { type: 'preset', preset: 'claude_code', append: soulMd },
      cwd: opts.deskDir,
      mcpServers: { myelin: myelinServer },
      allowedTools: ['mcp__myelin__*'],  // auto-approve all myelin tools
      canUseTool,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxBudgetUsd: opts.maxBudgetUsd ?? 10,
      includePartialMessages: true,
      resume: opts.sessionId,
      outputFormat: opts.outputFormat,
      agents: opts.agents,
      settingSources: ['project'],  // load desk/CLAUDE.md
      env: {
        ...process.env as Record<string, string>,
        CLAUDE_CODE_USE_BEDROCK: '1',
      },
    },
  });

  for await (const msg of q) {
    // Capture session_id from init message
    if (msg.type === 'system' && msg.subtype === 'init') {
      sessionId = msg.session_id;
    }
    // Stream partial messages to SSE build log
    if (msg.type === 'stream_event') {
      eventBus.emit('task:buildlog', { taskId: opts.taskId, event: msg });
    }
    // Log tool progress
    if (msg.type === 'tool_progress') {
      eventBus.emit('task:buildlog', { taskId: opts.taskId, event: msg });
    }
    // Log assistant messages to activity_log
    if (msg.type === 'assistant') {
      logActivity(opts.taskId, opts.agentId, 'SDK_ASSISTANT', msg);
    }
    // Handle result
    if (msg.type === 'result') {
      const result = msg as SDKResultSuccess;
      // Log cost
      logCostEvent(opts.taskId, opts.agentId, result);
      // Store session for resume
      storeSessionId(opts.runId, sessionId, opts.deskDir);

      return {
        sessionId,
        totalCostUsd: result.total_cost_usd,
        result: result.subtype === 'success' ? result.result : undefined,
        structuredOutput: result.subtype === 'success' ? result.structured_output : undefined,
      };
    }
  }

  throw new Error('Query ended without result message');
}
```

### Pattern 3: Role-Based Access Control via canUseTool
**What:** `canUseTool` callback that maps agent roles to allowed/denied tool sets.
**When to use:** Passed to every `query()` call.
**Example:**
```typescript
// Source: SDK CanUseTool type + PermissionResult type
type CanUseToolFn = (
  toolName: string,
  input: Record<string, unknown>,
  options: { signal: AbortSignal; toolUseID: string; agentID?: string }
) => Promise<{ behavior: 'allow' } | { behavior: 'deny'; message: string }>;

const TAMIR_ONLY = ['mcp__myelin__read_inbox', 'mcp__myelin__get_dept_status'];
const DEPT_HEAD_ONLY = ['mcp__myelin__approve_deliverable', 'mcp__myelin__request_changes', 'mcp__myelin__hire_employee'];
const TEMP_ALLOWED = [
  'mcp__myelin__read_knowledge', 'mcp__myelin__search_knowledge',
  'mcp__myelin__promote_to_deliverable', 'mcp__myelin__propose_skill',
  'mcp__myelin__submit_for_review',
];

function buildCanUseTool(agentId: string, department: string): CanUseToolFn {
  const isTamir = agentId === 'tamir';
  const isDeptHead = ['cto', 'cmo', 'coo'].includes(agentId);
  const isTempEmployee = !isTamir && !isDeptHead;

  return async (toolName, _input, _options) => {
    // Non-MCP tools (Bash, Read, Edit, etc.) -- allow all for now
    if (!toolName.startsWith('mcp__myelin__')) {
      return { behavior: 'allow' };
    }

    // Tamir-only tools
    if (TAMIR_ONLY.includes(toolName) && !isTamir) {
      return { behavior: 'deny', message: `Tool ${toolName} is Tamir-only` };
    }

    // Dept-head-only tools
    if (DEPT_HEAD_ONLY.includes(toolName) && !isDeptHead) {
      return { behavior: 'deny', message: `Tool ${toolName} requires dept head role` };
    }

    // Temp employee restrictions
    if (isTempEmployee && !TEMP_ALLOWED.includes(toolName)) {
      return { behavior: 'deny', message: `Temp employees can only use: ${TEMP_ALLOWED.join(', ')}` };
    }

    return { behavior: 'allow' };
  };
}
```

### Pattern 4: Subagent for Temp Employees
**What:** When a dept head hires a temp employee, the employee is defined as an SDK `AgentDefinition` subagent.
**When to use:** After hire approval, when re-invoking the dept head.
**Example:**
```typescript
// Source: SDK AgentDefinition type
const tempEmployee: Record<string, AgentDefinition> = {
  [employeeName]: {
    description: hireRequest.employeeRole,
    prompt: `You are ${employeeName}, a ${hireRequest.employeeRole} working under the ${department} department.
Your task: ${taskDescription}
You have limited tool access. Focus on producing deliverables.`,
    tools: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep',
            'mcp__myelin__read_knowledge', 'mcp__myelin__search_knowledge',
            'mcp__myelin__promote_to_deliverable', 'mcp__myelin__propose_skill',
            'mcp__myelin__submit_for_review'],
  },
};
// Pass as agents option when re-invoking the dept head
```

### Pattern 5: Structured Output for Routing
**What:** SDK `outputFormat` with JSON schema for deterministic routing decisions.
**When to use:** Tamir routing, planning turn classification.
**Example:**
```typescript
// Source: SDK JsonSchemaOutputFormat type
const routingSchema = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      department: { type: 'string', enum: ['tech', 'marketing', 'operations'] },
      confidence: { type: 'number' },
      reasoning: { type: 'string' },
      suggested_title: { type: 'string' },
    },
    required: ['department', 'confidence', 'reasoning', 'suggested_title'],
  },
} as const;
// Result arrives in SDKResultSuccess.structured_output
```

### Anti-Patterns to Avoid
- **Shared mutable MCP server state:** Never reuse an MCP server instance across invocations. Each `query()` call should get a fresh `createSdkMcpServer()` with its own ToolContext closure.
- **Calling Anthropic API directly:** Always go through SDK `query()`. The SDK handles tool loops, retries, session management.
- **Regex parsing of LLM output:** Use `outputFormat` with JSON schema for structured responses.
- **Storing MCP server globally:** The `McpSdkServerConfigWithInstance` contains a live `McpServer` object. Create it fresh per invocation.
- **Using zod v3 patterns:** Zod v4 is required. No `z.object().strict()` (it's the default now), different enum behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent tool loop | Custom message/tool loop | SDK `query()` | SDK handles retries, context management, tool execution, streaming |
| MCP server | Custom tool dispatch | `createSdkMcpServer()` + `tool()` | SDK handles transport, schema validation, error formatting |
| Session resume | Custom conversation storage | SDK `resume` option with session_id | SDK persists sessions to `~/.claude/projects/` automatically |
| Structured output | Regex/JSON.parse on freeform text | SDK `outputFormat` | Guaranteed valid JSON matching schema |
| File locking | Custom lock files | proper-lockfile | Handles stale locks, retries, cross-platform |
| Subagent lifecycle | Custom process spawning | SDK `agents` option (AgentDefinition) | SDK manages subprocess, context isolation, result aggregation |
| Permission control | Separate MCP servers per role | Single server + `canUseTool` callback | Runtime enforcement, no server proliferation |

**Key insight:** The Agent SDK IS the execution engine. `invokeAgent()` should be a thin wrapper (~50-80 lines) that wires options and processes the stream. All the heavy lifting (tool loops, retries, sessions, cost tracking) is SDK-handled.

## Common Pitfalls

### Pitfall 1: MCP Tool Naming Convention
**What goes wrong:** Tools defined in `createSdkMcpServer({name:'myelin'})` are exposed to Claude as `mcp__myelin__tool_name`. If you forget the `mcp__` prefix in `allowedTools` or `canUseTool`, tools silently fail permission checks.
**Why it happens:** The naming convention `mcp__{server_name}__{tool_name}` is auto-applied by the SDK.
**How to avoid:** Always use `allowedTools: ['mcp__myelin__*']` to auto-approve all tools from the myelin server. In `canUseTool`, check `toolName.startsWith('mcp__myelin__')`.
**Warning signs:** Tools appear in init message but Claude says "I don't have permission to use that tool."

### Pitfall 2: Query Spawns a Subprocess
**What goes wrong:** `query()` spawns a Claude Code child process. Each concurrent invocation is a separate process. This means `process.env` is copied at spawn time, and the MCP server bridge runs through IPC.
**Why it happens:** The SDK is designed as a programmatic wrapper around Claude Code CLI, not an in-process LLM client.
**How to avoid:** Ensure `MAX_CONCURRENT = 3` in worker.ts is respected (already implemented). Each subprocess consumes memory (~100-200MB). Test concurrent invocations in the spike (D-01, D-02).
**Warning signs:** High memory usage, subprocess spawn failures, port conflicts.

### Pitfall 3: Session Resume Requires Matching CWD
**What goes wrong:** Resuming a session with `resume: sessionId` requires the same CWD (or at least the same project directory) as the original session. The SDK stores sessions in `~/.claude/projects/{project-hash}/`.
**Why it happens:** Session files are keyed by project directory.
**How to avoid:** Store both `sessionId` AND `workspaceCwd` in the `task_runs` table (already in schema). Always pass `cwd: storedCwd` when resuming. Use `settingSources: ['project']` so it loads the desk's CLAUDE.md.
**Warning signs:** Resume silently starts a new session instead of continuing the old one.

### Pitfall 4: Zod v4 Schema in outputFormat
**What goes wrong:** `outputFormat` takes `{type:'json_schema', schema: Record<string,unknown>}` -- a raw JSON Schema object, NOT a zod schema. You must convert zod to JSON Schema if you want to define schemas in zod.
**Why it happens:** The SDK passes the schema directly to the API which expects JSON Schema format.
**How to avoid:** Either write JSON Schema directly for outputFormat, or use a zod-to-json-schema converter. The simplest approach is to write JSON Schema literals for the few routing schemas.
**Warning signs:** Type errors or runtime validation failures in structured output.

### Pitfall 5: canUseTool vs allowedTools Interaction
**What goes wrong:** `allowedTools` pre-approves tools (no permission prompt). `canUseTool` is a secondary check that can deny even pre-approved tools. Both must be configured correctly.
**Why it happens:** These are separate permission layers. `allowedTools` handles the SDK's built-in permission system. `canUseTool` is an additional hook.
**How to avoid:** Set `allowedTools: ['mcp__myelin__*']` to pre-approve all custom tools, then use `canUseTool` for role-based restrictions. Set `permissionMode: 'bypassPermissions'` with `allowDangerouslySkipPermissions: true` to also bypass built-in tool permissions (Bash, Edit, etc.).
**Warning signs:** Permission prompts appearing in SDK output (the SDK is trying to ask for approval, but there's no UI to approve).

### Pitfall 6: Cost Tracking from Result Message
**What goes wrong:** Trying to track cost from individual API calls instead of the result summary.
**Why it happens:** The SDK aggregates cost internally and only reports total in the `result` message.
**How to avoid:** Extract cost from `SDKResultSuccess.total_cost_usd` and token counts from `SDKResultSuccess.usage` and `SDKResultSuccess.modelUsage`. Log to `cost_events` table after query completes.
**Warning signs:** Missing or zero cost data.

### Pitfall 7: Inbox JSONL Concurrent Access
**What goes wrong:** Multiple tools write to `data/agents/tamir/inbox.jsonl` simultaneously, corrupting the file.
**Why it happens:** Tools like `approve_deliverable` and `file_to_vault` may notify Tamir's inbox concurrently.
**How to avoid:** Use `proper-lockfile` for all inbox.jsonl writes. The `read_inbox` tool acquires lock, reads, truncates, releases.
**Warning signs:** Malformed JSONL lines, lost notifications.

## Code Examples

### Creating the MCP Server with tool() Helper
```typescript
// Source: SDK official docs (platform.claude.com/docs/en/agent-sdk/custom-tools)
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const readMemory = tool(
  'read_memory',
  'Read your MEMORY.md file to recall context from past tasks',
  {},  // empty schema = no input params
  async () => {
    const content = readFileOrDefault(memoryPath, 'No memories yet.');
    return { content: [{ type: 'text' as const, text: content }] };
  },
  { annotations: { readOnlyHint: true } }
);

const writeMemory = tool(
  'write_memory',
  'Update your MEMORY.md with new learnings, project notes, or conventions',
  { content: z.string().describe('Full updated MEMORY.md content') },
  async (args) => {
    fs.writeFileSync(memoryPath, args.content, 'utf-8');
    return { content: [{ type: 'text' as const, text: 'Memory updated.' }] };
  }
);

const server = createSdkMcpServer({
  name: 'myelin',
  tools: [readMemory, writeMemory, /* ... 12 more tools ... */],
});
```

### Iterating the Query Stream
```typescript
// Source: SDK type definitions (SDKMessage union type)
const q = query({ prompt, options });

for await (const msg of q) {
  switch (msg.type) {
    case 'system':
      if (msg.subtype === 'init') {
        // Session started -- capture session_id, verify MCP server status
        const failedMcp = msg.mcp_servers.filter(s => s.status !== 'connected');
        if (failedMcp.length > 0) log.error({ failedMcp }, 'MCP servers failed');
      }
      if (msg.subtype === 'api_retry') {
        // SDK is retrying after an API error (503, rate limit, etc.)
        log.warn({ attempt: msg.attempt, delay: msg.retry_delay_ms }, 'API retry');
      }
      break;
    case 'assistant':
      // Full assistant message with tool_use blocks
      logToActivityLog(msg);
      break;
    case 'stream_event':
      // Partial streaming (when includePartialMessages: true)
      emitToBuildLog(msg);
      break;
    case 'tool_progress':
      // Tool execution progress
      emitToBuildLog(msg);
      break;
    case 'tool_use_summary':
      // Summary of recent tool uses
      logToActivityLog(msg);
      break;
    case 'result':
      // Query complete -- extract cost, session_id, structured_output
      if (msg.subtype === 'success') {
        return { cost: msg.total_cost_usd, result: msg.result, structured: msg.structured_output };
      } else {
        // Error: msg.subtype is 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd'
        throw new Error(`Agent execution failed: ${msg.subtype}`);
      }
  }
}
```

### Tool Handler Returning Error (Not Throwing)
```typescript
// Source: SDK custom tools docs
const promoteToDeliverable = tool(
  'promote_to_deliverable',
  'Copy a file from your desk to the deliverables directory',
  {
    source_path: z.string().describe('Relative path from desk to the file'),
    description: z.string().describe('Brief description of the deliverable'),
  },
  async (args) => {
    const srcFull = path.resolve(ctx.deskDir, args.source_path);
    // Path traversal check
    if (!srcFull.startsWith(ctx.deskDir)) {
      return {
        content: [{ type: 'text', text: 'Path traversal denied: source must be within desk' }],
        isError: true,
      };
    }
    if (!fs.existsSync(srcFull)) {
      return {
        content: [{ type: 'text', text: `File not found: ${args.source_path}` }],
        isError: true,
      };
    }
    // Copy and update manifest...
    return { content: [{ type: 'text', text: `Promoted ${args.source_path} to deliverables` }] };
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| claude-code-sdk | @anthropic-ai/claude-agent-sdk | 2026 rename | Same package, renamed. Import from `@anthropic-ai/claude-agent-sdk` |
| `Task` tool name for subagents | `Agent` tool name | v2.1.63 | Check both names for compatibility |
| maxThinkingTokens (number) | thinking: { type: 'adaptive' } | Opus 4.6 | Use `thinking` option instead of deprecated `maxThinkingTokens` |
| Separate MCP server processes | `createSdkMcpServer()` in-process | SDK 0.2.x | Tools run in same process, no IPC overhead for tool definitions |

**Deprecated/outdated:**
- `maxThinkingTokens` option -- use `thinking: { type: 'adaptive' }` instead
- `Task` tool name for subagents -- now `Agent`, but check both for compat

## Open Questions

1. **CLAUDE_CODE_STREAM_CLOSE_TIMEOUT for long MCP calls**
   - What we know: SDK docs say "If your SDK MCP calls will run longer than 60s, override CLAUDE_CODE_STREAM_CLOSE_TIMEOUT"
   - What's unclear: Some tools (search_knowledge with large corpus, file operations) might exceed 60s
   - Recommendation: Set `CLAUDE_CODE_STREAM_CLOSE_TIMEOUT=120000` in env for safety. Monitor during spike.

2. **settingSources interaction with desk CLAUDE.md**
   - What we know: `settingSources: ['project']` loads `.claude/settings.json` and `CLAUDE.md` from the project root
   - What's unclear: Whether `cwd: deskDir` makes the desk directory the "project" for CLAUDE.md loading
   - Recommendation: Test in spike. If desk CLAUDE.md doesn't auto-load, pass it via `systemPrompt.append`.

3. **SDK subprocess model memory footprint**
   - What we know: Each `query()` spawns a child process. MAX_CONCURRENT=3 means up to 3 processes.
   - What's unclear: Exact memory footprint per process on the target machine
   - Recommendation: Validate in spike (D-01). Monitor with `process.memoryUsage()` before and after.

4. **canUseTool interaction with subagent (temp employee) tool calls**
   - What we know: `canUseTool` receives `agentID` in options when running inside a subagent
   - What's unclear: Whether `agentID` maps to the AgentDefinition key or something else
   - Recommendation: Test in spike with a subagent invocation and log the `agentID` value.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Verify at install | 22.x LTS expected | -- |
| pnpm | Package manager | Verify at install | latest expected | -- |
| AWS credentials | CLAUDE_CODE_USE_BEDROCK=1 | Verify in .env | -- | Direct API key fallback |

**Missing dependencies with no fallback:**
- AWS Bedrock credentials must be configured in `.env` for the Agent SDK to authenticate

**Missing dependencies with fallback:**
- None identified -- all other dependencies are npm packages

## Sources

### Primary (HIGH confidence)
- `/tmp/agent-sdk-inspect/package/sdk.d.ts` -- Full type definitions for @anthropic-ai/claude-agent-sdk@0.2.84 (extracted from npm package)
- `https://platform.claude.com/docs/en/agent-sdk/overview` -- Official SDK overview documentation
- `https://platform.claude.com/docs/en/agent-sdk/custom-tools` -- Official custom tools guide with `createSdkMcpServer()` and `tool()` examples
- `https://platform.claude.com/docs/en/agent-sdk/mcp` -- MCP integration guide with tool naming conventions
- `https://platform.claude.com/docs/en/agent-sdk/subagents` -- Subagent documentation with AgentDefinition patterns
- npm registry (`npm view` queries, 2026-03-26) -- verified package versions

### Secondary (MEDIUM confidence)
- Existing Phase 1 codebase (`src/lib/worker.ts`, `src/lib/workspace.ts`, etc.) -- integration points verified by reading source

### Tertiary (LOW confidence)
- Memory footprint estimates for SDK subprocesses -- based on general Claude Code CLI behavior, not measured

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified against npm registry, types extracted and analyzed
- Architecture: HIGH -- SDK type definitions provide complete API surface, official docs confirm patterns
- Pitfalls: HIGH -- derived from type analysis and official docs, MCP naming convention verified
- Tool implementation: HIGH -- `createSdkMcpServer` + `tool()` pattern fully documented with examples

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (SDK is actively developed but core API is stable)
