# Architecture Research

**Domain:** TypeScript multi-agent OS with Next.js App Router, persistent worker loops, A2A task state machines, filesystem-based agent workspaces, and SSE real-time updates
**Researched:** 2026-03-25
**Confidence:** HIGH

## System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                         CORTEX UI (Next.js App Router)                 │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Dashboard │  │ Tamir Chat   │  │ Deliverables │  │ Org/Vault    │  │
│  │  Page     │  │  + Canvas    │  │  Workspace   │  │  Pages       │  │
│  └─────┬────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│        │               │                 │                  │          │
│  ┌─────┴───────────────┴─────────────────┴──────────────────┴───────┐  │
│  │                     SSE Client (EventSource)                      │  │
│  │          task:transition | task:buildlog | task:heartbeat         │  │
│  └───────────────────────────────┬───────────────────────────────────┘  │
├──────────────────────────────────┼─────────────────────────────────────┤
│                      API LAYER (Route Handlers)                        │
│  ┌───────────┐ ┌──────────────┐ ┌────────────────┐ ┌──────────────┐  │
│  │ /api/sse  │ │ /api/tamir/* │ │ /api/tasks/*   │ │ /api/deliv/* │  │
│  │ (SSE      │ │ (routing,    │ │ (message,      │ │ (files,      │  │
│  │  endpoint)│ │  chat)       │ │  approve,      │ │  manifest)   │  │
│  └─────┬─────┘ └──────┬───────┘ │  config)       │ └──────────────┘  │
│        │               │         └───────┬────────┘                    │
├────────┼───────────────┼─────────────────┼─────────────────────────────┤
│                      CORE SERVICES LAYER                               │
│  ┌─────┴─────┐ ┌──────┴───────┐ ┌───────┴──────┐ ┌────────────────┐  │
│  │ SSE Bus   │ │ Orchestrator │ │ Task State   │ │ invokeAgent()  │  │
│  │ (EventEmit│ │ (agent       │ │ Machine      │ │ (SDK query()   │  │
│  │  + client │ │  configs,    │ │ (transition  │ │  wrapper)      │  │
│  │  registry)│ │  routing)    │ │  enforce)    │ │                │  │
│  └───────────┘ └──────────────┘ └──────────────┘ └───────┬────────┘  │
│                                                           │            │
│  ┌────────────────────────────────────────────────────────┼──────────┐ │
│  │                    Worker Loop                         │          │ │
│  │  DB-backed job queue (task_runs) | concurrent exec     │          │ │
│  │  heartbeat | stale-run recovery  | Tamir cron (15min)  │          │ │
│  └────────────────────────────────────────────────────────┘          │ │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                 MCP Tool Server (single, in-process)              │  │
│  │  read_memory | write_memory | promote_to_deliverable | ...       │  │
│  │  canUseTool() → role-based access control per invocation         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐    │
│  │ SQLite/Prisma│  │ Filesystem   │  │ SDK Sessions              │    │
│  │ (tasks, runs,│  │ (desks,      │  │ (~/.claude/projects/...)   │    │
│  │  employees,  │  │  depts,      │  │ (managed by SDK, not us)  │    │
│  │  delivs,     │  │  vault,      │  │                           │    │
│  │  activity,   │  │  JSONL chat, │  │                           │    │
│  │  FTS5)       │  │  MEMORY.md)  │  │                           │    │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Cortex UI** | Server-rendered pages, client-side SSE subscription, CEO interaction | Next.js App Router RSC pages + client components for real-time elements |
| **SSE Bus** | Fan-out real-time events to connected browser clients | Node.js EventEmitter singleton + `/api/sse` route handler with `ReadableStream` |
| **API Route Handlers** | Request/response for task operations, chat, files, configuration | Next.js Route Handlers (`app/api/*/route.ts`) calling core services |
| **Orchestrator** | Agent registry, routing decisions, agent configuration lookup | Plain singleton object holding 4 agent configs (tamir, cto, cmo, coo) |
| **Task State Machine** | Enforce valid A2A state transitions, persist state, emit events | `transitionTask(taskId, newState)` with transition table validation |
| **invokeAgent()** | Wrap SDK `query()` with cost tracking, activity logging, session management | Async function that calls `query()`, iterates messages, logs to DB, emits SSE |
| **Worker Loop** | Dequeue task_runs, execute concurrently, heartbeat, recover stale runs | `setInterval`-based loop polling DB, spawning `invokeAgent()` per run |
| **MCP Tool Server** | Custom business tools available to all agents via single in-process server | `createSdkMcpServer()` with `tool()` definitions, `canUseTool` for RBAC |
| **SQLite/Prisma** | Relational state: tasks, employees, deliverables, activity log, FTS5 | Prisma ORM with SQLite provider, raw SQL for FTS5 virtual tables |
| **Filesystem** | Agent desks, department libraries, chat JSONL, MEMORY.md, vault | `data/` directory tree with symlinks for skill sharing |

## Recommended Project Structure

```
src/
├── app/                           # Next.js App Router
│   ├── layout.tsx                 # Global layout with sidebar
│   ├── page.tsx                   # Dashboard
│   ├── tamir/
│   │   └── page.tsx               # Tamir chat + canvas
│   ├── deliverables/
│   │   ├── page.tsx               # Gallery
│   │   └── [id]/
│   │       └── page.tsx           # Deliverable workspace
│   ├── org/
│   │   └── page.tsx               # Org Context
│   ├── vault/
│   │   └── page.tsx               # Vault search
│   ├── agents/
│   │   └── [id]/
│   │       └── page.tsx           # Agent profile stub
│   └── api/
│       ├── sse/
│       │   └── route.ts           # SSE endpoint
│       ├── tamir/
│       │   └── route/
│       │       └── route.ts       # Tamir routing
│       ├── tasks/
│       │   └── [taskId]/
│       │       ├── message/route.ts
│       │       ├── approve/route.ts
│       │       ├── config/route.ts
│       │       ├── artifact/route.ts
│       │       └── chat/route.ts
│       └── deliverables/
│           └── [id]/
│               └── file/route.ts
├── lib/                           # Core business logic (NOT in app/)
│   ├── orchestrator.ts            # Agent configs singleton
│   ├── invoke-agent.ts            # SDK query() wrapper
│   ├── task-state-machine.ts      # A2A state transitions
│   ├── worker-loop.ts             # Background job processor
│   ├── tamir-cron.ts              # 15-min Tamir invocation
│   ├── sse-bus.ts                 # SSE event emitter + client registry
│   ├── workspace.ts               # createTaskWorkspace(), desk management
│   ├── tools/                     # MCP tool definitions
│   │   ├── server.ts              # createSdkMcpServer + canUseTool
│   │   ├── memory-tools.ts        # read_memory, write_memory
│   │   ├── knowledge-tools.ts     # read_knowledge, write_knowledge, search
│   │   ├── task-tools.ts          # submit_for_review, approve_deliverable, etc.
│   │   ├── hire-tools.ts          # hire_employee
│   │   └── consult-tools.ts       # consult_agent (A2A cross-dept)
│   ├── db.ts                      # Prisma client singleton
│   └── fts.ts                     # FTS5 setup + sync triggers
├── agents/                        # Agent identity files
│   ├── tamir/
│   │   ├── soul.md                # System prompt / personality
│   │   ├── card.json              # AgentCard metadata
│   │   └── agent.ts               # Config factory for invokeAgent()
│   ├── cto/
│   ├── cmo/
│   └── coo/
├── instrumentation.ts             # Next.js startup hook
├── prisma/
│   └── schema.prisma              # Database schema
├── config/
│   └── company-dna.template.md    # Company DNA template
├── data/                          # Runtime data (gitignored)
│   ├── vault/                     # Company vault
│   ├── departments/
│   │   ├── tech/
│   │   │   ├── planning-desk/     # CTO planning workspace
│   │   │   ├── skills/            # Department skills
│   │   │   └── knowledge/         # Department knowledge
│   │   ├── marketing/
│   │   ├── operations/
│   │   └── global/                # Cross-department resources
│   └── desks/                     # Active task workspaces
│       └── task-{id}/
│           ├── CLAUDE.md           # Injected task context
│           ├── desk/               # Working directory
│           ├── deliverables/       # Output files
│           └── .claude/skills/     # Symlinked skills
└── public/
    └── cortex.css                 # Design system
