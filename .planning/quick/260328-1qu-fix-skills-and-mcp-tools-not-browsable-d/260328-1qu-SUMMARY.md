---
phase: quick
plan: 260328-1qu
subsystem: ui, database
tags: [prisma, seeding, mcp, skills, gallery]

requires:
  - phase: 03-cortex-ui
    provides: GalleryPanel, ConfigPanel, CanvasPanel components and search APIs
provides:
  - Seeded mcp_servers and skills tables for gallery browsing
  - Expanded config+gallery section height for usability
affects: [planning-ui, task-config]

tech-stack:
  added: []
  patterns:
    - "Idempotent gallery seeding on server startup (seed-gallery.ts)"

key-files:
  created:
    - src/lib/seed-gallery.ts
  modified:
    - src/instrumentation.ts
    - src/components/CanvasPanel.tsx

key-decisions:
  - "Single MCP server entry with toolCount=14 covering all 8 tool modules"
  - "Skills seeded from on-disk skills/ directory with gray-matter frontmatter parsing"

patterns-established:
  - "Gallery seed pattern: read skills/ directory, parse SKILL.md frontmatter, upsert to DB"

requirements-completed: [QUICK-1qu]

duration: 1min
completed: 2026-03-28
---

# Quick 260328-1qu: Fix Skills and MCP Tools Not Browsable Summary

**Idempotent gallery seeding of MCP servers and skills tables with expanded config panel height for browsability**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-27T22:21:02Z
- **Completed:** 2026-03-27T22:21:54Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created seed-gallery.ts that populates mcp_servers with Myelin internal MCP server entry
- Skills seeded from on-disk skills/ directory (agent-browser) with frontmatter parsing
- Config+gallery section expanded from 220px to 400px for browsable gallery cards

## Task Commits

Each task was committed atomically:

1. **Task 1: Create gallery seed script and hook into startup** - `3146a49` (feat)
2. **Task 2: Expand config+gallery section height in CanvasPanel** - `73f739e` (feat)

## Files Created/Modified
- `src/lib/seed-gallery.ts` - Idempotent seeding of mcp_servers and skills tables
- `src/instrumentation.ts` - Added seedGallery() call between agent seeding and orchestrator init
- `src/components/CanvasPanel.tsx` - Increased config+gallery maxHeight from 220px to 400px

## Decisions Made
- Single MCP server record with toolCount=14 (aggregate of 8 tool modules) rather than per-tool entries
- Skills parsed from SKILL.md frontmatter using gray-matter, matching existing vault document pattern
- Upsert logic: create if missing, update metadata if exists (future-proof for skill changes)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Steps
- After server restart, gallery should show MCP tools and skills during planning
- Additional skills added to skills/ directory will be auto-seeded on next startup

---
*Plan: quick/260328-1qu*
*Completed: 2026-03-28*
