# 01 -- Full System Architecture

## Overview

Myelin v10 is a TypeScript/Node.js application consisting of four major subsystems:

1. **Agent System** -- AI agents powered by Anthropic's TypeScript SDK
2. **The Cortex** -- Next.js 14 web dashboard (server components + API routes)
3. **Data Layer** -- SQLite (Prisma), filesystem (sessions, MEMORY.md per agent, workspaces)
4. **A2A Communication** -- Internal agent-to-agent protocol using Google A2A data model


## System Diagram

```
                         CEO (Omer)
                            |
                     Cortex (Next.js :3000)
                    /        |         \
                Tamir    Deliverables  Dashboard
                Chat     Workspace    + Org Context + Vault
                  |
             API Layer (Next.js API Routes)
                         |
              +----------+-----------+
              |                      |
         Orchestrator           SSE Event Bus
              |
         +----+----+
         |         |
       Tamir    [Agent Cards]
         |      skill-tag routing
    +----+----+
    |    |    |
   CTO  CMO  COO    <-- Real Agent SDK instances
    |    |    |          (each with own tools, soul, session)
    |    |    |
    +--consult--+    <-- A2A lateral communication
    |    |    |
   Temp Employees    <-- Dynamically provisioned per-task
         |
    Deliverable + Workspace Files
         |
    SQLite + Filesystem (MEMORY.md per agent)
```

## Technology Choices

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js 20+ (LTS) | Async I/O, single-language stack |
| Language | TypeScript 5.x (strict) | Type safety for Agent Cards, A2A schemas, API contracts |
| AI SDK | @anthropic-ai/sdk | Official Anthropic TypeScript SDK, first-class tool_use support |
| AI Model | Claude (via Agent SDK -- provider configured by env vars) | Production-grade, Omer has existing AWS infra |
| Web Framework | Next.js 14 (App Router) | SSR + API routes + streaming in one framework |
| Database | SQLite (WAL mode) | Zero config, single file, JSON as TEXT columns, FTS5 full-text search |
| ORM | Prisma | Type-safe queries, auto-migrations, excellent TS integration |
| Agent Memory | MEMORY.md per agent | Persistent preferences, lessons, patterns -- managed via global memory-management skill |
| Real-time | Server-Sent Events (SSE) | Simple, one-way server push, works with Next.js |
| Markdown | remark + rehype | AST-based, extensible, server-side rendering |
| CSS | Custom CSS variables | Dark theme, no Tailwind/Bootstrap (matches existing Cortex design) |
| Testing | vitest | Fast, TS-native, Jest-compatible |
| Package Manager | pnpm | Fast, disk-efficient |

## Three-Layer Agent Architecture

```
Layer 3: A2A Protocol      "How agents find and talk to each other"
         (data model)        TypeScript interfaces, SQLite storage
                             Internal function calls now, HTTP/gRPC later

Layer 2: Agent SDK          "How each agent thinks and uses tools"
         (execution)         Claude Agent SDK: query() with tools, skills, sessions
                             No manual messages.create() -- SDK handles the full loop

Layer 1: LLM (Claude)      "Given this prompt and tools, what should I do?"
         (intelligence)      Claude (provider-agnostic via env vars)
                             NEVER sees A2A. Just gets prompts + tools.
```

Critical rule: The LLM at Layer 1 NEVER knows A2A exists. A2A is infrastructure wrapping agents. When CTO consults CMO, it calls a tool called `consult_agent`. Claude sees a normal tool. The A2A task creation, state tracking, context threading all happen in TypeScript code outside the LLM.

## Process Architecture

Single long-lived Node.js **web process** plus a minimal **durable execution loop**. Agent runs still happen in SDK-spawned subprocesses.

- Next.js server (port 3000) -- serves Cortex UI + API routes
- Orchestrator singleton -- holds agent CONFIG objects (soul, tools, card) in memory
- Job runner / worker loop -- claims queued task runs from SQLite and invokes agents (multiple tasks execute concurrently)
- Tamir cron -- invoked every 15 minutes to process inbox and perform autonomous coordination

**Deployment assumption**: this architecture requires a persistent self-hosted Node.js runtime. The in-process event bus and background task execution are not designed for serverless or edge runtimes.

**Agents are NOT persistent processes.** They are invoked on demand via `query()`, which spawns a subprocess, does work, returns, subprocess exits. Between invocations, an agent is just a config object -- no compute, no threads.

**Important**: one Node.js web process does **not** mean one agent at a time. Multiple `query()` calls can run concurrently because each invocation creates its own SDK subprocess and async control flow.

