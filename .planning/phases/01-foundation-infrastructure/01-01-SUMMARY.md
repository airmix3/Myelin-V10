---
phase: 01-foundation-infrastructure
plan: 01
subsystem: infra
tags: [next.js, prisma, sqlite, better-sqlite3, typescript, pino, pnpm]

# Dependency graph
requires: []
provides:
  - "Next.js 14 App Router project with TypeScript strict mode"
  - "Prisma schema with all 10 database tables"
  - "SQLite database with WAL mode via better-sqlite3"
  - "Database singleton (prisma + sqlite exports)"
  - "generateId(prefix) utility for prefixed hex IDs"
  - "Pino structured logger with pino-pretty in dev"
  - "Data directory structure for vault, departments, agents, workspaces"
affects: [01-02, 01-03, 01-04, 02-agent-execution, 03-ui-tamir, 04-workspace-integration]

# Tech tracking
tech-stack:
  added: [next@14.2.35, react@18.3.1, prisma@7.5.0, "@prisma/client@7.5.0", "@prisma/adapter-better-sqlite3@7.5.0", better-sqlite3@12.8.0, zod@4.3.6, pino@10.3.1, gray-matter@4.0.3, typescript@6.0.2, pino-pretty@13.1.3]
  patterns: [prisma-7-config-file, better-sqlite3-dual-access, globalThis-singleton-hmr, prefixed-hex-id-generation]

key-files:
  created:
    - package.json
    - tsconfig.json
    - next.config.mjs
    - prisma/schema.prisma
    - prisma.config.ts
    - src/lib/db.ts
    - src/lib/id.ts
    - src/lib/logger.ts
    - src/app/layout.tsx
    - src/app/page.tsx
    - .env
    - .gitignore
  modified: []

key-decisions:
  - "Prisma 7 requires prisma.config.ts for datasource URL -- removed url from schema.prisma"
  - "driverAdapters no longer a preview feature in Prisma 7.5 -- removed previewFeatures flag"
  - "PrismaBetterSqlite3 adapter takes config object {url} not Database instance in Prisma 7"
  - "Separate better-sqlite3 instance for FTS5/raw queries alongside Prisma adapter connection"
  - "Used TypeScript 6.0.2 as specified in CLAUDE.md stack"

patterns-established:
  - "Prisma 7 config: datasource URL in prisma.config.ts, not schema.prisma"
  - "Database dual access: prisma export for ORM, sqlite export for raw FTS5/triggers"
  - "HMR singleton: globalThis caching pattern for db connections"
  - "ID generation: generateId(prefix) returning prefix_XXXXXXXX (8 hex chars)"
  - "pnpm onlyBuiltDependencies for native module build approval"

requirements-completed: [FOUND-01, FOUND-02, FOUND-09]

# Metrics
duration: 7min
completed: 2026-03-25
---

# Phase 01 Plan 01: Project Bootstrap Summary

**Next.js 14.2.35 project with Prisma 7 / SQLite / better-sqlite3 dual access, 10-table schema, and core utilities (ID gen, logging, database singleton)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-25T22:28:58Z
- **Completed:** 2026-03-25T22:35:45Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Next.js 14.2.35 App Router bootstrapped with TypeScript 6.0.2 strict mode and pnpm
- Prisma 7.5 schema with all 10 models (Employee, Task, TaskRun, Deliverable, HireRequest, CostEvent, Skill, McpServer, Document, ActivityLog) pushed to SQLite
- Database singleton with WAL mode, busy_timeout, and dual Prisma/better-sqlite3 access pattern
- Core utilities: generateId(prefix) for prefixed hex IDs, pino logger with dev-mode pretty printing

## Task Commits

Each task was committed atomically:

1. **Task 1: Bootstrap Next.js project with all Phase 1 dependencies** - `d70a8ba` (feat)
2. **Task 2: Prisma schema with all tables + database singleton + utilities** - `ef0d59d` (feat)

