---
phase: 03-cortex-ui-tamir-interface
plan: 04
subsystem: api
tags: [next.js-api-routes, tamir, a2a, structured-output, jsonl, task-lifecycle]

# Dependency graph
requires:
  - phase: 02-agent-execution-layer
    provides: orchestrator, invokeAgent, ROUTING_SCHEMA, AGENT_TURN_SCHEMA, transitionTask, createTaskWorkspace
  - phase: 03-cortex-ui-tamir-interface
    provides: CSS design system, layout, SSE endpoint (plan 01)
provides:
  - POST /api/tamir/route -- Tamir LLM routing endpoint with structured output
  - POST /api/tasks/[taskId]/message -- planning message endpoint with AGENT_TURN_SCHEMA
  - GET /api/tasks/[taskId] -- task state with derived lifecycle
  - GET /api/tasks/[taskId]/chat -- JSONL chat history loading
  - PUT /api/tasks/[taskId]/config -- TaskConfig storage in metadata
  - PUT /api/tasks/[taskId]/artifact -- plan markdown update
  - POST /api/tasks/[taskId]/approve -- workspace creation, deliverable + task_run enqueue
  - POST /api/tasks/[taskId]/cancel -- task cancellation via transitionTask
affects: [03-05, 03-06, 04-deliverable-workspace]

# Tech tracking
tech-stack:
  added: []
  patterns: [planning-desk-temp-workspace, jsonl-chat-persistence, metadata-json-config-storage, derived-lifecycle-from-state]

key-files:
  created:
    - src/app/api/tamir/route/route.ts
    - src/app/api/tasks/[taskId]/message/route.ts
    - src/app/api/tasks/[taskId]/route.ts
    - src/app/api/tasks/[taskId]/chat/route.ts
    - src/app/api/tasks/[taskId]/config/route.ts
    - src/app/api/tasks/[taskId]/artifact/route.ts
    - src/app/api/tasks/[taskId]/approve/route.ts
    - src/app/api/tasks/[taskId]/cancel/route.ts
  modified: []

key-decisions:
  - "Planning invocations use temp desk/delivDir/manifestPath since no execution workspace exists yet"
  - "TaskConfig stored inside task.metadata JSON (not a separate column) per Pitfall 8"
  - "Derived lifecycle function maps A2A state + metadata fields to UI lifecycle stages"
  - "CEO hints (selected tools/skills) injected into workspace CLAUDE.md on approval"

patterns-established:
  - "Planning desk pattern: orchestrator.invoke() with temporary delivDir for planning-only calls"
  - "Metadata JSON pattern: extensible task config stored as JSON string in metadata column"
  - "JSONL append pattern: appendFileSync for chat turns, readFileSync + split for loading"

requirements-completed: [TAMIR-02, TAMIR-03, TAMIR-08, TAMIR-05, TAMIR-06]

# Metrics
duration: 2min
completed: 2026-03-26
---

# Phase 03 Plan 04: Tamir Backend API Routes Summary

**8 API route files covering Tamir routing, planning messages, task CRUD, config, approval with workspace creation, and chat JSONL persistence**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T12:19:33Z
- **Completed:** 2026-03-26T12:21:50Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Tamir routing endpoint creates tasks via LLM structured output and returns routing buttons for dept head selection
- Planning message endpoint invokes agents with AGENT_TURN_SCHEMA and persists multi-turn chat to JSONL
- Approval endpoint creates execution workspace, deliverable record, task_run queue entry, and injects CEO tool/skill hints
- Full task lifecycle API: GET state with derived lifecycle, chat history, config, artifact update, cancellation

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Tamir routing and planning message API endpoints** - `f473ff5` (feat)
2. **Task 2: Build supporting task API endpoints** - `7937595` (feat)

## Files Created/Modified
- `src/app/api/tamir/route/route.ts` - Tamir LLM routing with ROUTING_SCHEMA structured output
- `src/app/api/tasks/[taskId]/message/route.ts` - Planning message with AGENT_TURN_SCHEMA, JSONL persistence
- `src/app/api/tasks/[taskId]/route.ts` - GET task state with derived lifecycle
- `src/app/api/tasks/[taskId]/chat/route.ts` - GET chat history from JSONL file
- `src/app/api/tasks/[taskId]/config/route.ts` - PUT TaskConfig into metadata JSON
- `src/app/api/tasks/[taskId]/artifact/route.ts` - PUT plan markdown update
- `src/app/api/tasks/[taskId]/approve/route.ts` - POST approval with workspace + deliverable + task_run
- `src/app/api/tasks/[taskId]/cancel/route.ts` - POST cancellation via transitionTask

## Decisions Made
- Planning invocations use temporary desk/delivDir/manifestPath since no execution workspace exists during planning phase
- TaskConfig stored inside task.metadata JSON string (not a separate column) per research Pitfall 8
- Derived lifecycle function maps A2A states + metadata timestamps to UI-friendly lifecycle stages (submitted, planning, plan_ready, executing, completed, etc.)
- CEO hints (selected tools/skills with per-tool hint text) injected into workspace CLAUDE.md on plan approval

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 8 Tamir backend API routes ready for frontend consumption (Plans 05-06)
- Routing flow: POST /api/tamir/route -> POST /api/tasks/[taskId]/message -> POST /api/tasks/[taskId]/approve
- Chat history and config endpoints ready for Tamir page UI integration

## Self-Check: PASSED

All 8 route files verified on disk. Both commits (f473ff5, 7937595) found in git log.

---
*Phase: 03-cortex-ui-tamir-interface*
*Completed: 2026-03-26*
