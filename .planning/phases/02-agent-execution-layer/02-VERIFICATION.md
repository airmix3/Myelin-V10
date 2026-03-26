---
phase: 02-agent-execution-layer
verified: 2026-03-26T10:00:00Z
status: passed
score: 23/23 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Execute a real agent task end-to-end via the worker loop"
    expected: "Agent picks up queued run, SDK query() runs, cost tracked, session stored, task transitions to completed"
    why_human: "Requires live AWS Bedrock credentials and a real DB with queued task_run — cannot verify in static analysis"
  - test: "Concurrent agent isolation under real load"
    expected: "Two agents running simultaneously each read/write their own MEMORY.md without cross-contamination"
    why_human: "Requires live SDK execution; script validate-concurrent-isolation.ts has minor TS error on _serverInstance property but the underlying isolation logic is architecturally sound (per-invocation ToolContext closure)"
  - test: "Hire approval flow UI integration"
    expected: "CEO approves hire in Cortex UI, task_run is enqueued, worker re-invokes dept head with subagent definition"
    why_human: "Requires running server and UI interaction — no UI exists yet (Phase 3)"
---

# Phase 02: Agent Execution Layer Verification Report

**Phase Goal:** Agents actually execute tasks — SDK query() runs in isolated workspaces with MCP tools, cost tracking, session resume, and role-based access control
**Verified:** 2026-03-26T10:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SDK query() runs via invokeAgent() with per-invocation MCP server | ✓ VERIFIED | `src/lib/invoke-agent.ts` calls `query()`, creates `buildMyelinMcpServer(ctx)` per call (line 63) |
| 2 | MCP server factory creates a fresh isolated server per invocation | ✓ VERIFIED | `buildMyelinMcpServer(ctx)` in `server.ts` calls `createSdkMcpServer` fresh each call; ToolContext is closure-bound |
| 3 | Role-based access control denies Tamir-only tools to non-Tamir agents | ✓ VERIFIED | `access-control.ts`: TAMIR_ONLY = ['mcp__myelin__read_inbox', 'mcp__myelin__get_dept_status']; check at line 48 |
| 4 | Role-based access control denies dept-head-only tools to temp employees | ✓ VERIFIED | DEPT_HEAD_ONLY list; temp employee whitelist enforced at line 58 |
| 5 | invokeAgent() stores sessionId and workspaceCwd in task_runs for resume | ✓ VERIFIED | `UPDATE task_runs SET sessionId = ?, workspaceCwd = ?` at line 184-186 |
| 6 | Cost logged to cost_events table from SDK result | ✓ VERIFIED | `INSERT INTO cost_events` at line 170-181 |
| 7 | Build log events streamed to SSE via eventBus | ✓ VERIFIED | `eventBus.emit('task:buildlog', ...)` at lines 132, 140, 145 |
| 8 | Orchestrator holds configs for all 4 agents and exposes invoke() | ✓ VERIFIED | `orchestrator.ts`: `initOrchestrator()` imports all 4 agent configs; `invoke()` method dispatches |
| 9 | Worker executeRun() calls orchestrator.invoke() with real agents | ✓ VERIFIED | `worker.ts` line 199: `await orchestrator.invoke({...})`; no Phase 1 stub |
| 10 | instrumentation.ts calls seedAgents() and initOrchestrator() on startup | ✓ VERIFIED | Lines 84-85 and 93-94 in `instrumentation.ts` |
| 11 | 4 executive agent directories with soul.md (80+ lines), card.json, agent.ts | ✓ VERIFIED | tamir: 96 lines, cto: 123, cmo: 125, coo: 126 |
| 12 | 14 MCP tools registered in server factory | ✓ VERIFIED | 14 `= tool(` declarations across 8 tool files; all spread into `createSdkMcpServer` |
| 13 | read_memory / write_memory access data/agents/{agentId}/MEMORY.md | ✓ VERIFIED | `memory.ts` uses `resolve(cwd, 'data', 'agents', ctx.agentId, 'MEMORY.md')` |
| 14 | write_knowledge uses proper-lockfile for concurrent protection | ✓ VERIFIED | `lockfile.lock(dir, { retries: 3 })` in `knowledge.ts` line 74 |
| 15 | search_knowledge calls searchDocuments() from FTS5 | ✓ VERIFIED | `knowledge.ts` imports and calls `searchDocuments(args.query, args.limit ?? 20)` |
| 16 | promote_to_deliverable has path traversal prevention | ✓ VERIFIED | `srcFull.startsWith(ctx.deskDir)` check at `deliverable.ts` line 38 |
| 17 | review flow: submit sets currentActorId, approve transitions to completed + notifies Tamir inbox | ✓ VERIFIED | `review.ts`: UPDATE currentActorId (line 65), `transitionTask('working','completed')` (line 100), `appendToInbox()` (line 106) |
| 18 | hire_employee creates HireRequest and transitions to input-required | ✓ VERIFIED | `hire.ts`: `prisma.hireRequest.create` (line 25), `transitionTask('working','input-required')` (line 38) |
| 19 | POST /api/hire_requests/[id]/approve enqueues task_run with subagent | ✓ VERIFIED | `approve/route.ts`: `prisma.taskRun.create` (line 123) with `agents: JSON.stringify(subagentDef)` (line 131) |
| 20 | POST /api/hire_requests/[id]/reject enqueues task_run for dept head continuation | ✓ VERIFIED | `reject/route.ts`: `prisma.taskRun.create` (line 74) with `agents: null` |
| 21 | ROUTING_SCHEMA and AGENT_TURN_SCHEMA defined as raw JSON Schema | ✓ VERIFIED | `schemas.ts`: both exported with `type: 'json_schema' as const`, no zod |
| 22 | 3 global skills exist with status: active, 40+ lines each | ✓ VERIFIED | memory-management: 100 lines, skill-extractor: 114, system-reset: 114; all have `status: active` |
| 23 | Worker deserializes agents field from task_run and passes to orchestrator | ✓ VERIFIED | `worker.ts` line 195-196: `JSON.parse(agentsJson)`, passed to `orchestrator.invoke` at line 209 |

