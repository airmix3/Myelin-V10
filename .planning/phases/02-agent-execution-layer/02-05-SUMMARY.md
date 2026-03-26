---
phase: 02-agent-execution-layer
plan: 05
subsystem: api
tags: [hire-flow, a2a, structured-output, json-schema, subagent, sdk]

requires:
  - phase: 02-agent-execution-layer/03
    provides: "invokeAgent, orchestrator, worker executeRun with agents field parsing"
  - phase: 02-agent-execution-layer/04
    provides: "MCP tools including hire_employee, submit_for_review"
provides:
  - "POST /api/hire_requests/[id]/approve -- creates temp employee, enqueues task_run with subagent"
  - "POST /api/hire_requests/[id]/reject -- resumes dept head without hire"
  - "ROUTING_SCHEMA -- JSON Schema for Tamir task routing structured output"
  - "AGENT_TURN_SCHEMA -- JSON Schema for planning turn classification structured output"
affects: [03-tamir-ui, 04-workspace-integration]

tech-stack:
  added: []
  patterns: ["Raw JSON Schema for SDK outputFormat (not zod)", "Task_run re-enqueue pattern for hire approval/rejection resume"]

key-files:
  created:
    - src/app/api/hire_requests/[id]/approve/route.ts
    - src/app/api/hire_requests/[id]/reject/route.ts
    - src/a2a/schemas.ts
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Next.js 14 params passed directly (not Promise) in route handlers"
  - "Subagent definition stored both in task metadata and task_run agents field"
  - "Raw JSON Schema objects for outputFormat per SDK requirements and research Pitfall 4"

patterns-established:
  - "Hire approval pattern: create employee, store subagent def, enqueue task_run, transition state"
  - "Task_run agents field: serialized JSON subagent definitions read by worker executeRun"

requirements-completed: [AGENT-06, AGENT-04]

duration: 3min
completed: 2026-03-26
---

# Phase 02 Plan 05: Hire Approval/Rejection and Structured Output Schemas Summary

**Hire approval/rejection API endpoints with task_run re-enqueue for subagent delegation, and raw JSON Schema structured output schemas for SDK outputFormat**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T09:35:21Z
- **Completed:** 2026-03-26T09:38:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Hire approval endpoint creates temp employee with restricted tool access, stores subagent definition, and enqueues new task_run so worker re-invokes dept head with the subagent
- Hire rejection endpoint resumes dept head execution with rejection context via new task_run
- ROUTING_SCHEMA and AGENT_TURN_SCHEMA defined as raw JSON Schema for SDK outputFormat (not zod)

## Task Commits

Each task was committed atomically:

1. **Task 1: Hire approval and rejection API endpoints with task_run re-enqueue** - `b623bf9` (feat)
2. **Task 2: Structured output JSON schemas for SDK outputFormat** - `db6e8c3` (feat)

## Files Created/Modified
- `src/app/api/hire_requests/[id]/approve/route.ts` - POST handler: creates temp employee, subagent def, task_run enqueue, state transition
- `src/app/api/hire_requests/[id]/reject/route.ts` - POST handler: rejection context, task_run enqueue, state transition
- `src/a2a/schemas.ts` - ROUTING_SCHEMA and AGENT_TURN_SCHEMA as raw JSON Schema objects
- `prisma/schema.prisma` - Added agents field to TaskRun model for subagent definition storage

## Decisions Made
- Used Next.js 14 direct params pattern (not Promise) for route handler params
- Stored subagent definition in both task metadata (for agent context) and task_run agents field (for worker to pass to orchestrator)
- Used raw JSON Schema objects for outputFormat per SDK requirements and research Pitfall 4 (not zod)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added agents field to TaskRun Prisma schema**
- **Found during:** Task 1 (Hire approval endpoint)
- **Issue:** The plan's interface section showed `agents String?` on TaskRun but the actual schema.prisma was missing this field. The worker already reads `run.agents` (added in Plan 03), but Prisma would not include it in queries without the schema field.
- **Fix:** Added `agents String?` to the TaskRun model in schema.prisma and regenerated Prisma client
- **Files modified:** prisma/schema.prisma
- **Verification:** `npx prisma generate` succeeded, TypeScript compiles cleanly
- **Committed in:** b623bf9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for correctness -- without the schema field, Prisma queries would not include agents data. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Hire flow complete: approval creates temp employee + subagent, rejection resumes dept head
- Structured output schemas ready for Phase 3 Tamir routing integration
- Worker loop already parses agents field from task_run (Plan 03) and passes to orchestrator

---
*Phase: 02-agent-execution-layer*
*Completed: 2026-03-26*
