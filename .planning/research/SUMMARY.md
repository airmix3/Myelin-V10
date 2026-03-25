# Project Research Summary

**Project:** Myelin v10 — The Cortex (TypeScript AI Agent OS)
**Domain:** Multi-agent orchestration operating system for a solo technical founder
**Researched:** 2026-03-25
**Confidence:** HIGH

## Executive Summary

Myelin v10 is not a multi-agent framework — it is a company operating system built for a single technical founder to run an autonomous AI "company." The distinction matters enormously for architecture: frameworks like CrewAI, AutoGen, and LangGraph expose primitives; Myelin is an opinionated product with organizational hierarchy (CEO -> executives -> temps), deliverable-centric workspaces, and a Chief of Staff agent (Tamir) as the intelligent entry point. The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is the correct runtime engine — it provides the full agent loop, session persistence, MCP tool integration, and subprocess isolation, eliminating the need for any custom agent loop implementation.

The recommended approach is a layered build: (1) foundation infrastructure first (SQLite + Prisma + FTS5, SSE bus, task state machine, worker loop), (2) agent execution layer second (MCP tool server, invokeAgent wrapper, workspace isolation), (3) Tamir routing and planning third, (4) Core UI in parallel with execution, then (5) full interactive workspace and (6) advanced features like skill extraction and cross-department consultation. This order reflects hard architectural dependencies — the worker loop cannot function without the state machine, agents cannot run without the MCP server, and the UI needs SSE events that only exist once agents execute.

The primary risks are all infrastructure-level: the Claude Agent SDK spawns real OS subprocesses (not threads), requiring strict concurrency caps; SQLite requires WAL mode + busy_timeout before any concurrent access; MCP tool context must use per-invocation closures or concurrent agents will corrupt each other's workspaces; and `instrumentation.ts` must fire-and-forget background workers without blocking server startup. These are addressable with correct patterns from day one, but retrofitting them is expensive. The build order in this summary is designed to hit all critical pitfall prevention points in the foundation phase.

## Key Findings

### Recommended Stack

The stack is tightly specified and largely constrained by PROJECT.md. Next.js 14 (not 15) provides the full-stack framework with SSR + API routes. The Claude Agent SDK v0.2.83 is the agent runtime — not claude-code-sdk, not a custom loop. Prisma 7.5.0 handles all CRUD while better-sqlite3 12.8.0 handles FTS5 virtual tables and sync triggers that Prisma cannot express. Zod v4 (not v3) is a hard dependency of the Agent SDK and is a ground-up rewrite with different API patterns. pnpm is the required package manager.

**Core technologies:**
- **Next.js 14.2.35**: Full-stack framework — v14 explicitly required (v15 breaks async APIs with no benefit for self-hosted single-user)
- **@anthropic-ai/claude-agent-sdk 0.2.83**: Agent runtime — provides query(), tool loop, session resume, MCP integration; never bypass this for direct API calls
- **Prisma 7.5.0 + better-sqlite3 12.8.0**: Dual-access pattern — Prisma for CRUD, better-sqlite3 for FTS5 + raw SQL; all three Prisma packages must be same version
- **zod 4.3.6**: Required peer dependency of Agent SDK — MUST be v4, v3 patterns are incompatible
- **@modelcontextprotocol/sdk 1.28.0**: Single in-process MCP server exposing all custom Myelin tools
- **@a2a-js/sdk 0.3.13**: A2A protocol types (AgentCard, TaskState) — use for types only, not HTTP transport
- **proper-lockfile 4.1.2**: Filesystem locking for concurrent JSONL/MEMORY.md writes
- **node-cron 4.2.1**: Tamir's 15-minute cron invocation, started in instrumentation.ts

**Hard exclusions:** No Tailwind CSS, no vector databases, no Docker, no React state management libraries, no Socket.IO, no dotenv, no zod v3.

See `.planning/research/STACK.md` for full version compatibility matrix and install commands.

### Expected Features

The feature dependency graph drives build order as clearly as the architectural dependencies. Task state machine and agent identity are the root nodes — everything else depends on them. The "company OS" differentiation lives in features no framework provides: company DNA as routing context, hierarchical supervisor review, skill extraction that grows the company over time, and deliverable-centric workspaces where output is the hero.

**Must have (table stakes — system non-functional without these):**
- Task state machine (6 A2A states: submitted, working, input-required, completed, failed, canceled)
- Agent identity: soul.md + card.json for Tamir, CTO, CMO, COO
- Tamir LLM routing with structured output (company DNA as context)
- invokeAgent() wrapper with cost tracking and session management
- MCP tool server with core tools (read/write memory, promote_to_deliverable, submit_for_review)
- Workspace isolation: per-task desk with symlinked skills
- Worker loop with DB job queue, heartbeat, stale-run recovery
- CEO plan approval flow and deliverable review
- SSE streaming: task:transition, task:buildlog, task:heartbeat
- Session resume (SDK session_id + cwd stored in task_runs)
- Error handling with exponential backoff (2s/4s/8s + jitter)