```

### Structure Rationale

- **`lib/` separate from `app/`:** Business logic is imported by route handlers and `instrumentation.ts` alike. Keeps Next.js file conventions clean. The worker loop, SSE bus, and orchestrator are process-level singletons, not request-scoped.
- **`agents/` at top level:** Agent identity files (soul.md, card.json) are project-level configuration, not runtime code. The `agent.ts` in each directory is a config factory, not a class.
- **`data/` at top level:** Filesystem-based state (desks, JSONL, MEMORY.md) lives outside `src/`. Gitignored. The SDK operates on these directories via `cwd` option.
- **`lib/tools/` grouped by domain:** Each file exports `tool()` definitions. `server.ts` assembles them into the single `createSdkMcpServer` instance with `canUseTool` callback.

## Architectural Patterns

### Pattern 1: SDK Subprocess per Agent Invocation

**What:** Each `invokeAgent()` call creates a new `query()` which spawns a Claude Agent SDK subprocess. The subprocess runs the full agent loop (tool calls, reasoning, etc.) autonomously. The parent process iterates the async generator to observe messages, log activity, and emit SSE events.

**When to use:** Every agent execution -- planning turns, task execution, Tamir cron, supervisor review.

**Trade-offs:**
- PRO: Complete isolation between concurrent agent runs. One crashing subprocess does not affect others.
- PRO: SDK manages its own tool loop, session persistence, context window. No reimplementation.
- CON: Each subprocess is a Node.js process. Concurrent execution means multiple processes. Memory usage scales with concurrency.
- CON: Communication is one-way streaming (async generator). Cannot inject mid-run instructions (except via tools the agent calls).

**Example:**
```typescript
// lib/invoke-agent.ts
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export async function invokeAgent(opts: {
  agentId: string;
  taskId: string;
  prompt: string;
  cwd: string;
  mcpServer: McpSdkServerConfigWithInstance;
  sessionId?: string;
  extraSystemPrompt?: string;
}) {
  const agentConfig = orchestrator.getAgent(opts.agentId);

  for await (const message of query({
    prompt: opts.prompt,
    options: {
      systemPrompt: agentConfig.systemPrompt,
      cwd: opts.cwd,                          // Agent's desk directory
      mcpServers: { myelin: opts.mcpServer },  // Single in-process MCP server
      allowedTools: [
        "Read", "Write", "Edit", "Bash", "Glob", "Grep",
        "mcp__myelin__*"                       // All custom tools
      ],
      settingSources: ["project"],             // Load CLAUDE.md from desk
      resume: opts.sessionId,                  // Resume prior session if multi-turn
      maxTurns: agentConfig.maxTurns,
      maxBudgetUsd: agentConfig.maxBudget,
      outputFormat: agentConfig.outputFormat,  // Structured output for routing turns
      permissionMode: "bypassPermissions",     // Agents run autonomously
      allowDangerouslySkipPermissions: true,
      includePartialMessages: true,            // For live build log streaming
    }
  })) {
    // Log to activity_log table
    await logActivity(opts.taskId, message);

    // Emit to SSE bus for live UI
    if (message.type === "assistant") {
      sseBus.emit("task:buildlog", { taskId: opts.taskId, message });
    }

    // Capture session_id for resume
    if (message.type === "result") {
      await updateTaskRun(opts.taskId, {
        sessionId: message.session_id,
        cost: message.total_cost_usd,
        status: message.subtype,
      });
    }
  }
}
```

### Pattern 2: instrumentation.ts as Process Bootstrap

**What:** Next.js calls `register()` in `instrumentation.ts` exactly once when the server process starts. This is where background workers, cron jobs, and singleton initialization happen. The function must complete before the server handles requests, but it can start background loops that run indefinitely.

**When to use:** Worker loop startup, Tamir cron scheduling, FTS5 initialization, company DNA first-boot copy.

**Trade-offs:**
- PRO: Guaranteed single execution per process start. No race conditions with multiple imports.
- PRO: Runs before any request handling, so singletons are ready when routes need them.
- CON: Must gate on `NEXT_RUNTIME === 'nodejs'` -- edge runtime has no access to Node APIs.
- CON: If `register()` throws, the entire server fails to start. Must be resilient.

**Example:**
```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic import to avoid bundling in edge runtime
    const { startWorkerLoop } = await import("./lib/worker-loop");
    const { startTamirCron } = await import("./lib/tamir-cron");
    const { initFTS } = await import("./lib/fts");
    const { ensureCompanyDNA } = await import("./lib/bootstrap");

    await initFTS();              // Create FTS5 virtual tables + triggers
    await ensureCompanyDNA();     // Copy template on first boot
    startWorkerLoop();            // Begin polling task_runs (no await -- runs forever)
    startTamirCron();             // setInterval every 15 minutes
  }
}
```

### Pattern 3: Single MCP Server with Runtime RBAC via canUseTool

**What:** All custom Myelin tools are registered in one `createSdkMcpServer()` instance. Access control is enforced at runtime through the `canUseTool` callback on each `query()` invocation, not by creating separate servers per role. A `ToolContext` closure factory injects per-invocation context (taskId, agentId, department, paths) into tool handlers.

**When to use:** Every agent invocation gets the same MCP server reference, but `canUseTool` restricts which tools the agent can actually call based on its role.

**Trade-offs:**
- PRO: One server to maintain. No server proliferation. Adding a tool means adding it once.
- PRO: canUseTool receives `toolName` and `input`, enabling fine-grained decisions (e.g., "CMO can read_knowledge but not write to tech department").
- CON: All tool definitions are in the agent's context window, consuming tokens even for tools the agent cannot use. Mitigated by SDK's tool search feature which loads tools on demand.
- CON: canUseTool is a permission callback, not a context filter. The agent sees tool names it cannot call, which may waste reasoning tokens.

**Example:**
```typescript
// lib/tools/server.ts
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Import all tool definitions
import { memoryTools } from "./memory-tools";
import { knowledgeTools } from "./knowledge-tools";
import { taskTools } from "./task-tools";