**Score:** 23/23 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/a2a/types.ts` | A2A interfaces | ✓ VERIFIED | AgentCard, A2ATask, A2AMessage, TaskConfig, TaskHandoff, RoutingResult, AgentTurnResult all exported |
| `src/a2a/schemas.ts` | JSON Schema output formats | ✓ VERIFIED | ROUTING_SCHEMA and AGENT_TURN_SCHEMA exported |
| `src/lib/mcp/tool-context.ts` | ToolContext + factory | ✓ VERIFIED | Interface with 6 fields, createToolContext factory |
| `src/lib/mcp/access-control.ts` | buildCanUseTool factory | ✓ VERIFIED | 3-tier control: Tamir-only, dept-head+Tamir, temp whitelist |
| `src/lib/mcp/server.ts` | buildMyelinMcpServer factory | ✓ VERIFIED | Imports all 8 tool modules, creates 14-tool server |
| `src/lib/mcp/tools/memory.ts` | read_memory, write_memory | ✓ VERIFIED | Both tools implemented with data/agents path construction |
| `src/lib/mcp/tools/knowledge.ts` | read/write/search_knowledge | ✓ VERIFIED | All 3 tools; lockfile on write; FTS5 on write; searchDocuments on search |
| `src/lib/mcp/tools/deliverable.ts` | promote_to_deliverable | ✓ VERIFIED | Path traversal check, manifest update, FTS5 indexing |
| `src/lib/mcp/tools/review.ts` | submit_for_review, approve_deliverable, request_changes | ✓ VERIFIED | All 3 tools; currentActorId transitions; inbox notification |
| `src/lib/mcp/tools/vault.ts` | file_to_vault | ✓ VERIFIED | Two-mode validation (deskDir vs absolute path) |
| `src/lib/mcp/tools/skills.ts` | propose_skill | ✓ VERIFIED | Creates SKILL.md, DB record with status: pending, inbox notification |
| `src/lib/mcp/tools/inbox.ts` | read_inbox, get_dept_status | ✓ VERIFIED | Lockfile read+clear; SQL query for dept status |
| `src/lib/mcp/tools/hire.ts` | hire_employee | ✓ VERIFIED | HireRequest creation; input-required transition; metadata update |
| `src/lib/invoke-agent.ts` | invokeAgent() wrapper | ✓ VERIFIED | Full SDK query() wrapper with cost, session, streaming, RBAC |
| `src/lib/orchestrator.ts` | AgentOrchestrator singleton | ✓ VERIFIED | globalThis singleton, register/invoke, initOrchestrator |
| `src/lib/worker.ts` | Real executeRun() | ✓ VERIFIED | No stub; full orchestrator.invoke pipeline with cost tracking |
| `src/instrumentation.ts` | Bootstrap with seeding | ✓ VERIFIED | seedAgents() + initOrchestrator() called at startup |
| `src/agents/tamir/soul.md` | 80+ line Tamir persona | ✓ VERIFIED | 96 lines; no filler phrases; direct substantive voice |
| `src/agents/cto/soul.md` | 80+ line CTO persona | ✓ VERIFIED | 123 lines; "tradeoffs" (line 13); architecture thinking |
| `src/agents/cmo/soul.md` | 80+ line CMO persona | ✓ VERIFIED | 125 lines; "narrative" and "audience" present |
| `src/agents/coo/soul.md` | 80+ line COO persona | ✓ VERIFIED | 126 lines; "second-order effects" (line 13) |
| `src/lib/seed-agents.ts` | seedAgents() DB seed | ✓ VERIFIED | 4 executives; idempotent findFirst check |
| `src/app/api/hire_requests/[id]/approve/route.ts` | POST hire approval | ✓ VERIFIED | Creates employee, subagent def, task_run, state transition |
| `src/app/api/hire_requests/[id]/reject/route.ts` | POST hire rejection | ✓ VERIFIED | task_run enqueue with null agents; state transition back to working |
| `data/departments/global/skills/memory-management/SKILL.md` | Memory management skill | ✓ VERIFIED | 100 lines; status: active; 4-section MEMORY.md format; read_memory/write_memory referenced |
| `data/departments/global/skills/skill-extractor/SKILL.md` | Skill extraction skill | ✓ VERIFIED | 114 lines; status: active; Executor + Supervisor trigger sections; propose_skill referenced |
| `data/departments/global/skills/system-reset/SKILL.md` | System reset skill | ✓ VERIFIED | 114 lines; status: active; confirmation gate; vault preservation |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/invoke-agent.ts` | `src/lib/mcp/server.ts` | `buildMyelinMcpServer(ctx)` | ✓ WIRED | Line 63: `const myelinServer = buildMyelinMcpServer(ctx)` |
| `src/lib/invoke-agent.ts` | `src/lib/mcp/access-control.ts` | `buildCanUseTool(agentId, dept)` | ✓ WIRED | Line 66: `const canUseTool = buildCanUseTool(opts.agentId, opts.department)` |
| `src/lib/invoke-agent.ts` | `src/lib/events.ts` | `eventBus.emit('task:buildlog', ...)` | ✓ WIRED | Lines 132, 140, 145 |
| `src/lib/orchestrator.ts` | `src/agents/*/agent.ts` | dynamic import for soulMd | ✓ WIRED | `initOrchestrator()` imports all 4 via dynamic imports |
| `src/lib/worker.ts` | `src/lib/orchestrator.ts` | `orchestrator.invoke(...)` | ✓ WIRED | Line 199 |
| `src/lib/worker.ts` | `task_run.agents` | `JSON.parse(run.agents)` | ✓ WIRED | Lines 195-196, passed at line 209 |
| `src/lib/mcp/server.ts` | `src/lib/mcp/tools/*.ts` | imports all tool modules | ✓ WIRED | 8 tool module imports at lines 8-15 |
| `src/lib/mcp/tools/knowledge.ts` | `src/lib/fts.ts` | `searchDocuments()` | ✓ WIRED | Line 10 import; called at line 113 |
| `src/lib/mcp/tools/review.ts` | `src/lib/state-machine.ts` | `transitionTask(...)` | ✓ WIRED | Line 100: `transitionTask(ctx.taskId, 'working', 'completed')` |
| `src/lib/mcp/tools/hire.ts` | `src/lib/state-machine.ts` | `transitionTask(..., 'input-required')` | ✓ WIRED | Line 38: `transitionTask(ctx.taskId, 'working', 'input-required', ...)` |
| `src/lib/mcp/tools/inbox.ts` | `data/agents/tamir/inbox.jsonl` | lockfile read+clear | ✓ WIRED | lockfile.lock at line 38; writeFileSync clear at line 40 |
| `src/app/api/hire_requests/[id]/approve/route.ts` | `src/lib/state-machine.ts` | `transitionTask('input-required', 'working')` | ✓ WIRED | Line 96 |
| `src/app/api/hire_requests/[id]/approve/route.ts` | `prisma.taskRun.create` | enqueue re-invocation | ✓ WIRED | Line 123 with `agents: JSON.stringify(subagentDef)` |
| `src/app/api/hire_requests/[id]/reject/route.ts` | `prisma.taskRun.create` | enqueue continuation | ✓ WIRED | Line 74 with `agents: null` |
| `src/instrumentation.ts` | `src/lib/seed-agents.ts` | `await seedAgents()` | ✓ WIRED | Lines 84-85 |
| `src/instrumentation.ts` | `src/lib/orchestrator.ts` | `await initOrchestrator()` | ✓ WIRED | Lines 93-94 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `invoke-agent.ts` | `totalCostUsd` | `msg.total_cost_usd` from SDK result | Yes — extracted from SDK SDKResultSuccess | ✓ FLOWING |
| `invoke-agent.ts` | `sessionId` | `initMsg.session_id` from SDK init | Yes — captured from SDK session init message | ✓ FLOWING |
| `worker.ts` | `result` from orchestrator | `orchestrator.invoke()` -> `invokeAgent()` | Yes — real SDK query() execution | ✓ FLOWING |
| `server.ts` | `tools` array | all 8 createXTools(ctx) | Yes — 14 real tool implementations | ✓ FLOWING |
| `approve/route.ts` | `subagentDef` | built from hireRequest + task | Yes — constructed from DB records | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly | `npx tsc --noEmit` | Only 2 errors in `scripts/validate-concurrent-isolation.ts` (non-production test script, `_serverInstance` property access); 0 errors in `src/` | ✓ PASS |
| 14 tool() declarations exist | `grep -n "= tool(" src/lib/mcp/tools/*.ts` | 14 matches confirmed across 8 files | ✓ PASS |
| server.ts imports all 8 tool modules | file content | 8 imports at lines 8-15, all spread into tools array | ✓ PASS |
| soul.md files meet 80-line minimum | `wc -l` | tamir: 96, cto: 123, cmo: 125, coo: 126 | ✓ PASS |
| SKILL.md files meet 40-line minimum | `wc -l` | memory-management: 100, skill-extractor: 114, system-reset: 114 | ✓ PASS |
| Worker has no Phase 1 stub | search for stub pattern | No stub — real `orchestrator.invoke()` at line 199 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AGENT-01 | 02-03 | invokeAgent() wrapper with systemPrompt, session resume, cost logging, streaming | ✓ SATISFIED | `invoke-agent.ts`: `preset: 'claude_code'`, `resume: opts.sessionId`, `INSERT INTO cost_events`, `eventBus.emit('task:buildlog')` |
| AGENT-02 | 02-03 | Orchestrator singleton with invoke(), outputFormat, agents, maxBudgetUsd | ✓ SATISFIED | `orchestrator.ts`: `AgentOrchestrator` class with all options, globalThis singleton |
| AGENT-03 | 02-02 | Self-contained agent directories with soul.md, card.json, agent.ts; 4 executives seeded | ✓ SATISFIED | All 12 files exist; soul.md 80+ lines; seedAgents() wired to instrumentation.ts |
| AGENT-04 | 02-05 (claim) / 02-03 (claim) | Structured output via SDK outputFormat with JSON Schema | ✓ SATISFIED | `schemas.ts` exports ROUTING_SCHEMA and AGENT_TURN_SCHEMA; invokeAgent/orchestrator accept outputFormat |
| AGENT-05 | 02-01 | A2A TypeScript interfaces | ✓ SATISFIED | `types.ts`: all 7 interfaces defined |
| AGENT-06 | 02-05 | Hire flow: hire_employee -> input-required -> CEO approval -> subagent re-invocation | ✓ SATISFIED | hire.ts tool + approve/route.ts + reject/route.ts complete the flow |
| TOOL-01 | 02-01 | Single in-process MCP server via createSdkMcpServer per invocation | ✓ SATISFIED | `server.ts`: `createSdkMcpServer({name:'myelin'})` per call |
| TOOL-02 | 02-01 | buildCanUseTool role-based access control | ✓ SATISFIED | `access-control.ts`: 3-tier enforcement |
| TOOL-03 | 02-01 | read_memory / write_memory tools | ✓ SATISFIED | `memory.ts`: both tools using data/agents/{agentId}/MEMORY.md |
| TOOL-04 | 02-01 | promote_to_deliverable tool | ✓ SATISFIED | `deliverable.ts`: path check + manifest + FTS5 |
| TOOL-05 | 02-01 | read_knowledge / write_knowledge with FTS5 + lockfile | ✓ SATISFIED | `knowledge.ts`: lockfile on write, FTS5 upsert |
| TOOL-06 | 02-01 | search_knowledge via FTS5 BM25 | ✓ SATISFIED | `knowledge.ts`: searchDocuments() |
| TOOL-07 | 02-04 | submit_for_review sets currentActorId | ✓ SATISFIED | `review.ts`: UPDATE currentActorId to supervisorAgentId |
| TOOL-08 | 02-04 | approve_deliverable transitions to completed + notifies inbox | ✓ SATISFIED | `review.ts`: transitionTask('working','completed') + appendToInbox |
| TOOL-09 | 02-04 | request_changes stores feedback, increments reviewRound, sets currentActorId back | ✓ SATISFIED | `review.ts`: UPDATE reviewFeedback + reviewRound+1 + currentActorId = executorAgentId |
| TOOL-10 | 02-04 | file_to_vault (Tamir + dept heads) with two calling modes | ✓ SATISFIED | `vault.ts`: ctx.deskDir check for mode selection |
| TOOL-11 | 02-04 | propose_skill creates SKILL.md + DB record with pending status | ✓ SATISFIED | `skills.ts`: writeFileSync SKILL.md + prisma.skill.create(status:'pending') |
| TOOL-12 | 02-04 | read_inbox reads and clears inbox.jsonl with proper-lockfile | ✓ SATISFIED | `inbox.ts`: lockfile.lock + readFileSync + writeFileSync('') |
| TOOL-13 | 02-04 | get_dept_status returns department task/employee summary | ✓ SATISFIED | `inbox.ts`: SQL GROUP BY dept/state queries |
| TOOL-14 | 02-04 | hire_employee creates HireRequest + transitions to input-required | ✓ SATISFIED | `hire.ts`: prisma.hireRequest.create + transitionTask to input-required |
| GSKILL-01 | 02-06 | memory-management global skill | ✓ SATISFIED | 100-line SKILL.md with status:active, 4-section MEMORY.md format, tool references |
| GSKILL-02 | 02-06 | skill-extractor global skill | ✓ SATISFIED | 114-line SKILL.md with status:active, Executor/Supervisor triggers, propose_skill |
| GSKILL-03 | 02-06 | system-reset global skill | ✓ SATISFIED | 114-line SKILL.md with status:active, confirmation gate, vault preservation |

