---
phase: quick
plan: 260328-b2e
subsystem: sandbox
tags: [access-control, planning, read-only, filesystem-boundary]

requires:
  - phase: 06-sandboxing-agents
    provides: buildCanUseTool filesystem boundary enforcement
provides:
  - projectRoot read-only boundary for planning agents (Read/Glob/Grep)
  - threaded projectRoot through invoke-agent, orchestrator, message route
affects: [planning, sandbox, access-control]

tech-stack:
  added: []
  patterns:
    - "Read-only vs write boundary split in canUseTool (isReadPathAllowed vs isPathAllowed)"
    - "projectRoot only passed for planning invocations, not worker execution"

key-files:
  created: []
  modified:
    - src/lib/mcp/access-control.ts
    - src/lib/invoke-agent.ts
    - src/lib/orchestrator.ts
    - src/app/api/tasks/[taskId]/message/route.ts

key-decisions:
  - "Split read/write path checks: isReadPathAllowed for Read/Glob/Grep, isPathAllowed for Write/Edit/Bash"
  - "projectRoot only threaded through planning path (message/route.ts), not worker path"

patterns-established:
  - "Read-only boundary pattern: read tools check projectRoot, write tools do not"

requirements-completed: []

duration: 2min
completed: 2026-03-28
---

# Quick 260328-b2e: Fix Planning Agents Not Having Proper Tool Access Summary

**Read-only projectRoot boundary allowing planning agents to Read/Glob/Grep project source while keeping Write/Edit/Bash restricted to workspace**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T05:02:19Z
- **Completed:** 2026-03-28T05:04:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added isReadPathAllowed() that accepts optional projectRoot for read-only boundary checking
- Split Read/Glob/Grep (read-only, allows projectRoot) from Write/Edit/Bash (strict workspace-only)
- Threaded projectRoot through invoke-agent and orchestrator to access control
- Planning route passes process.cwd() as projectRoot; worker execution path unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Add projectRoot read-only boundary to access control** - `21a3503` (feat)
2. **Task 2: Thread projectRoot through invoke-agent, orchestrator, and message route** - `47e7eff` (feat)

## Files Created/Modified
- `src/lib/mcp/access-control.ts` - Added isReadPathAllowed(), split read/write tool checks, accept projectRoot in buildCanUseTool
- `src/lib/invoke-agent.ts` - Added projectRoot to InvokeAgentOptions, pass to buildCanUseTool
- `src/lib/orchestrator.ts` - Added projectRoot to invoke() opts type
- `src/app/api/tasks/[taskId]/message/route.ts` - Pass resolve(process.cwd()) as projectRoot for planning calls

## Decisions Made
- Split read/write path checks into separate functions rather than a single generic check -- clearer intent and prevents accidental write access to projectRoot
- Only planning invocations (message/route.ts) get projectRoot; worker execution (worker.ts) remains strictly sandboxed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

---
*Plan: quick/260328-b2e*
*Completed: 2026-03-28*
