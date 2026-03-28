---
phase: quick
plan: 260328-lt5
subsystem: workspace
tags: [skills, symlinks, gallery, seeding]

requires:
  - phase: quick-260328-kp5
    provides: "cos directory restructure, Tamir flat desk"
provides:
  - "Canonical global skills directory at data/departments/global/skills/"
  - "Separated global vs cos skill symlink logic in workspace.ts"
  - "Multi-source gallery seeding (global, cos, dept, external)"
affects: [workspace, seed-gallery, agent-skills]

tech-stack:
  added: []
  patterns:
    - "Global skills in data/departments/global/skills/, cos-specific in cos/skills/"
    - "seedSkillsFromDir helper for multi-source skill seeding"

key-files:
  created:
    - "data/departments/global/skills/memory-management/SKILL.md"
    - "data/departments/global/skills/system-reset/SKILL.md"
    - "data/departments/global/skills/skill-extractor/SKILL.md"
  modified:
    - "src/lib/workspace.ts"
    - "src/lib/seed-gallery.ts"

key-decisions:
  - "global/ directory contains ONLY skills/ subdirectory (not a real department)"
  - "External installed skills seeded with department='external' (was 'cos')"

patterns-established:
  - "Global skills separated from Tamir-specific skills for proper symlink scoping"
  - "seedSkillsFromDir reusable helper for seeding skills from any directory"

requirements-completed: []

duration: 2min
completed: 2026-03-28
---

# Quick 260328-lt5: Restore Global Skills Directory Summary

**Separated global skills (memory-management, system-reset, skill-extractor) from cos/ into dedicated global/skills/ directory with scoped symlinks and multi-source gallery seeding**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T12:44:11Z
- **Completed:** 2026-03-28T12:46:23Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Moved 3 global skills to data/departments/global/skills/, leaving only installer in cos/skills/
- Updated all symlink logic: global skills go to ALL desks/workspaces, cos skills only to Tamir's desk
- Refactored gallery seeding to read from global, cos, department-specific, and external skill sources

## Task Commits

Each task was committed atomically:

1. **Task 1: Move global skills to data/departments/global/skills/** - `c6ef4a6` (refactor)
2. **Task 2: Update workspace.ts symlink logic** - `7ba4b94` (feat)
3. **Task 3: Update seed-gallery.ts for multi-source seeding** - `10d00d2` (feat)

## Files Created/Modified
- `data/departments/global/skills/memory-management/SKILL.md` - Global skill (moved from cos)
- `data/departments/global/skills/system-reset/SKILL.md` - Global skill (moved from cos)
- `data/departments/global/skills/skill-extractor/SKILL.md` - Global skill (moved from cos)
- `src/lib/workspace.ts` - Updated symlink logic for global vs cos separation
- `src/lib/seed-gallery.ts` - Multi-source skill seeding with seedSkillsFromDir helper

## Decisions Made
- global/ directory contains ONLY skills/ (removed stale .gitkeep, manager-desk, planning-desk from git)
- External installed skills (from project root skills/) seeded with department='external' instead of 'cos'

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed stale global/ artifacts from git**
- **Found during:** Task 1
- **Issue:** global/ had tracked .gitkeep, manager-desk/, planning-desk/ from before the kp5 restructure
- **Fix:** git rm'd stale files so global/ only contains skills/
- **Committed in:** c6ef4a6

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary cleanup for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None

---
*Quick task: 260328-lt5*
*Completed: 2026-03-28*
