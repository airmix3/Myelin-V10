---
phase: 07-assets-managment-system
plan: 01
subsystem: database, api
tags: [prisma, sqlite, fts5, rest-api, assets]

requires:
  - phase: 01-foundation-infrastructure
    provides: Prisma schema, FTS5 pattern, instrumentation.ts, generateId, db.ts
provides:
  - Asset, AssetEvent, AssetLocation, AssetDependency Prisma models
  - FTS5 search index for assets (title, description, category)
  - Full CRUD REST API for assets and sub-resources
  - Recursive CTE dependency ripple calculation
  - Sidebar navigation entry for Assets
affects: [07-02, 07-03, 07-04, 07-05]

tech-stack:
  added: []
  patterns:
    - "Raw SQL for asset tables (Prisma db push incompatible with FTS5 virtual tables)"
    - "AssetDependency uses raw sqlite (no Prisma relation) for recursive CTE queries"
    - "JSON string columns for annotations and returnFactors arrays"

key-files:
  created:
    - src/lib/asset-fts.ts
    - src/app/api/assets/route.ts
    - src/app/api/assets/[assetId]/route.ts
    - src/app/api/assets/[assetId]/events/route.ts
    - src/app/api/assets/[assetId]/annotations/route.ts
    - src/app/api/assets/[assetId]/locations/route.ts
    - src/app/api/assets/[assetId]/dependencies/route.ts
  modified:
    - prisma/schema.prisma
    - src/instrumentation.ts
    - src/components/Sidebar.tsx

key-decisions:
  - "Raw SQL table creation instead of Prisma migrate (drift from FTS5 virtual tables blocks migrate)"
  - "AssetDependency queries via raw sqlite for recursive CTE ripple calculation"

patterns-established:
  - "Asset sub-resource API pattern: /api/assets/[assetId]/{resource}"
  - "Event logging on all mutations: every state change creates an AssetEvent"

requirements-completed: [ASSET-01, ASSET-02, ASSET-03, ASSET-04, ASSET-05, ASSET-06, ASSET-07]

duration: 3min
completed: 2026-03-30
---

# Phase 07 Plan 01: Asset Data Foundation Summary

**Prisma schema with 4 asset models, FTS5 search index, 6 REST API route files with recursive dependency graph, and sidebar navigation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T04:20:04Z
- **Completed:** 2026-03-30T04:24:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Four new Prisma models (Asset, AssetEvent, AssetLocation, AssetDependency) with SQLite tables
- FTS5 virtual table indexing asset title, description, category with BM25-ranked search
- Full CRUD REST API across 6 route files with event logging on all mutations
- Recursive CTE for dependency ripple count calculation
- Assets sidebar navigation entry positioned after Deliverables

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema + migration + FTS5 for assets** - `16c4ac0` (feat)
2. **Task 2: Asset REST API routes** - `e19b133` (feat)
3. **Task 3: Sidebar navigation entry for Assets** - `8e0923c` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added Asset, AssetEvent, AssetLocation, AssetDependency models + assetId on Deliverable
- `src/lib/asset-fts.ts` - FTS5 virtual table init and BM25 search for assets
- `src/instrumentation.ts` - Added initAssetsFTS5() call during server boot
- `src/app/api/assets/route.ts` - Asset list (with FTS5 search) and create endpoints
- `src/app/api/assets/[assetId]/route.ts` - Single asset GET, PATCH, DELETE with event logging
- `src/app/api/assets/[assetId]/events/route.ts` - Asset event timeline endpoint
- `src/app/api/assets/[assetId]/annotations/route.ts` - Annotation append to JSON array
- `src/app/api/assets/[assetId]/locations/route.ts` - Location CRUD with canonical management
- `src/app/api/assets/[assetId]/dependencies/route.ts` - Dependency graph with recursive CTE ripple
- `src/components/Sidebar.tsx` - Added Assets nav item

## Decisions Made
- Used raw SQL table creation instead of Prisma migrate dev (FTS5 virtual tables cause schema drift that blocks migration)
- AssetDependency has no Prisma relation to Asset; queries use raw sqlite for recursive CTE support
- Used `db push --accept-data-loss` approach was abandoned; created tables directly via better-sqlite3

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma migrate dev blocked by FTS5 schema drift**
- **Found during:** Task 1 (Prisma migration)
- **Issue:** `prisma migrate dev` detected drift from FTS5 virtual tables and demanded a full DB reset
- **Fix:** Created asset tables via raw SQL using better-sqlite3, then ran `prisma generate` for client types
- **Files modified:** None additional (same schema.prisma used)
- **Verification:** Tables created, Prisma client generated with correct types
- **Committed in:** 16c4ac0

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Migration approach changed from Prisma migrate to raw SQL. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in 4 unrelated files (BuildLogPanel, ApprovalCard, WorkspaceChatPanel, validate-concurrent-isolation) - not caused by this plan's changes, left as-is per scope boundary rule

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Asset data layer and API fully operational for plans 02-05
- FTS5 search ready for asset search UI
- Dependency graph with ripple calculation ready for visualization

---
*Phase: 07-assets-managment-system*
*Completed: 2026-03-30*