**Should have (company OS differentiators — add after core loop validated):**
- Skill extraction post-task (company gets smarter over time)
- Temp employee hiring via SDK subagents
- Cross-department consultation (consultAgent A2A internal)
- Autonomy slider + max budget controls
- Live build log streaming (partial message events)
- Agent memory management skill (MEMORY.md lifecycle)
- FTS5 full-text search + vault UI

**Defer (v2+):**
- HTTP/JSON-RPC A2A transport (not needed for v10 internal)
- Company DNA editor in UI
- Org Chart, Sessions, Budget pages
- SSE streaming for plan generation (one-shot JSON is fine for v1)

See `.planning/research/FEATURES.md` for full dependency graph and prioritization matrix.

### Architecture Approach

The architecture is a single Next.js process containing both the HTTP server and background workers. `instrumentation.ts` bootstraps persistent background loops (worker loop, Tamir cron, FTS5 init) at server startup. The SSE bus is an in-process EventEmitter shared between API routes and the worker loop — no external pub/sub needed for single-user scale. The MCP tool server is a single `createSdkMcpServer()` instance with per-invocation closures providing task/agent context; `canUseTool` callback enforces role-based access without server proliferation.

**Major components:**
1. **Task State Machine** (`lib/task-state-machine.ts`) — enforces valid A2A transitions via WHERE-on-current-state SQL atomics; emits SSE on transition
2. **invokeAgent() wrapper** (`lib/invoke-agent.ts`) — wraps SDK `query()` with cost tracking, activity logging, SSE emission, session resume; every agent execution flows through this
3. **Worker Loop** (`lib/worker-loop.ts`) — polls `task_runs` table, enforces concurrency cap (start at 2), runs invokeAgent(), manages heartbeat and stale-run recovery
4. **MCP Tool Server** (`lib/tools/server.ts`) — single `createSdkMcpServer()` instance; per-invocation closure factory injects taskId/agentId/dept context; canUseTool enforces RBAC
5. **SSE Bus** (`lib/sse-bus.ts`) — shared EventEmitter + client Map; heartbeat every 15-30s detects dead connections; topic-filtered dispatch to avoid broadcasting all events to all clients
6. **Workspace** (`lib/workspace.ts`) — `createTaskWorkspace()` creates isolated desk with CLAUDE.md, deliverables/, and symlinked .claude/skills/ pointing to dept + global libraries
7. **Cortex UI** (Next.js App Router) — Server Components for initial data, EventSource for live updates, split-pane deliverable workspace, dashboard with agent status panel

See `.planning/research/ARCHITECTURE.md` for system diagram, full data flow, build order diagram, and anti-patterns.

### Critical Pitfalls

1. **SDK spawns subprocesses, not threads** — Each `query()` spawns a full Node.js process. Hard-cap concurrent executions at 2-3. Track process lifecycle explicitly. Set `maxTurns` + `maxBudgetUsd` on every call to prevent runaway processes. Address in: Foundation (invokeAgent + worker loop).

2. **Session ID requires matching CWD** — Session resume fails silently if `cwd` differs between initial call and resume. Store both `session_id` AND absolute `cwd` in `task_runs`. Always use `path.resolve()` + `fs.realpathSync()`. Address in: Foundation (invokeAgent wrapper).

3. **SQLite WAL single-writer bottleneck** — Concurrent agents writing activity_log/state transitions causes `SQLITE_BUSY` without explicit configuration. Set `PRAGMA journal_mode=WAL` + `PRAGMA busy_timeout=5000` at startup. Batch activity_log writes. Address in: Foundation (Prisma + SQLite setup).

4. **MCP tool context leaks between concurrent agents** — Shared module-level state in tool handlers causes Agent A to write to Agent B's files. Create a NEW MCP server instance per `query()` call (or use proper closure factory). Never store tool context globally. Address in: A2A/Tools phase.

5. **FTS5 virtual tables invisible to Prisma migrations** — Prisma cannot express FTS5 tables; `prisma migrate reset` destroys them. Add raw SQL to migration files with `IF NOT EXISTS`. Also recreate in instrumentation.ts as safety net. Address in: Foundation (schema setup).

6. **instrumentation.ts must not block** — `register()` must fire-and-forget workers. Blocking delays server startup; HMR can spawn duplicate workers. Guard with `NEXT_RUNTIME === 'nodejs'` + module-level singleton flag. Address in: Foundation.