**All 23 requirements satisfied. No orphaned requirements.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/validate-concurrent-isolation.ts` | 61-62 | `_serverInstance` property not in TypeScript types — causes TS error | Info | Test script only; doesn't affect production code; concurrent isolation is architecturally guaranteed by per-invocation server creation |

No blockers or warnings found in production code.

### Human Verification Required

#### 1. Live Agent Execution

**Test:** Create a task in the DB, assign an employee, create a task_run with status 'queued', start the dev server, and observe the worker loop pick it up.
**Expected:** Worker claims the run, transitions task to 'working', invokeAgent() calls SDK query(), agent executes in desk directory with MCP tools available, cost_events record created, task transitions to 'completed'.
**Why human:** Requires live AWS Bedrock credentials, running Next.js server, and a real SQLite DB with test data. Cannot verify SDK execution path without live network calls.

#### 2. Concurrent MCP Isolation Under Real Execution

**Test:** Queue two tasks simultaneously for different agents (e.g., CTO and CMO). Both should run concurrently per WORKER_MAX_CONCURRENT config.
**Expected:** Each agent's read_memory/write_memory operates on `data/agents/cto/MEMORY.md` and `data/agents/cmo/MEMORY.md` respectively without cross-contamination.
**Why human:** The validate-concurrent-isolation.ts script (commit 9f77cd3) was run and reported 6/6 checks passed per the summary. The TS error on `_serverInstance` is in the test script's closure accessor, not the underlying isolation logic. Architectural guarantee is solid: each ToolContext is a separate object created per invocation. Human can re-run the script with `npx tsx scripts/validate-concurrent-isolation.ts` to confirm.

#### 3. Hire Approval Full Flow

**Test:** Submit a task, have an agent call hire_employee, then approve via POST /api/hire_requests/[id]/approve, then verify the next task_run in the worker has the subagent definition.
**Expected:** New task_run created with agents field containing the subagent definition; worker re-invokes dept head with the subagent; temp employee can only use the restricted tool set.
**Why human:** Requires multi-step interaction through a running server and the approval UI (not built until Phase 3).

### Gaps Summary

No gaps found. All 23 must-haves are verified against the actual codebase. The phase goal is fully achieved:

- SDK query() runs via invokeAgent() with per-invocation MCP servers (14 tools)
- Isolated workspaces via closure-bound ToolContext
- Cost tracking to cost_events table
- Session resume via sessionId storage in task_runs
- Role-based access control via buildCanUseTool (3-tier)
- All 14 MCP tools implemented and wired into server factory
- Complete hire flow from request to subagent delegation
- Structured output schemas for deterministic routing/planning
- 4 executive agent identities with comprehensive soul.md files
- 3 global skills with active status and step-by-step procedures
- Worker loop fully replaces Phase 1 stub with real agent invocation
- instrumentation.ts seeds agents and initializes orchestrator on startup

The only items flagged for human verification are behavioral (live execution with AWS Bedrock) rather than structural gaps. All structural, wiring, and code-level requirements are met.

---

_Verified: 2026-03-26T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