export const myelinMcpServer = createSdkMcpServer({
  name: "myelin",
  version: "1.0.0",
  tools: [...memoryTools, ...knowledgeTools, ...taskTools],
});

// Factory: creates a canUseTool callback scoped to one invocation
export function createCanUseTool(agentId: string, dept: string) {
  const ROLE_PERMISSIONS: Record<string, string[]> = {
    tamir: ["read_memory", "write_memory", "read_inbox", "consult_agent", "hire_employee"],
    cto:   ["read_memory", "write_memory", "read_knowledge", "write_knowledge",
             "promote_to_deliverable", "submit_for_review"],
    cmo:   ["read_memory", "write_memory", "read_knowledge", "write_knowledge",
             "promote_to_deliverable", "submit_for_review"],
    coo:   ["read_memory", "write_memory", "read_knowledge", "write_knowledge",
             "promote_to_deliverable", "submit_for_review"],
  };

  return async (toolName: string, input: Record<string, unknown>) => {
    // Built-in tools: always allow
    if (!toolName.startsWith("mcp__myelin__")) {
      return { behavior: "allow" as const };
    }

    const shortName = toolName.replace("mcp__myelin__", "");
    const allowed = ROLE_PERMISSIONS[agentId] ?? [];

    if (!allowed.includes(shortName)) {
      return { behavior: "deny" as const, message: `${agentId} cannot use ${shortName}` };
    }
    return { behavior: "allow" as const };
  };
}
```

### Pattern 4: Filesystem Desk Isolation via SDK cwd

**What:** Each task execution gets its own directory (`data/desks/task-{id}/`) with a `desk/` working directory, `deliverables/` output directory, injected `CLAUDE.md`, and symlinked `.claude/skills/` from the department + global libraries. The SDK's `cwd` option points the subprocess to this desk, so all file operations are naturally scoped.

**When to use:** Every task execution (not planning -- planning uses the department's planning desk).

**Trade-offs:**
- PRO: Natural sandboxing. Agent file operations are scoped to its desk. No path manipulation needed.
- PRO: SDK reads CLAUDE.md from cwd automatically (with `settingSources: ["project"]`), injecting task-specific instructions.
- PRO: Symlinked skills mean agents discover skills via the SDK's native skill system without custom code.
- CON: Filesystem setup/teardown per task. Must handle cleanup for completed/failed tasks.
- CON: Symlink management adds complexity. Must ensure target directories exist before symlinking.

**Example:**
```typescript
// lib/workspace.ts
import { mkdirSync, symlinkSync, writeFileSync } from "fs";
import { join } from "path";