7. **Path traversal in file-serving API** — `GET /api/deliverables/[id]/file?path=...` is vulnerable without path validation. Always `path.resolve()` then verify result starts with `deskRoot + path.sep`. Address in: Foundation (before UI).

See `.planning/research/PITFALLS.md` for all 10 critical pitfalls, integration gotchas, performance traps, and security checklist.

## Implications for Roadmap

Based on the combined research, a 6-phase build order is strongly indicated by architectural dependencies. The UI can begin in parallel with Phase 2-3, but Phases 1-2 are strict prerequisites for everything else. No phase can be safely reordered without creating rework.

### Phase 1: Foundation Infrastructure
**Rationale:** Every other component depends on the database schema, state machine, SSE bus, and SQLite configuration being correct. The critical pitfalls (WAL mode, FTS5 migration, instrumentation.ts design, session management) must all be addressed here or they become expensive rework later.
**Delivers:** Runnable database with migrations, SSE bus, task state machine, process bootstrap, Prisma singleton, FTS5 virtual tables
**Addresses:** Task state machine (P1), session resume infrastructure (P1), cost tracking foundation (P1)
**Avoids:** Pitfalls 3, 4, 8, 9 (instrumentation.ts, SQLite WAL, state machine atomics, FTS5 migrations)
**Research flag:** Standard patterns — no additional research needed

### Phase 2: Agent Execution Layer
**Rationale:** invokeAgent(), MCP tool server, worker loop, and workspace isolation form an inseparable execution unit. Building them together ensures subprocess lifecycle, concurrency limits, tool context isolation, and session resume are all wired correctly from the first agent run.
**Delivers:** Working agent execution: tasks queue, agents run in isolated desks, tools work, sessions resume, cost is tracked
**Addresses:** Agent execution (P1), MCP tool server core tools (P1), workspace isolation (P1), worker loop + job queue (P1), error handling + retry (P1)
**Avoids:** Pitfalls 1, 2, 6, 10 (subprocess lifecycle, CWD coupling, filesystem concurrency, MCP context leaks)
**Research flag:** SDK subprocess model and MCP server per-invocation pattern should be validated in a spike before full implementation

### Phase 3: Tamir Routing and Planning
**Rationale:** Tamir requires the execution layer to exist (it invokes agents), the task state machine to be stable, and company DNA. The planning -> approval -> execution handoff is the core user flow and needs careful structured output handling.
**Delivers:** CEO can submit a task, Tamir routes it to the right department, planning conversation happens, CEO approves, execution begins
**Addresses:** Tamir LLM routing (P1), task submission flow (P1), plan approval (P1), company DNA (P1), chat JSONL storage (P1)
**Avoids:** Pitfall 7 (structured output for routing — use maxTurns: 1, simple schema, always handle retry failure)
**Research flag:** Tamir routing schema design and planning turn classification patterns may benefit from a short research spike on structured output best practices

### Phase 4: Core UI
**Rationale:** Can begin in parallel with Phase 2-3 once SSE bus and state machine contracts are defined. Stub API routes returning mock events, build UI against them, then wire real execution. The dashboard and SSE client are foundational for all subsequent UI work.
**Delivers:** Cortex UI shell: CSS design system, sidebar navigation, dashboard page with agent status, SSE EventSource client hook
**Addresses:** Dashboard (P1), SSE client (P1), CSS design system (P1)
**Avoids:** Pitfall 5 (SSE connection leaks — implement heartbeat + client cleanup map from day one)
**Research flag:** Standard Next.js App Router patterns — no research needed

### Phase 5: Interactive Workspace UI
**Rationale:** Requires the full execution pipeline (Phases 1-3) to be operational. The split-pane deliverable workspace, Tamir chat, and approval flow are the CEO-facing product surface.
**Delivers:** Full CEO workflow: chat with Tamir, review plan on canvas, approve, watch execution in real-time, review deliverable
**Addresses:** Tamir chat UI (P1), deliverable workspace split-pane (P1), build log streaming (P2), task approval flow (P1)
**Avoids:** UX pitfalls (progress indication, build log parsing, empty deliverable tab state)
**Research flag:** Standard patterns — no additional research needed

### Phase 6: Advanced Company OS Features
**Rationale:** These features add compounding value after the core loop is validated with real daily use. Skill extraction in particular requires observing patterns across multiple real tasks before the extraction logic makes sense to build.
**Delivers:** Skill extraction, temp employee hiring, cross-department consultation, tool gallery, autonomy controls, FTS5 vault search, supervisor review, agent memory skill
**Addresses:** All P2 features from the prioritization matrix
**Avoids:** Cross-department context leaks (consultAgent creates child tasks, does not share parent context directly)
**Research flag:** consultAgent multi-turn A2A flow and SDK subagent provisioning via AgentDefinition may need research during planning for this phase

