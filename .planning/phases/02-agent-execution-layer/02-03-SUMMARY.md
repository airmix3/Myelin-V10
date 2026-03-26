---
phase: 02-agent-execution-layer
plan: 03
subsystem: agent-execution
tags: [claude-agent-sdk, mcp, orchestrator, worker, invoke-agent, concurrent-isolation]

# Dependency graph
requires:
  - phase: 02-01
    provides: "MCP server factory (buildMyelinMcpServer), ToolContext, access control (buildCanUseTool)"
  - phase: 02-02
    provides: "Agent configs (AgentConfig, agentConfig exports), seedAgents()"
provides:
  - "invokeAgent() wrapper around Claude Agent SDK query() with per-invocation MCP, streaming, cost tracking, session resume"
  - "AgentOrchestrator singleton with agent registry and invoke() dispatch"
  - "Real worker executeRun() replacing Phase 1 stub"
  - "Validated concurrent MCP isolation (D-02)"
affects: [02-05, 02-06, 03-ui-tamir]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "invokeAgent() creates fresh per-invocation MCP server with closure-bound ToolContext"
    - "Orchestrator singleton via globalThis pattern for HMR safety"
    - "Worker deserializes agents JSON from task_run for subagent support"
    - "Cost events logged to cost_events table from SDK result"
    - "Session ID stored in task_runs for agent resume"

key-files:
  created:
    - src/lib/invoke-agent.ts
    - src/lib/orchestrator.ts
    - scripts/validate-concurrent-isolation.ts
  modified:
    - src/lib/worker.ts
    - src/instrumentation.ts
    - src/agents/tamir/agent.ts
    - src/agents/cto/agent.ts
    - src/agents/cmo/agent.ts
    - src/agents/coo/agent.ts

key-decisions:
  - "invokeAgent uses preset: 'claude_code' with soul.md appended as systemPrompt"
  - "permissionMode: 'bypassPermissions' with allowDangerouslySkipPermissions for headless execution"
  - "Cost tracking via INSERT INTO cost_events from SDK result metrics"
  - "Worker transitions task state from submitted to working before invocation"

patterns-established:
  - "invokeAgent() wrapper: all SDK calls go through this single entry point"
  - "Orchestrator registry: agents register at startup, invoke() dispatches by agentId"
  - "Per-invocation MCP isolation: each call gets its own server + ToolContext closure"

requirements-completed: [AGENT-01, AGENT-02, AGENT-04]

# Metrics
duration: 8min
completed: 2026-03-26
---

# Phase 02 Plan 03: Agent Execution Pipeline Summary

**invokeAgent() wrapper around Claude Agent SDK with per-invocation MCP server, orchestrator singleton, real worker execution replacing Phase 1 stub, and validated concurrent isolation (D-02)**

## Performance

- **Duration:** ~8 min (across checkpoint)
- **Started:** 2026-03-26
- **Completed:** 2026-03-26
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- invokeAgent() wraps SDK query() with per-invocation MCP server, closure-bound ToolContext, SSE streaming, cost tracking, and session resume
- AgentOrchestrator singleton manages all 4 agent configs and dispatches invocations
- Worker executeRun() fully replaced -- claims run, transitions state, invokes agent, tracks cost, handles failures
- instrumentation.ts seeds agents and initializes orchestrator on startup
- Concurrent MCP isolation validated (D-02): 6/6 checks passed confirming two parallel invocations do not interfere

## Task Commits

Each task was committed atomically:

1. **Task 1: invokeAgent() wrapper and orchestrator singleton** - `f7ef093` (feat)
2. **Task 2: Replace worker executeRun() stub and update instrumentation.ts** - `cd0282a` (feat)
3. **Task 3: Validate concurrent MCP isolation (D-02)** - `9f77cd3` (test)

## Files Created/Modified
- `src/lib/invoke-agent.ts` - Core wrapper around SDK query() with MCP server, streaming, cost logging, session resume
- `src/lib/orchestrator.ts` - Agent registry singleton with invoke() dispatch method
- `src/lib/worker.ts` - Real executeRun() replacing Phase 1 stub, calls orchestrator.invoke()
- `src/instrumentation.ts` - Added seedAgents() and initOrchestrator() to bootstrap
- `src/agents/tamir/agent.ts` - Added avatarColor export to AgentConfig
- `src/agents/cto/agent.ts` - Added avatarColor export to AgentConfig
- `src/agents/cmo/agent.ts` - Added avatarColor export to AgentConfig
- `src/agents/coo/agent.ts` - Added avatarColor export to AgentConfig
- `scripts/validate-concurrent-isolation.ts` - D-02 validation script for concurrent MCP isolation

## Decisions Made
- invokeAgent uses `preset: 'claude_code'` with soul.md appended as systemPrompt -- agents get Claude Code capabilities plus their identity
- `permissionMode: 'bypassPermissions'` with `allowDangerouslySkipPermissions: true` for headless agent execution without human-in-the-loop prompts
- Cost tracking via direct SQLite INSERT into cost_events from SDK result metrics (input/output tokens, cost USD, model)
- Worker transitions task state from `submitted` to `working` before agent invocation, and to `failed` on error

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full execution pipeline wired: worker -> orchestrator -> invokeAgent -> SDK query() -> agent in desk with MCP tools
- D-02 concurrent isolation validated -- Wave 3 plans can proceed safely
- Plans 02-05 and 02-06 can build on this pipeline for Tamir routing and task lifecycle

## Self-Check: PASSED

All 5 key files verified present. All 3 task commits verified in git history.

---
*Phase: 02-agent-execution-layer*
*Completed: 2026-03-26*