export function createTaskWorkspace(opts: {
  taskId: string;
  dept: string;
  agentId: string;
  ceoHints: string;
  plan: string;
}) {
  const base = join(process.cwd(), "data", "desks", `task-${opts.taskId}`);
  const desk = join(base, "desk");
  const deliverables = join(base, "deliverables");
  const skills = join(base, ".claude", "skills");

  mkdirSync(desk, { recursive: true });
  mkdirSync(deliverables, { recursive: true });
  mkdirSync(skills, { recursive: true });

  // Symlink department skills
  const deptSkills = join(process.cwd(), "data", "departments", opts.dept, "skills");
  symlinkSync(deptSkills, join(skills, opts.dept), "junction");

  // Symlink global skills
  const globalSkills = join(process.cwd(), "data", "departments", "global", "skills");
  symlinkSync(globalSkills, join(skills, "global"), "junction");

  // Write CLAUDE.md with task context
  writeFileSync(join(base, "CLAUDE.md"), [
    `# Task: ${opts.taskId}`,
    `## Agent: ${opts.agentId}`,
    `## Department: ${opts.dept}`,
    `## Plan\n${opts.plan}`,
    opts.ceoHints ? `## CEO Instructions\n${opts.ceoHints}` : "",
  ].join("\n\n"));

  // Initialize deliverable manifest
  writeFileSync(join(base, "deliverable_manifest.json"), JSON.stringify({
    taskId: opts.taskId,
    files: [],
    primaryFile: null,
  }));

  return base; // This becomes the cwd for invokeAgent()
}
```

### Pattern 5: A2A Task State Machine with Derived Lifecycle Phases

**What:** Tasks have exactly 6 states from the A2A spec: `submitted`, `working`, `input-required`, `completed`, `failed`, `canceled`. Planning, execution, and review are NOT states -- they are derived from the combination of current state + `currentActorId`. A `transitionTask()` function enforces valid transitions via a lookup table.

**When to use:** Every task state change flows through `transitionTask()`. No direct DB updates to task state.

**Trade-offs:**
- PRO: Strict A2A compliance. No custom states to explain or maintain.
- PRO: Derived phases are flexible. "Who is working" tells you the phase without an extra field.
- CON: Querying "all tasks in planning" requires joining on currentActorId role, not a simple state filter.

**Example:**
```typescript
// lib/task-state-machine.ts
type TaskState = "submitted" | "working" | "input-required" | "completed" | "failed" | "canceled";

