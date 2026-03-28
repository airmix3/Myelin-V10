---
phase: quick
plan: 260328-cjp
subsystem: worker
tags: [worker, state-machine, dashboard, sqlite]

requires:
  - phase: 01-foundation
    provides: worker loop and state machine
provides:
  - task state transition to completed after run finishes
  - startup recovery for stuck working tasks
affects: [dashboard, worker]

tech-stack:
  added: []
  patterns: [forward-fix plus backward-fix pattern for state consistency]

key-files:
  created: []
  modified: [src/lib/worker.ts]

key-decisions:
  - "Place transitionTask after deliverable update but before eventBus.emit for correct ordering"
  - "Stuck task recovery runs inside recoverStaleRuns on startup (single initialization path)"

requirements-completed: []

duration: 1min
completed: 2026-03-28
---

# Quick 260328-cjp: Fix Active Tasks Count Summary

**Worker now transitions parent task to completed after run finishes, with startup recovery for existing stuck tasks**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-28T06:24:15Z
- **Completed:** 2026-03-28T06:24:51Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added transitionTask call in executeRun success path so parent task moves to completed
- Added startup recovery in recoverStaleRuns to fix existing tasks stuck in working state with all runs completed
- Dashboard Active Tasks count will now correctly exclude completed tasks

## Task Commits

Each task was committed atomically:

1. **Task 1: Add transitionTask call after successful run completion and fix stuck tasks** - `5e78774` (fix)

## Files Created/Modified
- `src/lib/worker.ts` - Added transitionTask call on run success + startup recovery for stuck working tasks

## Decisions Made
- Place transitionTask after deliverable update but before eventBus.emit to ensure deliverable status is updated first
- Stuck task recovery added inside existing recoverStaleRuns function (runs once on startup) rather than a separate function

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fix is complete; will take effect on next server restart
- Existing stuck tasks will be auto-recovered on startup

---
*Phase: quick*
*Completed: 2026-03-28*