```typescript
// src/server.ts -- Entry point
import { getOrchestrator } from './agents/orchestrator';

async function main() {
  // Initialize orchestrator -- loads config for all agents (does NOT start any agent processes)
  const orch = getOrchestrator();

  // Next.js starts via `next dev` or `next start` (standard)
  console.log('Myelin v10 running -- Cortex :3000');
}

main();
```

## Agent Session Lifecycle (query / resume)

Each agent invocation is a `query()` call that spawns a subprocess:

```
HTTP request arrives (e.g., POST /api/tasks/{id}/message)
  |
  v
API handler calls: query({ prompt, options: { cwd: desk, resume: sessionId } })
  |
  v
Agent SDK spawns subprocess:
  - Loads soul (system prompt)
  - Loads CLAUDE.md from desk (task plan + constraints)
  - Scans .claude/skills/ from desk (fresh scan every time!)
  - Calls Claude API (provider from env vars) (LLM + tools)
  - Multi-turn tool loop until done
  - Returns result
  |
  v
Subprocess exits. Agent is "asleep" again.
API handler sends HTTP response.
```

### Session Resume via session_id

The SDK returns a `session_id` on the first message of each session. Storing this and passing it as `resume` on the next `query()` gives the agent full memory of the prior conversation:

```typescript
let sessionId: string;

// First invocation: CTO clarifies the task
for await (const msg of query({
  prompt: ceoMessage,
  options: { cwd: deskPath, settingSources: ['project'], allowedTools: [...] }
})) {
  if (msg.type === 'system' && msg.subtype === 'init') {
    sessionId = msg.session_id;  // Save to DB on the task record
  }
}

// Later: CEO answers questions, CTO resumes with full context
for await (const msg of query({
  prompt: ceoAnswer,
  options: { resume: sessionId }  // Full prior conversation restored
})) {
  // CTO remembers everything from the first session
}
```

### What This Means

| Concern | How It Works |
|---------|-------------|
| **Agent "running"** | Only during a `query()` call. Subprocess lives for seconds to minutes. |
| **Between calls** | Agent is just a config object in memory. Zero compute. |
| **Conversation continuity** | `session_id` resume -- SDK restores full conversation history |
| **Skill hot-loading** | Skills are rescanned from `.claude/skills/` at EVERY `query()` start (including resume). New skills approved between calls are picked up automatically. |
| **Concurrent agents** | Two `query()` calls can run simultaneously (different subprocesses). Each has its own desk, session, skills. Safe. |
| **Parallel CTO** | Yes -- two CTO tasks can run concurrently. Different desks, different sessions. The CTO "duplicates itself." |
| **Knowledge writes** | File-level locking on shared knowledge/ directory (see Doc 02). |

## Request Flow (CEO -> Deliverable)

Driven by A2A task states. See Doc 06 for full detail.

```
1. CEO types task in Tamir chat (localhost:3000/tamir)
2. POST /api/tamir/route -> Tamir creates A2A Task, returns taskId + department
3. Routing buttons appear: "Plan with CTO" / "Plan with Tamir"
4. CEO clicks button -> frontend switches to POST /api/tasks/{taskId}/message
5. CEO talks DIRECTLY to the selected planning agent (dept head or Tamir)
6. Selected planner clarifies (task state: input-required) or drafts plan (state: working)
7. Plan appears as A2A Artifact -> canvas slides open with typewriter
8. CEO edits plan, adjusts config, selects tools/skills
9. CEO clicks "Approve & Execute" -> POST /api/tasks/{taskId}/approve
10. Deliverable + workspace created -> redirect to /deliverables/{id}
11. Task executes in background, build log updates in real-time
12. Tamir notified asynchronously (saves project summary)
```

## Canonical Task Ownership

For implementation, treat each task as having four explicit actor roles:

- `planningAgentId`
- `executorAgentId`
- `supervisorAgentId`
- `currentActorId`

Do not build core logic around a single ambiguous owner field. The UI, workspace chat, and delegation logic all depend on these roles. The task lifecycle is derived from timestamps (`approvedAt`, `completedAt`) and `currentActorId` -- there is no separate `phase` field.

## Orchestrator Scope

The Myelin orchestrator is a **business workflow coordinator**, not a replacement for Claude Agent SDK orchestration.

It should be responsible for:

- selecting the right agent config
- wiring task state to DB / UI / events
- provisioning temp employees
- queueing and monitoring executions

It should **not** reimplement:

- the agent tool loop
- skill loading
- hook execution
- session memory/resume
- low-level tool permission logic
- isolated delegated execution where SDK subagents already fit

## Task Lifecycle Derivation