const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  submitted:       ["working", "canceled"],
  working:         ["input-required", "completed", "failed", "canceled"],
  "input-required":["working", "canceled"],
  completed:       [],  // Terminal
  failed:          [],  // Terminal
  canceled:        [],  // Terminal
};

export async function transitionTask(
  taskId: string,
  newState: TaskState,
  actorId?: string
): Promise<void> {
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  const currentState = task.state as TaskState;

  if (!VALID_TRANSITIONS[currentState].includes(newState)) {
    throw new Error(`Invalid transition: ${currentState} -> ${newState}`);
  }

  await db.task.update({
    where: { id: taskId },
    data: {
      state: newState,
      currentActorId: actorId ?? task.currentActorId,
      updatedAt: new Date(),
    },
  });

  await db.activityLog.create({
    data: {
      taskId,
      type: "STATE_TRANSITION",
      data: JSON.stringify({ from: currentState, to: newState, actor: actorId }),
    },
  });

  sseBus.emit("task:transition", { taskId, from: currentState, to: newState });
}
```

## Data Flow

### CEO -> Deliverable: Full Task Lifecycle

```
CEO types message in /tamir
    |
    v
POST /api/tamir/route
    |
    v
Tamir LLM invoked with outputFormat (structured JSON)
    --> Returns: { department, reasoning, taskType }
    |
    v
A2A Task created (state: submitted, currentActorId: dept_head)
Task transitioned to working
    |
    v
[PLANNING PHASE - derived from state:working + actor:dept_head]
POST /api/tasks/[id]/message (multi-turn chat loop)
    --> Dept head invoked with outputFormat for turn routing
    --> Returns structured: { turnType: "plan_ready" | "question" | "continue" }
    --> Chat stored as JSONL on filesystem
    |
    v
CEO reviews plan in Canvas split pane
CEO configures: autonomy, budget, tools, constraints
    |
    v
