---
phase: quick-260328-c6r
plan: 01
subsystem: ui
tags: [vault, prisma, fts5, sqlite, filtering]

requires:
  - phase: 03-ui-tamir
    provides: Vault page with FTS5 search
provides:
  - Vault browse filtered to vault+knowledge sources only
  - FTS5 search filtered to vault+knowledge sources only
affects: [vault, documents]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/app/vault/page.tsx
    - src/lib/fts.ts

key-decisions:
  - "Keep VaultClient.tsx sourceBadgeClass for 'deliverable' as defensive code"

patterns-established: []

requirements-completed: []

duration: 1min
completed: 2026-03-28
---

# Quick Task 260328-c6r: Fix Deliverables Incorrectly Showing in Vault Summary

**Filtered Vault page Prisma query and FTS5 search to exclude deliverable-source documents, showing only vault+knowledge docs**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-28T05:49:06Z
- **Completed:** 2026-03-28T05:49:30Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Vault browse page now filters to source in ['vault', 'knowledge'] via Prisma where clause
- FTS5 searchDocuments query now includes AND d.source IN ('vault', 'knowledge') filter
- Deliverables (13 docs) no longer appear alongside vault/knowledge docs (3 docs)

## Task Commits

Each task was committed atomically:

1. **Task 1: Filter Vault Prisma query and FTS5 search to exclude deliverables** - `352e5d2` (fix)

## Files Created/Modified
- `src/app/vault/page.tsx` - Added where clause filtering to vault+knowledge sources
- `src/lib/fts.ts` - Added AND d.source IN clause to FTS5 search SQL

## Decisions Made
- Kept VaultClient.tsx sourceBadgeClass for 'deliverable' untouched as defensive code (costs nothing, protects against edge cases)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Vault correctly scoped to vault+knowledge documents
- If future work adds new document sources, vault/page.tsx and fts.ts filters may need updating

---
*Quick task: 260328-c6r*
*Completed: 2026-03-28*
