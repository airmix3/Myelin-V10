---
phase: quick-260328-kp5
plan: 01
subsystem: agents
tags: [departments, tamir, cos, install-flow, access-control, filesystem-boundary]

requires:
  - phase: quick-260328-cyc
    provides: install_tool and install_skill MCP tools with dept head approval
provides:
  - "Department 'cos' replacing 'global' as Tamir's department"
  - "Tamir flat desk at data/departments/cos/ (no planning-desk/manager-desk subdirs)"
  - "Tamir data/ root filesystem boundary in access-control"
  - "3-step install flow: dept head approves -> Tamir installs via invokeAgent -> hot-reload on original agent"
affects: [workspace, access-control, install-flow, agent-invocation]

tech-stack:
  added: []
  patterns:
    - "Tamir flat desk: cos/ directory serves as both planning and manager desk"
    - "Tamir data/ boundary: isTamir check expands filesystem boundary to data/ root"
    - "Install via agent: invokeAgent(tamir) replaces direct execSync for npx commands"

key-files:
  created: []
  modified:
    - src/lib/workspace.ts
    - src/lib/mcp/access-control.ts
    - src/lib/mcp/tools/install.ts
    - src/lib/seed-agents.ts
    - src/lib/seed-gallery.ts
    - src/agents/tamir/card.json
    - src/instrumentation.ts
    - src/app/api/tamir/route/route.ts
    - src/app/api/tasks/[taskId]/message/route.ts
    - src/app/api/hire_requests/[id]/approve/route.ts

key-decisions:
  - "Tamir flat desk: cos/ directory itself is the desk, no subdirectories for planning or manager"
  - "Tamir boundary expansion uses effectiveBoundaries pattern to swap deskDir for data/ root"
  - "Install flow delegates to Tamir via invokeAgent with claude_code preset tools"

requirements-completed: [RENAME-GLOBAL-COS, TAMIR-DATA-BOUNDARY, INSTALL-FLOW-TAMIR, TAMIR-FLAT-COS]

duration: 4min
completed: 2026-03-28
---

# Quick 260328-kp5: Restructure Install Flow Summary

**Renamed 'global' department to 'cos', flattened Tamir's desk, expanded Tamir's filesystem boundary to data/ root, and rerouted installations through Tamir via invokeAgent**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T12:02:53Z
- **Completed:** 2026-03-28T12:06:53Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- All 'global' department references renamed to 'cos' across codebase and database
- Tamir lives flat in data/departments/cos/ (no planning-desk/ or manager-desk/ subdirs for Tamir)
- Tamir gets full data/ filesystem boundary via access-control expansion
- Install flow now: dept head approves -> Tamir installs via invokeAgent -> hot-reload on original agent
- DB records migrated from global to cos (employees, skills, documents)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename global to cos everywhere and flatten Tamir's desk** - `9e21d5d` (feat)
2. **Task 2: Tamir data/ boundary + install flow with Tamir as installer** - `b61c103` (feat)

## Files Created/Modified
- `src/lib/workspace.ts` - DEPARTMENTS 'global'->'cos', flat cos/ desk in ensurePlanningDesks/ensureManagerDesks
- `src/lib/mcp/access-control.ts` - Tamir gets data/ root as effectiveBoundaries
- `src/lib/mcp/tools/install.ts` - Tamir invocation for tool/skill install, cos mapping, flat desk paths
- `src/lib/seed-agents.ts` - Tamir department 'global'->'cos'
- `src/lib/seed-gallery.ts` - Skills seeding department 'global'->'cos'
- `src/agents/tamir/card.json` - Department 'global'->'cos'
- `src/instrumentation.ts` - Vault document seeding department 'global'->'cos'
- `src/app/api/tamir/route/route.ts` - Tamir desk path uses cos/ directly
- `src/app/api/tasks/[taskId]/message/route.ts` - Tamir planning uses cos/ flat desk
- `src/app/api/hire_requests/[id]/approve/route.ts` - Fallback department 'global'->'cos'

## Decisions Made
- Tamir flat desk: cos/ directory itself serves as planning and manager desk (no subdirs)
- effectiveBoundaries pattern in access-control: swaps deskDir for data/ root when isTamir
- Install flow uses invokeAgent with claude_code preset tools for Tamir to run npx commands
- Removed execSync import from install.ts (no longer needed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated hire_requests fallback department**
- **Found during:** Task 1 (global -> cos rename)
- **Issue:** hire_requests/[id]/approve/route.ts had `department: task?.department ?? 'global'` fallback
- **Fix:** Changed to `'cos'` to match renamed department
- **Files modified:** src/app/api/hire_requests/[id]/approve/route.ts
- **Verification:** grep confirms no remaining 'global' references
- **Committed in:** 9e21d5d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential fix to maintain consistency. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all functionality is fully wired.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Install flow restructured and ready for use
- Tamir can now install tools/skills to any department via data/ boundary
- Hot-reload on original agent still works via query registry

---
*Phase: quick-260328-kp5*
*Completed: 2026-03-28*