## Files Created/Modified
- `package.json` - Project manifest with all Phase 1 dependencies
- `pnpm-lock.yaml` - Lockfile for reproducible installs
- `tsconfig.json` - TypeScript strict mode configuration with path aliases
- `next.config.mjs` - Next.js config with serverExternalPackages for better-sqlite3
- `.env` - DATABASE_URL and NODE_ENV defaults
- `.gitignore` - Ignores for node_modules, .next, data/myelin.db, env files
- `prisma/schema.prisma` - 10-model database schema for SQLite
- `prisma.config.ts` - Prisma 7 config with datasource URL (new in Prisma 7)
- `src/lib/db.ts` - Prisma + better-sqlite3 dual access singleton with WAL mode
- `src/lib/id.ts` - generateId(prefix) returning prefix_XXXXXXXX format
- `src/lib/logger.ts` - Pino structured logger with pino-pretty in development
- `src/app/layout.tsx` - Root layout with metadata for The Cortex
- `src/app/page.tsx` - Placeholder home page

## Decisions Made
- **Prisma 7 config migration:** Prisma 7.5 no longer supports `url` in schema.prisma datasource block. Created `prisma.config.ts` with `defineConfig()` for datasource URL. This is a breaking change from the plan's expected pattern.
- **driverAdapters stable:** The `previewFeatures = ["driverAdapters"]` flag is deprecated in Prisma 7.5 -- driver adapters are now stable. Removed the flag.
- **Adapter API change:** `PrismaBetterSqlite3` (note: lowercase 'q' in Sqlite3) now takes `{ url: string }` config object instead of a `Database` instance. Separate `sqlite` export maintained for direct raw SQL access (FTS5, triggers).
- **pnpm via npx:** pnpm not globally installable (permissions). Used `npx pnpm` for all commands. Added `pnpm.onlyBuiltDependencies` to package.json for native module build approval.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma 7 datasource URL configuration**
- **Found during:** Task 2 (Prisma schema creation)
- **Issue:** Prisma 7.5 removed `url` from schema.prisma datasource block, causing validation error P1012
- **Fix:** Created `prisma.config.ts` with `defineConfig({ datasource: { url: ... } })` and removed url from schema.prisma
- **Files modified:** prisma/schema.prisma, prisma.config.ts (new)
- **Verification:** `prisma generate` and `prisma db push` succeed
- **Committed in:** ef0d59d (Task 2 commit)

**2. [Rule 1 - Bug] PrismaBetterSqlite3 class name casing**
- **Found during:** Task 2 (db.ts creation)
- **Issue:** Plan used `PrismaBetterSQLite3` but actual export is `PrismaBetterSqlite3` (lowercase 'q')
- **Fix:** Changed import to correct casing
- **Files modified:** src/lib/db.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** ef0d59d (Task 2 commit)

**3. [Rule 3 - Blocking] PrismaBetterSqlite3 constructor API change**
- **Found during:** Task 2 (db.ts creation)
- **Issue:** Prisma 7 adapter takes `{ url: string }` config, not a `Database` instance
- **Fix:** Changed constructor call to `new PrismaBetterSqlite3({ url: \`file:\${DB_PATH}\` })`, kept separate `sqlite` export for raw access
- **Files modified:** src/lib/db.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** ef0d59d (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All fixes required due to Prisma 7 API changes not anticipated in the plan. The dual-access pattern (Prisma for ORM, better-sqlite3 for raw SQL) is preserved. No scope creep.

## Issues Encountered
- pnpm not globally installable due to filesystem permissions. Worked around via `npx pnpm` for all commands. Functional but slightly slower per invocation.
- pnpm build scripts for native modules (better-sqlite3, @prisma/engines) require explicit approval via `pnpm.onlyBuiltDependencies` in package.json.

## Known Stubs
None -- no UI stubs or placeholder data flows in this foundation plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Foundation complete: package.json, database, core utilities all working
- Ready for Plan 01-02 (state machine, SSE, worker loop) -- all imports and database access patterns established
- Prisma 7 patterns documented for downstream plans to follow

## Self-Check: PASSED

All 11 created files verified on disk. Both task commits (d70a8ba, ef0d59d) verified in git log. Database file exists with 10 tables.

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-03-25*