POST /api/tasks/[id]/approve
    --> createTaskWorkspace() builds isolated desk
    --> Injects CEO hints + plan into CLAUDE.md
    --> Creates deliverable record in DB
    --> Enqueues task_run row (state: queued)
    --> Redirects to /deliverables/[id]
    |
    v
[EXECUTION PHASE - derived from state:working + actor:executor]
Worker loop picks up task_run from DB
    --> invokeAgent() spawns SDK subprocess in desk cwd
    --> Agent works autonomously: reads files, runs code, calls tools
    --> Messages stream: activity_log (DB) + SSE (live UI)
    --> Agent calls promote_to_deliverable to mark output files
    --> Agent calls submit_for_review when done
    |
    v
[REVIEW PHASE - derived from state:working + actor:supervisor]
Worker loop picks up supervisor review task_run
    --> Supervisor agent invoked, reviews deliverables
    --> Calls approve_deliverable OR request_changes
    |
    v
If approved:  transitionTask(taskId, "completed")
If changes:   transitionTask(taskId, "working") + new executor run
```

### SSE Event Flow (Real-time UI)

```
invokeAgent() iterates SDK messages
    |
    ├── message.type === "assistant"
    |       --> sseBus.emit("task:buildlog", { taskId, content })
    |       --> Browser: Build Log tab updates live
    |
    ├── Every 30s during execution
    |       --> sseBus.emit("task:heartbeat", { taskId, timestamp })
    |       --> Browser: liveness indicator stays green
    |
    └── transitionTask() called
            --> sseBus.emit("task:transition", { taskId, from, to })
            --> Browser: Dashboard status updates, badge changes

/api/sse route handler:
    - Creates ReadableStream
    - Registers client in sseBus client registry
    - On event: writes `data: ${JSON.stringify(event)}\n\n` to stream
    - On client disconnect: removes from registry
```

### Agent-to-Agent Consultation Flow

```
CTO working on task in tech desk
    |
    v
CTO calls consult_agent("cmo", "What brand tone for API docs?")
    |
    v
consult_agent tool handler:
    1. Creates child A2A Task (parent: original task)
    2. Invokes CMO via invokeAgent() with consultation prompt
    3. CMO responds (may be multi-turn via input-required)
    4. Returns CMO's response as tool result to CTO
    |
    v
CTO continues with CMO's input in context
```

## Key Integration Points

### How instrumentation.ts Wires Background Workers

The critical architectural insight: Next.js `instrumentation.ts` runs `register()` once when the Node.js server process starts. This is the single point where long-running background work begins. It runs before any HTTP request is handled.

```
Next.js process starts
    |
    v
instrumentation.ts register() called
    |
    ├── NEXT_RUNTIME === "nodejs"? YES:
    |       |
    |       ├── initFTS()           -- sync, must complete before requests
    |       ├── ensureCompanyDNA()   -- sync, first-boot only
    |       ├── startWorkerLoop()   -- async, runs forever (setInterval)
    |       └── startTamirCron()    -- async, runs every 15min (setInterval)
    |
    v
Server ready, starts handling requests
Worker loop and cron run in same process, sharing singletons
(SSE bus, Prisma client, MCP server instance)
```

**Critical detail:** The worker loop and API routes share the same Node.js process. This means:
- The SSE bus EventEmitter is the same instance for both. Worker emits, API route streams to client.
- The Prisma client is the same instance. No connection pool issues.
- The MCP server created via `createSdkMcpServer()` is the same instance. Created once, passed to every `invokeAgent()` call.

### How SDK query() Subprocess Model Works with Concurrent Tasks

Each `query()` call spawns a separate Node.js subprocess running the Claude Agent SDK CLI. The parent process (Next.js server) manages concurrency:

```
Next.js Process (single)
    |
    ├── Worker Loop (setInterval polling)
    |       |
    |       ├── Task Run A: invokeAgent() --> query() --> Subprocess A
    |       ├── Task Run B: invokeAgent() --> query() --> Subprocess B
    |       └── Task Run C: invokeAgent() --> query() --> Subprocess C
    |
    ├── API Route: POST /api/tasks/[id]/message
    |       └── invokeAgent() --> query() --> Subprocess D (planning turn)
    |
    └── Tamir Cron (setInterval 15min)
            └── invokeAgent() --> query() --> Subprocess E (Tamir maintenance)
