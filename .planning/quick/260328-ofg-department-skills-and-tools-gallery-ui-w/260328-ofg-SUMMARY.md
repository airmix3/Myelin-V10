---
phase: quick-260328-ofg
plan: 01
subsystem: ui, api
tags: [gallery, skills, tools, refresh, remove, tamir, mcp]

requires:
  - phase: quick-260328-kp5
    provides: Tamir as installer with cos flat desk structure
  - phase: quick-260328-l84
    provides: Installer skill pattern for CoS skills
provides:
  - Tabbed skills/tools gallery UI in org-context page
  - Refresh and remove API routes for department skills and tools
  - CoS skill-tool-manager skill for managed refresh/removal via Tamir
affects: [org-context, skills-management, tools-management]

tech-stack:
  added: []
  patterns: [Tamir delegation for skill/tool management actions]

key-files:
  created:
    - data/departments/cos/skills/skill-tool-manager/SKILL.md
    - src/app/api/org-context/[dept]/skills/[skillId]/refresh/route.ts
    - src/app/api/org-context/[dept]/skills/[skillId]/remove/route.ts
    - src/app/api/org-context/[dept]/tools/[toolName]/refresh/route.ts
    - src/app/api/org-context/[dept]/tools/[toolName]/remove/route.ts
  modified:
    - src/app/api/org-context/[dept]/route.ts
    - src/app/org-context/page.tsx

key-decisions:
  - "Refresh/remove actions delegate to Tamir via invokeAgent rather than direct file manipulation in API routes"
  - "Synthetic taskId (sys-manage-*) used for system management invocations since no real task exists"

patterns-established:
  - "System management pattern: API routes create synthetic taskId for Tamir invocations without real tasks"

requirements-completed: []

duration: 3min
completed: 2026-03-28
---

# Quick Task 260328-ofg: Department Skills and Tools Gallery UI Summary

**Tabbed gallery with refresh/remove actions delegating to Tamir's skill-tool-manager skill for managed lifecycle**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T14:38:46Z
- **Completed:** 2026-03-28T14:41:40Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created CoS skill-tool-manager skill with refresh and remove procedures for both skills and tools
- Added tools scanning to org-context API (reads from data/departments/{dept}/tools/ directories)
- Built 4 API routes (skill refresh/remove, tool refresh/remove) all delegating to Tamir
- Replaced flat gallery with tabbed Skills/Tools UI with VSCode-extension-style cards and action icons

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CoS skill-tool-manager skill + API routes** - `82dbfb7` (feat)
2. **Task 2: Update org-context gallery UI with tabs and actions** - `2be13d4` (feat)

## Files Created/Modified
- `data/departments/cos/skills/skill-tool-manager/SKILL.md` - Skill defining refresh/remove procedures for Tamir
- `src/app/api/org-context/[dept]/route.ts` - Added tools directory scanning to department data response
- `src/app/api/org-context/[dept]/skills/[skillId]/refresh/route.ts` - POST endpoint to refresh a skill via Tamir
- `src/app/api/org-context/[dept]/skills/[skillId]/remove/route.ts` - POST endpoint to remove a skill via Tamir + DB cleanup
- `src/app/api/org-context/[dept]/tools/[toolName]/refresh/route.ts` - POST endpoint to refresh a tool via Tamir
- `src/app/api/org-context/[dept]/tools/[toolName]/remove/route.ts` - POST endpoint to remove a tool via Tamir
- `src/app/org-context/page.tsx` - Tabbed gallery UI with refresh/remove icon buttons per card

## Decisions Made
- Refresh/remove actions delegate to Tamir via invokeAgent rather than direct file ops in routes (consistent with install pattern)
- Synthetic taskId (`sys-manage-${Date.now()}`) used for management invocations since no real task exists (cost tracking try/catch handles gracefully)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data sources are wired (skills from DB, tools from disk scan).

---
*Quick task: 260328-ofg*
*Completed: 2026-03-28*