There is no explicit `phase` field. The task lifecycle stage is derived from timestamps and actor state:

- **Planning**: `approvedAt` is null, `currentActorId` is the planning agent
- **Execution**: `approvedAt` is set, `completedAt` is null, `currentActorId` is the executor
- **Supervision**: `approvedAt` is set, `completedAt` is null, `currentActorId` is the supervisor
- **Done**: `completedAt` is set

Do **not** store a separate phase column. Use the derived lifecycle stage to decide which UI and handlers apply.

## Durable Execution Model

`POST /api/tasks/{taskId}/approve` should not rely only on in-memory fire-and-forget. The minimum production-safe pattern for v10 is:

1. Create a `task_runs` row with status `queued`
2. Commit DB changes before returning HTTP success
3. Worker loop claims the run and sets status `executing`
4. Multiple workers can execute concurrently -- each task gets its own SDK subprocess
5. Worker emits heartbeat events while running
6. On startup, scan `task_runs` for stale `executing` rows and mark them failed with reason `process_restart`

This is intentionally simple but prevents silent task loss on restart.

## Data Flow

```
CEO Input (text/voice)
  -> Tamir parses intent
  -> A2A Task created (status: submitted)
  -> Dept head receives TaskHandoff
  -> Dept head clarifies (A2A: input-required if needed)
  -> Plan generated (A2A Artifact)
  -> CEO approves
  -> Task status: working
  -> Employee provisioned (if needed: input-required for hire approval)
  -> Employee executes with tools
  -> Deliverable produced (A2A Artifact: markdown + files)
  -> Task status: completed
  -> Tamir briefs CEO
  -> Activity logged, cost tracked, skills extracted
```

## Error Handling Strategy

| Error | Handling |
|-------|---------|
| LLM API 503 / rate limit | Exponential backoff (3 retries, 2s/4s/8s), then surface to user |
| Agent produces empty response | Retry once with "Please provide a substantive response" appended |
| Tool execution fails | Log error, return error message to agent, let agent decide next step |
| Task stuck > 10 minutes | Tamir cron detects stale heartbeat, notifies CEO via inbox + build log |
| Database error | SQLite is local file -- no connection issues. Prisma retries on SQLITE_BUSY |
| Budget exceeded | Block further LLM calls for that agent, notify CEO |

## Security Model

- Single-user system -- no authentication on Cortex (localhost only)
- API token for programmatic access (X-API-Token header)
- Tool execution sandboxed (Python runs in subprocess with timeout)
- No secrets in agent prompts -- loaded from .env at runtime
- File access restricted to workspace directories (path traversal prevention)

## Concurrency Model

Single-user, but agents can work concurrently:
- Next.js handles HTTP concurrency natively (async/await)
- Agent LLM calls are async (non-blocking)
- Long-running tasks execute in background (fire-and-forget with status tracking)
- SSE pushes status updates to Cortex without polling
- SQLite with WAL mode handles concurrent reads; writes are serialized (fine for single-user)

## SDK Message Types (Quick Reference)

When iterating over `query()` results, messages have these types. The developer needs this reference to handle each message correctly in `invokeAgent()` and build log streaming:

| `message.type` | `message.subtype` | What It Is | Key Fields |
|-----------------|-------------------|------------|------------|
| `system` | `init` | First message of session | `session_id` -- store this for resume |
| `assistant` | -- | Agent's text response | `content` (array of text/tool_use blocks), `partial` (boolean) |
| `result` | `success` | Final result of the query | `result` (string -- the text output or structured JSON), `total_cost_usd`, `usage` ({ input_tokens, output_tokens }) |
| `result` | `error` | Query failed | `error` (string) |
| `result` | `max_turns` | Hit maxTurns limit | `result` (partial output) |

**Partial messages** (`message.partial === true`): emitted when `includePartialMessages: true` is set. These are streaming chunks of the assistant response — use them for real-time build log updates. They appear before the final non-partial assistant message.

**Tool use in assistant messages**: `message.content` may contain blocks with `type: 'tool_use'` (tool call) and `type: 'tool_result'` (tool response). These are useful for build log entries showing what tools the agent called.

## Monitoring & Observability

- **Activity Log** -- Every agent action logged to `activity_log` table with agent_id, action_type, description, metadata, timestamp
- **Cost Tracking** -- Every LLM call logged to `cost_events` table with token counts and cost in cents
- **Build Log** -- Deliverable workspace shows real-time activity as expandable Claude Code-style entries
- **SSE Events** -- Pipeline completion, plan approval, errors pushed to connected Cortex clients
- **Console Logging** -- Structured JSON logs via pino (agent_id, action, latency)