```

**Concurrency control:** The worker loop should limit concurrent runs (e.g., 3 simultaneous). Each subprocess is memory-intensive (the SDK CLI + LLM context). SQLite also has write-lock contention under high concurrency -- use WAL mode and serialize writes via a queue.

**Session resume:** Each subprocess run produces a `session_id`. Stored in the `task_runs` table. Multi-turn planning and execution-then-review chains use `resume: sessionId` to continue prior context.

### How Filesystem Desks Isolate Agents

```
data/
├── departments/
│   ├── tech/
│   │   ├── planning-desk/         # CTO planning conversations happen here
│   │   │   ├── CLAUDE.md          # Planning-specific instructions
│   │   │   └── .claude/skills/    # Symlinks to tech + global skills
│   │   ├── skills/                # Tech department skill files
│   │   │   └── aws-deploy.md
│   │   └── knowledge/             # Tech department knowledge
│   │       └── architecture.md
│   └── global/
│       └── skills/                # Shared across all departments
│           ├── memory-management.md
│           └── skill-extractor.md
│
└── desks/
    └── task-abc123/               # Execution workspace (cwd for SDK)
        ├── CLAUDE.md              # Task plan + CEO hints + agent role
        ├── desk/                  # Agent's working directory
        │   ├── main.py            # Agent creates files here
        │   └── data/
        ├── deliverables/          # Promoted output files
        │   └── report.md
        ├── deliverable_manifest.json
        └── .claude/
            └── skills/            # Symlinked skill discovery
                ├── tech -> ../../departments/tech/skills
                └── global -> ../../departments/global/skills
```

The SDK reads `.claude/skills/` relative to `cwd` when `settingSources: ["project"]` is set. Symlinks make department and global skills discoverable without copying. The CLAUDE.md at desk root becomes the agent's project memory.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user, 1-3 concurrent tasks | Current architecture. SQLite WAL mode. 3 concurrent subprocess limit. Single Next.js process. |
| 1 user, 5-10 concurrent tasks | Increase subprocess limit cautiously. Monitor memory (each SDK subprocess ~200-500MB). Consider task prioritization queue. |
| Multi-user (v10.1+) | SQLite becomes bottleneck under write contention. Migrate to PostgreSQL. Worker loop becomes separate process. SSE bus needs Redis pub/sub for multi-process. |

### Scaling Priorities

1. **First bottleneck: Memory.** Each SDK subprocess is a full Node.js process. At 3 concurrent tasks, expect ~1-2GB memory usage for subprocesses alone plus the Next.js server. Monitor and set `maxTurns` / `maxBudgetUsd` to prevent runaway executions.
2. **Second bottleneck: SQLite write contention.** Multiple concurrent workers writing activity_log, task state transitions, and heartbeats. WAL mode helps. Batch writes where possible. Use a write-through queue if needed.

## Anti-Patterns

### Anti-Pattern 1: Agent Classes with Inheritance

**What people do:** Create `BaseAgent`, `ExecutiveAgent extends BaseAgent`, `TempAgent extends ExecutiveAgent` class hierarchies.
**Why it's wrong:** The SDK already IS the agent runtime. Your code configures invocations, it does not implement agent behavior. Class hierarchies add indirection without value and fight against the SDK's functional model.
**Do this instead:** Plain config objects in the orchestrator. Each agent is a record of `{ systemPrompt, maxTurns, maxBudget, tools, outputFormat }`. The `invokeAgent()` function accepts these configs.

### Anti-Pattern 2: Custom Tool Loop Reimplementation

**What people do:** Implement their own tool-calling loop: send prompt, parse tool_use, execute tool, send result, repeat.
**Why it's wrong:** The SDK's `query()` handles the entire tool loop internally, including retries, context management, and session persistence. Reimplementing this means reimplementing the SDK poorly.
**Do this instead:** Use `query()` and iterate the async generator. Your tools are MCP server definitions, not imperative handler chains.

### Anti-Pattern 3: Storing Chat in SQLite Columns

**What people do:** Store conversation messages as JSON columns or normalized message tables in SQLite.
**Why it's wrong:** Chat is append-only, never queried relationally, and can be very large. SQLite columns for large JSON blobs hurt performance. The SDK already persists sessions to `~/.claude/projects/` JSONL files.
**Do this instead:** Application-level chat (CEO-visible conversation) stored as filesystem JSONL in the desk. SDK session transcripts managed by the SDK. Only metadata (task state, cost, timestamps) in SQLite.

### Anti-Pattern 4: Multiple MCP Servers per Role

**What people do:** Create separate MCP server instances for each agent role (one for Tamir, one for CTO, etc.) with different tool sets.
**Why it's wrong:** Server proliferation. Each server is a separate process or instance to manage. Tool definitions are duplicated. Adding a tool means updating multiple servers.
**Do this instead:** One `createSdkMcpServer()` with all tools. Use `canUseTool` callback on each `query()` invocation to enforce per-role access. The callback receives the tool name and agent context, enabling fine-grained decisions.

### Anti-Pattern 5: Blocking instrumentation.ts with Agent Work

**What people do:** Await a long-running agent invocation inside `register()`, blocking server startup until it completes.
**Why it's wrong:** `register()` must complete before the server handles any requests. A 5-minute Tamir run blocks the entire UI.
**Do this instead:** `register()` starts background loops (setInterval, etc.) and returns immediately. The loops run asynchronously in the same process. Only synchronous initialization (FTS5 setup, file copies) should be awaited.

## Build Order (Dependency-Driven)

The components have clear dependency chains that dictate build order:

```
Phase 1: Foundation (no dependencies)
    ├── Prisma schema + SQLite setup
    ├── FTS5 virtual tables
    ├── Orchestrator singleton (agent configs)
    ├── Task state machine
    └── SSE bus

