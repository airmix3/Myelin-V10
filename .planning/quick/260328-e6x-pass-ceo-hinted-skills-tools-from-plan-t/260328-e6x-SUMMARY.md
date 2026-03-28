---
phase: quick
plan: 260328-e6x
subsystem: workspace
tags: [workspace, claude-md, mcp-tools, ceo-hints, install-tool, install-skill]

requires:
  - phase: quick-260328-cyc
    provides: install_tool and install_skill MCP tools
provides:
  - CEO tool/skill selections written as actionable install commands in workspace CLAUDE.md
affects: [agent-execution, workspace-setup]

tech-stack:
  added: []
  patterns:
    - "CeoHints interface for passing tool/skill selections through workspace creation"
    - "Dual-location hints: PLAN.md for reference, CLAUDE.md for actionable install commands"

key-files:
  created: []
  modified:
    - src/lib/workspace.ts
    - src/app/api/tasks/[taskId]/approve/route.ts

key-decisions:
  - "Hints section placed between MCP tools list and workspace boundary notice in CLAUDE.md for maximum visibility"
  - "Backward compatible: no hints = no section, identical to previous behavior"

patterns-established:
  - "CeoHints flow: config -> approve route -> createTaskWorkspace -> CLAUDE.md install directives"

requirements-completed: [QUICK-e6x]

duration: 1min
completed: 2026-03-28
---

# Quick 260328-e6x: Pass CEO-Hinted Skills/Tools Summary

**CEO tool/skill selections now written as explicit install_tool/install_skill MCP commands in workspace CLAUDE.md**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-28T06:55:31Z
- **Completed:** 2026-03-28T06:56:36Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added CeoHints interface and parameter to createTaskWorkspace for passing CEO tool/skill selections
- Workspace CLAUDE.md now contains a prominent "CEO-Selected Tools & Skills" section with explicit install_tool/install_skill MCP tool invocation instructions
- Approve route extracts hints from task config and passes them through to workspace creation
- Backward compatible: when no hints are provided, CLAUDE.md output is identical to previous behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Add config parameter to createTaskWorkspace and write tool/skill directives into CLAUDE.md** - `ea73626` (feat)
2. **Task 2: Pass config to createTaskWorkspace in the approve route** - `9a3c18b` (feat)

## Files Created/Modified
- `src/lib/workspace.ts` - Added CeoHints interface, optional ceoHints parameter, and conditional hints section in CLAUDE.md template
- `src/app/api/tasks/[taskId]/approve/route.ts` - Extracts ceoHints from task config and passes as 5th argument to createTaskWorkspace

## Decisions Made
- Hints section placed between MCP tools list and workspace boundary notice for maximum agent visibility
- Both PLAN.md (existing hint reference) and CLAUDE.md (new actionable commands) contain the hints -- dual location ensures agents see install commands immediately

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workspace CLAUDE.md now drives tool/skill installation before task execution
- Agents will see install commands as part of their system prompt

---
*Plan: quick/260328-e6x*
*Completed: 2026-03-28*