### Phase Ordering Rationale

- **Foundation must be Phase 1:** SQLite WAL mode, FTS5 migration patterns, and the task state machine are depended on by every other component. Retrofitting any of these is expensive.
- **Execution before UI:** The worker loop, MCP server, and workspace isolation are the hardest components to get right. Building them before the UI ensures they can be validated independently via API calls before adding UI complexity.
- **UI in parallel with execution:** The SSE bus and state machine define the event contracts. Once those contracts are stable (end of Phase 1), UI work can begin against stubs.
- **Tamir before interactive UI:** The planning -> approval -> execution flow must work end-to-end before the UI wraps it. Building the UI first would require mocking too much behavior.
- **Advanced features last:** Skill extraction requires real deliverables to analyze. Cross-department consultation requires stable concurrent execution. These cannot be validated in isolation.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Agent Execution):** SDK subprocess model with per-invocation MCP server and concurrent execution has limited examples in the wild. A spike (2-4 hours) running 2 concurrent agents before full implementation is strongly recommended.
- **Phase 3 (Tamir Routing):** Structured output with `outputFormat` + `maxTurns: 1` for routing decisions, and planning turn classification schema design, benefit from a short research sprint on structured output failure modes.
- **Phase 6 (Advanced Features):** SDK `AgentDefinition` subagent provisioning for temp employee hiring and the A2A consultAgent multi-turn flow have limited documented patterns. Flag both for research during Phase 6 planning.

Phases with standard patterns (can skip research-phase):
- **Phase 1 (Foundation):** Next.js App Router, Prisma + SQLite, SSE with ReadableStream — all well-documented with official sources. The FTS5 migration pattern is clearly defined in PITFALLS.md.
- **Phase 4 (Core UI):** Next.js App Router Server Components + EventSource client — standard patterns, extensive documentation.
- **Phase 5 (Workspace UI):** Split-pane layout, SSE-driven updates — standard frontend patterns. No novel integrations.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against live npm registry 2026-03-25. Compatibility matrix cross-checked. Explicit PROJECT.md constraints confirmed. |
| Features | HIGH | Derived primarily from detailed PROJECT.md requirements. Competitor analysis from CrewAI/AutoGen/LangGraph docs is MEDIUM confidence but used only for context, not for feature decisions. |
| Architecture | HIGH | All patterns verified against official Claude Agent SDK docs, Next.js docs, and SQLite docs. Code examples match confirmed API signatures. |
| Pitfalls | HIGH | Each pitfall sourced from official documentation (SDK, SQLite, Next.js, Prisma). Warning signs and recovery strategies are specific, not generic. |

**Overall confidence:** HIGH

### Gaps to Address

- **A2A spec state definition (MEDIUM confidence):** The official A2A spec page returned 404 during research. The 6 states (`submitted`, `working`, `input-required`, `completed`, `failed`, `canceled`) are confirmed in PROJECT.md and the @a2a-js/sdk types, but the full transition rules should be validated against the spec when it is accessible.
- **SDK subagent API stability:** AgentDefinition-based subagent provisioning is documented but has limited production usage examples. Validate the API surface during Phase 2 spike before building the temp employee hire flow.
- **Next.js 14 + TypeScript 6 compatibility:** STACK.md flags this as "verify at install time." If TS 6 causes issues with Next.js 14, pin to TypeScript 5.8.x. This should be resolved in the first day of Phase 1.
- **Per-invocation MCP server cost:** Creating a new `createSdkMcpServer()` per `query()` call (the correct pattern to avoid context leaks) may have startup overhead. Measure during Phase 2 spike and switch to the `extra` parameter pattern if needed.

## Sources

### Primary (HIGH confidence)
- npm registry live queries (2026-03-25) — all version numbers in STACK.md
- Claude Agent SDK official docs (platform.claude.com/docs/en/agent-sdk/*) — query(), sessions, MCP servers, TypeScript reference
- Next.js official docs (nextjs.org) — instrumentation.ts, App Router, custom server
- SQLite WAL documentation (sqlite.org/wal.html) — single-writer constraint, checkpoint, SQLITE_BUSY
- Prisma SQLite docs (prisma.io) — connection handling, raw queries, migrations
- PROJECT.md — source of truth for all technology decisions and explicit exclusions

### Secondary (MEDIUM confidence)
- CrewAI docs (docs.crewai.com) — competitor feature analysis, memory system, task features
- AutoGen docs (microsoft.github.io/autogen) — competitor architecture comparison
- LangGraph docs (langchain-ai.github.io/langgraph) — durable execution, human-in-the-loop patterns

### Tertiary (LOW confidence)
- A2A protocol spec — state definitions confirmed via @a2a-js/sdk types and PROJECT.md; spec page was 404 at research time

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
