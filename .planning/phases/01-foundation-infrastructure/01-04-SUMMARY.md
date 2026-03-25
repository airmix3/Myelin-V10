---
phase: 01-foundation-infrastructure
plan: 04
subsystem: infra
tags: [worker-loop, polling, heartbeat, instrumentation, bootstrap, fts5, sqlite]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure/01
    provides: "db.ts (sqlite), id.ts (generateId), logger.ts (pino)"
  - phase: 01-foundation-infrastructure/02
    provides: "fts.ts (initFTS5), events.ts (eventBus), state-machine.ts (transitionTask)"
  - phase: 01-foundation-infrastructure/03
    provides: "workspace.ts (ensurePlanningDesks, createTaskWorkspace)"
provides:
  - "Worker loop with 2s polling, optimistic lock claiming, 3-concurrent cap, 15s heartbeat, stale recovery"
  - "instrumentation.ts bootstrap: FTS5 init, planning desks, DNA copy, worker start"
  - "startWorkerLoop() and recoverStaleRuns() exports"
  - "register() export for Next.js instrumentation hook"
affects: [phase-02-agent-execution]

# Tech tracking
tech-stack:
  added: [gray-matter]
  patterns: [worker-loop-polling, optimistic-lock-claiming, singleton-bootstrap, first-boot-copy]

key-files:
  created:
    - src/lib/worker.ts
    - src/instrumentation.ts
  modified: []

key-decisions:
  - "Parameterized SQL for stale threshold instead of string interpolation in datetime()"
  - "executeRun is a Phase 1 stub -- marks completed immediately, Phase 2 replaces with invokeAgent()"

patterns-established:
  - "Worker poll pattern: fixed interval setInterval with async poll() and fire-and-forget executeRun"
  - "Instrumentation singleton: globalThis.__myelinInit flag with NEXT_RUNTIME guard"
  - "First-boot pattern: check file existence before copy, index in DB after copy"

requirements-completed: [FOUND-06, FOUND-07]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 01 Plan 04: Worker Loop and Instrumentation Bootstrap Summary

**Worker loop with 2s polling, optimistic-lock claiming, 3-concurrent cap, heartbeat, stale recovery, and instrumentation.ts tying all Phase 1 modules together on server startup**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-25T22:42:34Z
- **Completed:** 2026-03-25T22:44:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Worker loop polls every 2s with optimistic lock claiming (UPDATE WHERE status='queued'), max 3 concurrent runs, 15s heartbeat, and stale recovery (>120s heartbeat timeout + startup crash recovery)
- instrumentation.ts bootstrap initializes FTS5, ensures planning desks, copies + indexes company DNA on first boot, and starts worker loop -- all behind NEXT_RUNTIME=nodejs guard with HMR singleton

## Task Commits

Each task was committed atomically:

1. **Task 1: Worker loop with polling, claiming, heartbeat, and stale recovery** - `235777f` (feat)
2. **Task 2: instrumentation.ts bootstrap with singleton guard and first-boot DNA copy** - `7f07e82` (feat)

## Files Created/Modified
- `src/lib/worker.ts` - Worker loop: polling, optimistic lock claiming, concurrency cap, heartbeat, stale run recovery
- `src/instrumentation.ts` - Next.js bootstrap hook: FTS5 init, planning desks, DNA copy, worker start

## Decisions Made
- Used parameterized SQL binding for STALE_THRESHOLD_S in datetime() instead of template literal interpolation (safer, avoids SQL injection patterns)
- executeRun is intentionally a Phase 1 stub that marks runs as completed immediately -- Phase 2 replaces with actual invokeAgent() SDK calls

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SQL injection in heartbeat stale check**
- **Found during:** Task 1 (Worker loop implementation)
- **Issue:** Plan's code used template literal interpolation (`-${STALE_THRESHOLD_S} seconds`) inside SQL string, which works but is a bad practice pattern
- **Fix:** Changed to parameterized binding with `'-' || ? || ' seconds'` to use proper SQLite parameter binding
- **Files modified:** src/lib/worker.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 235777f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor SQL safety improvement. No scope creep.

## Known Stubs

- `src/lib/worker.ts` line ~141: `executeRun()` is a Phase 1 stub that immediately marks runs as completed. Phase 2 replaces with `invokeAgent()` SDK call. This is intentional and documented in the plan.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 1 foundation modules are complete: db, id, logger, fts, events, state-machine, workspace, worker, instrumentation
- Phase 2 (Agent Execution) can build on this foundation -- invokeAgent() replaces the executeRun() stub
- Worker loop is ready to process real task_runs once Phase 2 provides the SDK integration

## Self-Check: PASSED

All files and commits verified:
- src/lib/worker.ts: FOUND
- src/instrumentation.ts: FOUND
- Commit 235777f: FOUND
- Commit 7f07e82: FOUND

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-03-25*