Phase 2: Agent Execution (depends on Phase 1)
    ├── MCP tool server (createSdkMcpServer + canUseTool)
    ├── invokeAgent() wrapper
    ├── Worker loop (depends on invokeAgent + task state machine)
    ├── Workspace creation (createTaskWorkspace)
    └── instrumentation.ts wiring

Phase 3: Tamir + A2A (depends on Phase 2)
    ├── Tamir routing (LLM structured output)
    ├── Planning desk setup
    ├── Chat JSONL storage
    ├── consultAgent() (A2A cross-dept)
    └── Tamir cron

Phase 4: Core UI (depends on Phase 1 SSE, can parallel with Phase 2-3)
    ├── CSS design system
    ├── Layout + sidebar
    ├── Dashboard page
    ├── SSE client hook

Phase 5: Interactive UI (depends on Phase 2-3)
    ├── Tamir chat page + canvas
    ├── Task approval flow
    ├── Deliverable workspace (split pane, tabs)
    ├── Build log streaming

Phase 6: Polish + Skills (depends on Phase 5)
    ├── Org Context page
    ├── Vault page
    ├── Skill extraction
    ├── Hire flow
    └── Supervisor review
```

**Key dependency insight:** The UI can start being built in parallel with the agent execution layer. The SSE bus and task state machine are the shared contracts. Stub the agent execution behind the API routes, build the UI against mocked events, then wire real execution later.

## Sources

- **Claude Agent SDK (TypeScript):** https://platform.claude.com/docs/en/agent-sdk/overview (HIGH confidence - official docs, verified 2026-03-25)
- **SDK Sessions:** https://platform.claude.com/docs/en/agent-sdk/sessions (HIGH confidence - official docs)
- **SDK Custom Tools / createSdkMcpServer:** https://platform.claude.com/docs/en/agent-sdk/custom-tools (HIGH confidence - official docs)
- **SDK Subagents / AgentDefinition:** https://platform.claude.com/docs/en/agent-sdk/subagents (HIGH confidence - official docs)
- **SDK TypeScript Reference (Options, canUseTool, outputFormat):** https://platform.claude.com/docs/en/agent-sdk/typescript (HIGH confidence - official docs)
- **Next.js instrumentation.ts:** https://nextjs.org/docs/app/guides/instrumentation (HIGH confidence - official docs, verified 2026-03-25)
- **A2A Protocol states:** Derived from Google A2A spec standard states (MEDIUM confidence - official spec page was 404, states confirmed in PROJECT.md requirements)

---
*Architecture research for: Myelin v10 -- TypeScript multi-agent OS*
*Researched: 2026-03-25*
