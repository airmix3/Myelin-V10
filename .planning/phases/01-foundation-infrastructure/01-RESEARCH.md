# Phase 1: Foundation Infrastructure - Research

**Researched:** 2026-03-25
**Domain:** Next.js 14 App Router + Prisma/SQLite + Worker Loop + SSE + FTS5
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield bootstrap of a Next.js 14.2.35 App Router application with Prisma ORM backed by SQLite (via better-sqlite3 driver adapter), a task state machine implementing 6 A2A states, a polling worker loop, SSE event bus, FTS5 full-text search, and supporting infrastructure (ID generation, workspace creation, company DNA template).

All package versions specified in CLAUDE.md have been verified against the npm registry and confirmed to exist. The project is truly greenfield -- no existing code, no package.json, no node_modules. pnpm is NOT currently installed on this machine and must be installed first (npm is available at v10.8.2, Node.js v20.19.5).

**Primary recommendation:** Bootstrap with `npx create-next-app@14.2.35`, then layer in Prisma with better-sqlite3 driver adapter, raw SQL for FTS5 (Prisma cannot express virtual tables), and use `instrumentation.ts` (stable in 14.2+, no experimental flag needed) as the bootstrap hook for worker loop and FTS5 safety net.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full company brief DNA template -- not a minimal skeleton. Ships with real content.
- **D-02:** Mission framing: "Myelin builds BDaS -- Brain Data as a Service -- a privacy-first BCI integration layer that enables developers to build brain-computer interface applications without handling raw neural data."
- **D-03:** Stage context included: pre-seed, 300-day sprint, sole founder (Omer Shalev), primary goal is validating BDaS with first customers.
- **D-04:** Departments with standard scope: Tech (CTO), Marketing (CMO), Operations (COO), Global.
- **D-05:** Default budget philosophy: $10 per task.
- **D-06:** Working style: technical precision -- rigorous, cite sources, prefer concrete deliverables over summaries.
- **D-07:** Privacy principles NOT baked into DNA -- handled per-task via plan constraints.
- **D-08:** Collaboration norm: proactively consult relevant department heads.
- **D-09:** Worker loop poll interval: 2 seconds, fixed -- no backoff.
- **D-10:** No backoff when queue is empty. Fixed 2s interval always.
- **D-11:** Stale run threshold: 2 minutes (~8 missed heartbeats at 15s each).
- **D-12:** On startup, any task_runs still in `executing` state are immediately marked `failed`.

### Claude's Discretion
- Exact Prisma column definitions for all 9 tables
- Optimistic-lock SQL for worker claim (UPDATE WHERE status='queued' AND id=...)
- FTS5 index trigger SQL specifics
- instrumentation.ts singleton flag implementation detail

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Next.js 14 App Router + TypeScript strict + pnpm | Project bootstrap pattern, tsconfig strict mode, pnpm install |
| FOUND-02 | Prisma 7.5 + SQLite with WAL mode + zod v4 | Prisma driver adapter pattern, PRAGMA setup via better-sqlite3 |
| FOUND-03 | FTS5 virtual table + sync triggers + safety-net init | FTS5 CREATE VIRTUAL TABLE, external content triggers, rebuild command |
| FOUND-04 | Task state machine with 6 A2A states | State transition graph, atomic WHERE-on-current-state SQL |
| FOUND-05 | Single shared SSE event bus via EventEmitter | Node.js EventEmitter + ReadableStream SSE pattern |
| FOUND-06 | instrumentation.ts bootstrap for worker loop + FTS5 init | Next.js 14.2 stable instrumentation, NEXT_RUNTIME guard, singleton pattern |
| FOUND-07 | Worker loop: poll, claim, concurrency cap, heartbeat, stale cleanup | Optimistic lock SQL, setInterval patterns, startup recovery |
| FOUND-08 | Company DNA template at config/ copied to data/vault/ | File copy + FTS5 indexing on first boot |
| FOUND-09 | generateId(prefix) utility | crypto.randomBytes(4).toString('hex') pattern |
| FOUND-10 | createTaskWorkspace() with desk/ + deliverables/ + symlinks | fs.mkdirSync, fs.symlinkSync, deliverable_manifest.json stub |
| FOUND-11 | Planning desk per department | Directory structure creation at data/departments/{dept}/planning-desk/ |
</phase_requirements>

## Standard Stack

### Core (Phase 1 Subset)

All versions verified against npm registry on 2026-03-25.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.35 | Full-stack framework (App Router) | Locked in PROJECT.md. v14.2 is latest 14.x, stable instrumentation.ts |
| react | 18.x | UI library | Required by Next.js 14 (NOT React 19) |
| react-dom | 18.x | React DOM renderer | Required by Next.js 14 |
| prisma | 7.5.0 | ORM + schema management + migrations | Type-safe SQLite access with migration system |
| @prisma/client | 7.5.0 | Generated Prisma client | Must match prisma version exactly |
| @prisma/adapter-better-sqlite3 | 7.5.0 | Driver adapter for better-sqlite3 | Enables WAL mode and raw SQL alongside Prisma |
| better-sqlite3 | 12.8.0 | SQLite driver (synchronous) | Required for FTS5 virtual tables, triggers, MATCH syntax |
| zod | 4.3.6 | Schema validation | Hard peer dependency of Agent SDK (^4.0.0). Greenfield -- use v4 patterns only |
| typescript | 6.0.2 | Language | Strict mode mandatory per constraints |
| pino | 10.3.1 | Structured JSON logging | All application logging, per-agent log contexts via pino.child() |

### Supporting (Phase 1 Only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gray-matter | 4.0.3 | Frontmatter parsing | Parsing company-dna.md and vault documents with YAML frontmatter |
| @types/better-sqlite3 | 7.6.13 | TypeScript types | Dev dependency for raw SQL type safety |
| @types/node | 22.x | Node.js types | Match Node 22 LTS types (runtime is v20 but types at 22 is fine) |
| pino-pretty | 13.1.3 | Dev log formatting | Dev-only, human-readable pino output |

### Not Needed in Phase 1

These are in the full stack but NOT needed until later phases:

| Library | Phase | Why Deferred |
|---------|-------|-------------|
| @anthropic-ai/claude-agent-sdk | Phase 2 | Agent execution -- no agents in Phase 1 |
| @modelcontextprotocol/sdk | Phase 2 | MCP tools -- no tools in Phase 1 |
| marked | Phase 3+ | Markdown rendering for UI -- no UI rendering in Phase 1 |
| proper-lockfile | Phase 2 | File locking for concurrent agents -- no agents in Phase 1 |
| node-cron | Phase 2+ | Tamir cron -- no agent scheduling in Phase 1 |
| vitest | Phase 1 | Test framework -- include if validation tests desired, but nyquist_validation is disabled |

**Installation:**
```bash
# Install pnpm first (not currently available on system)
npm install -g pnpm

# Bootstrap Next.js project
pnpm create next-app@14.2.35 . --typescript --app --no-tailwind --no-eslint --no-src-dir --import-alias "@/*"

# Core dependencies
pnpm add prisma@7.5.0 @prisma/client@7.5.0 @prisma/adapter-better-sqlite3@7.5.0 better-sqlite3@12.8.0 zod@4.3.6 pino@10.3.1 gray-matter@4.0.3

# Dev dependencies
pnpm add -D @types/better-sqlite3@7.6.13 @types/node@22 pino-pretty@13.1.3
```

**IMPORTANT on create-next-app flags:** The `--no-src-dir` flag means files go in project root (app/, not src/app/). However, CONTEXT.md references `src/lib/events.ts` -- check if project wants `src/` directory. The REQUIREMENTS also reference `src/agents/`, `src/a2a/types.ts`. Use `--src-dir` instead to match the project's `src/` convention.

Corrected bootstrap:
```bash
pnpm create next-app@14.2.35 . --typescript --app --no-tailwind --no-eslint --src-dir --import-alias "@/*"
```

## Architecture Patterns

### Recommended Project Structure (Phase 1)

```
myelin-v10/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout (minimal in Phase 1)
│   │   ├── page.tsx             # Placeholder home page
│   │   └── api/
│   │       └── sse/
│   │           └── route.ts     # SSE endpoint (FOUND-05, FOUND-06)
│   ├── lib/
│   │   ├── db.ts                # Prisma client singleton + better-sqlite3 instance
│   │   ├── db-raw.ts            # Raw better-sqlite3 for FTS5 operations
│   │   ├── events.ts            # SSE EventEmitter singleton (FOUND-05)
│   │   ├── fts.ts               # FTS5 init, search, index functions (FOUND-03)
│   │   ├── state-machine.ts     # A2A task state transitions (FOUND-04)
│   │   ├── worker.ts            # Worker loop logic (FOUND-07)
│   │   ├── id.ts                # generateId(prefix) utility (FOUND-09)
│   │   ├── workspace.ts         # createTaskWorkspace() + planning desk (FOUND-10, FOUND-11)
│   │   └── logger.ts            # Pino logger setup
│   └── instrumentation.ts       # Bootstrap: worker loop + FTS5 init (FOUND-06)
├── prisma/
│   ├── schema.prisma            # Prisma schema with all 9 tables
│   └── migrations/              # Prisma migrations (includes raw SQL for FTS5)
├── config/
│   └── company-dna.template.md  # DNA template (FOUND-08)
├── data/                        # Runtime data directory (gitignored except templates)
│   ├── vault/                   # Vault documents
│   ├── departments/             # Per-department data
│   │   ├── tech/
│   │   │   └── planning-desk/
│   │   ├── marketing/
│   │   │   └── planning-desk/
│   │   ├── operations/
│   │   │   └── planning-desk/
│   │   └── global/
│   └── agents/                  # Per-agent data
├── next.config.mjs              # Next.js configuration
├── tsconfig.json                # TypeScript strict mode config
└── package.json
```

### Pattern 1: Prisma + better-sqlite3 Dual Access

**What:** Prisma handles all standard CRUD. better-sqlite3 handles FTS5, triggers, and PRAGMAs.
**When to use:** Always -- this is the only way to get FTS5 with Prisma.

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || './data/myelin.db';

// Single better-sqlite3 instance -- also used for FTS5 raw queries
export const sqlite = new Database(DB_PATH);

// Set PRAGMAs before any Prisma usage
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');

// Create driver adapter
const adapter = new PrismaBetterSQLite3(sqlite);

// Prisma client with driver adapter
export const prisma = new PrismaClient({ adapter });
```

**Schema setup (prisma/schema.prisma):**
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlite"
  url      = "file:../data/myelin.db"
}
```

**CRITICAL:** The `previewFeatures = ["driverAdapters"]` line is required for Prisma to accept the adapter parameter. Even though driver adapters have been available for a while, they may still be behind this preview flag in Prisma 7.5. Verify at implementation time -- if not needed, remove it.

### Pattern 2: FTS5 External Content Table with Sync Triggers

**What:** FTS5 virtual table backed by an external content table (the Prisma-managed `documents` table).
**When to use:** For FOUND-03 -- the `documents_fts` table.

```sql
-- In Prisma migration (raw SQL section) or in FTS5 init module
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  title,
  content,
  content='documents',
  content_rowid='rowid',
  tokenize='porter unicode61'
);

-- Sync triggers: keep FTS5 in sync when Prisma writes to documents table
CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
END;

CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
  INSERT INTO documents_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
```

**Safety net in instrumentation.ts:** On every server start, check if `documents_fts` exists and recreate + rebuild if missing:

```typescript
// Check if FTS5 table exists
const ftsExists = sqlite.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='documents_fts'"
).get();

if (!ftsExists) {
  // Recreate FTS5 table and triggers (SQL above)
  // Then rebuild index from existing content:
  sqlite.exec("INSERT INTO documents_fts(documents_fts) VALUES('rebuild')");
}
```

### Pattern 3: SSE via ReadableStream in Next.js App Router

**What:** Server-Sent Events endpoint using native Web Streams API.
**When to use:** For FOUND-05 -- the `/api/sse` endpoint.

```typescript
// src/app/api/sse/route.ts
import { eventBus } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const handler = (event: { type: string; data: unknown }) => {
        const chunk = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      };

      eventBus.on('event', handler);

      // Clean up on disconnect
      request.signal.addEventListener('abort', () => {
        eventBus.off('event', handler);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
```

```typescript
// src/lib/events.ts
import { EventEmitter } from 'events';

class SSEEventBus extends EventEmitter {
  emit(type: string, data?: unknown): boolean {
    return super.emit('event', { type, data });
  }
}

// Singleton -- survives HMR in development
const globalForEvents = globalThis as typeof globalThis & {
  __sseEventBus?: SSEEventBus;
};

export const eventBus = globalForEvents.__sseEventBus ??= new SSEEventBus();
```

### Pattern 4: A2A State Machine with Atomic Transitions

**What:** Task state transitions enforced via SQL WHERE clause on current state.
**When to use:** For FOUND-04.

```typescript
// src/lib/state-machine.ts
export type TaskState = 'submitted' | 'working' | 'input-required' | 'completed' | 'failed' | 'canceled';

// Valid transitions: from -> [allowed to states]
const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  'submitted':      ['working', 'canceled'],
  'working':        ['input-required', 'completed', 'failed', 'canceled'],
  'input-required': ['working', 'canceled', 'failed'],
  'completed':      [],  // terminal
  'failed':         [],  // terminal
  'canceled':       [],  // terminal
};

export function isValidTransition(from: TaskState, to: TaskState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

Atomic SQL enforcement:
```sql
-- transitionTask(taskId, fromState, toState) -- returns affected rows count
UPDATE tasks
SET state = ?, updated_at = datetime('now')
WHERE id = ? AND state = ?
-- If 0 rows affected: transition was invalid (state changed between read and write)
```

### Pattern 5: instrumentation.ts with Singleton Guard

**What:** Bootstrap hook that runs once on server start in Node.js runtime.
**When to use:** For FOUND-06.

```typescript
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import to keep edge runtime clean
    const { initFTS5 } = await import('./lib/fts');
    const { startWorkerLoop } = await import('./lib/worker');

    // Singleton guard -- prevent duplicate on HMR
    const g = globalThis as typeof globalThis & { __myelinInit?: boolean };
    if (g.__myelinInit) return;
    g.__myelinInit = true;

    // Initialize FTS5 safety net (sync, fast)
    initFTS5();

    // Start worker loop (fire-and-forget, does not block startup)
    startWorkerLoop();
  }
}
```

**IMPORTANT:** In Next.js 14.2+, `instrumentation.ts` is stable. No `experimental.instrumentationHook` config needed. The file goes in `src/instrumentation.ts` when using `src/` directory.

### Pattern 6: Worker Loop with Optimistic Lock

**What:** Polling loop that claims and executes queued task runs.
**When to use:** For FOUND-07.

```typescript
// src/lib/worker.ts - core claim pattern
// Optimistic lock: only one worker instance can claim a run
const claimed = sqlite.prepare(`
  UPDATE task_runs
  SET status = 'executing', claimed_at = datetime('now'), heartbeat_at = datetime('now')
  WHERE id = (
    SELECT id FROM task_runs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
  ) AND status = 'queued'
  RETURNING *
`).get();
// If claimed is null, another worker got it or queue is empty
```

### Anti-Patterns to Avoid

- **Do NOT use `experimental.instrumentationHook`** in next.config -- it is not needed in Next.js 14.2+
- **Do NOT create FTS5 tables via Prisma migrations** -- Prisma cannot express `CREATE VIRTUAL TABLE`. Use raw SQL in a separate migration step or in the FTS5 init module.
- **Do NOT use zod v3 patterns** -- this is greenfield with zod v4. `.strict()` is now default on objects; use `.passthrough()` for loose objects.
- **Do NOT use `uuid` or `nanoid`** for IDs -- FOUND-09 specifies `generateId(prefix)` with `crypto.randomBytes(4).toString('hex')`.
- **Do NOT use React 19** -- Next.js 14 requires React 18.x.
- **Do NOT use dotenv** -- Next.js has built-in `.env` file loading.
- **Do NOT put instrumentation.ts in the `app/` directory** -- it goes in `src/` (root of src directory).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database ORM | Custom SQL query builder | Prisma 7.5 with driver adapter | Type generation, migrations, schema management |
| Full-text search | Custom text search with LIKE | SQLite FTS5 via better-sqlite3 | BM25 ranking, tokenization, phrase matching -- hundreds of edge cases |
| Structured logging | console.log with JSON.stringify | pino 10.3.1 | Child loggers, structured fields, transport system, performance |
| SSE protocol formatting | Manual string concatenation | Use the SSE format (`event: X\ndata: Y\n\n`) but with a thin helper | SSE spec has specific requirements around newlines, retry fields, comments |
| Prisma singleton | New PrismaClient() everywhere | globalThis caching pattern | Next.js HMR creates new module contexts; without singleton, you get connection leaks |

## Common Pitfalls

### Pitfall 1: Prisma Client Instantiation in Development (HMR)
**What goes wrong:** Every hot-reload creates a new PrismaClient, exhausting SQLite file handles.
**Why it happens:** Next.js dev mode re-evaluates modules on change.
**How to avoid:** Use the globalThis caching pattern:
```typescript
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ??= new PrismaClient({ adapter });
```
**Warning signs:** "too many open files" errors in development.

### Pitfall 2: FTS5 Table Disappears After Migration
**What goes wrong:** Running `prisma migrate reset` or `prisma db push` drops the FTS5 virtual table and triggers because Prisma doesn't know about them.
**Why it happens:** Prisma only tracks tables it manages. FTS5 virtual tables are invisible to Prisma's schema introspection.
**How to avoid:** The safety-net in `instrumentation.ts` (FOUND-03/FOUND-06) that checks and recreates FTS5 on every startup. Also include FTS5 creation SQL in a custom migration step.
**Warning signs:** Search returning zero results after a migration.

### Pitfall 3: EventEmitter Memory Leak Warning
**What goes wrong:** Node.js warns "MaxListenersExceededWarning" when many SSE clients connect.
**Why it happens:** Default max listeners is 10. Each SSE client adds a listener.
**How to avoid:** Set `eventBus.setMaxListeners(100)` or higher. For a single-user app, 20-50 is plenty.
**Warning signs:** Warning in console about memory leak.

### Pitfall 4: SQLite PRAGMA Not Set Before First Query
**What goes wrong:** WAL mode and busy_timeout are not applied, leading to database locking issues.
**Why it happens:** PRAGMAs must be set on the connection before any queries. If Prisma connects before PRAGMAs are set, the connection runs in default journal mode.
**How to avoid:** Set PRAGMAs on the better-sqlite3 instance BEFORE creating the Prisma adapter:
```typescript
const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');
// THEN create adapter and PrismaClient
```
**Warning signs:** "database is locked" errors under concurrent access.

### Pitfall 5: Worker Loop Duplicate Execution on HMR
**What goes wrong:** Multiple worker loop intervals running simultaneously in development.
**Why it happens:** Module re-evaluation starts a new setInterval without clearing the old one.
**How to avoid:** Singleton guard on globalThis (Pattern 5 above). Store the interval ID and clear before restart.
**Warning signs:** Tasks being claimed multiple times, duplicate heartbeats.

### Pitfall 6: create-next-app Initializes Git Repo
**What goes wrong:** `create-next-app` runs `git init` automatically, which may conflict with existing repo setup.
**Why it happens:** Default behavior of create-next-app.
**How to avoid:** The project directory already exists with files (CLAUDE.md, docs/). Running create-next-app in an existing directory should work but check for conflicts. May need to run in a temp dir and copy files, or use `--no-git` flag if available.
**Warning signs:** Unexpected git state after bootstrap.

### Pitfall 7: Prisma Driver Adapter Preview Feature
**What goes wrong:** PrismaClient constructor rejects the `adapter` option.
**Why it happens:** Driver adapters may still require `previewFeatures = ["driverAdapters"]` in schema.prisma.
**How to avoid:** Include `previewFeatures = ["driverAdapters"]` in the generator block. If Prisma 7.5 has stabilized this, the flag is harmless.
**Warning signs:** Runtime error "Unknown arg `adapter`" on PrismaClient construction.

## Code Examples

### ID Generation (FOUND-09)

```typescript
// src/lib/id.ts
import { randomBytes } from 'crypto';

export function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}

// Usage:
// generateId('task')  => 'task_a1b2c3d4'
// generateId('run')   => 'run_e5f6a7b8'
```

### Worker Loop Startup Recovery (FOUND-07, D-12)

```typescript
// Called once on server startup, before polling begins
export function recoverStaleRuns(): void {
  const result = sqlite.prepare(`
    UPDATE task_runs
    SET status = 'failed', failed_at = datetime('now'), failure_reason = 'stale_on_startup'
    WHERE status = 'executing'
  `).run();

  if (result.changes > 0) {
    logger.warn({ count: result.changes }, 'Marked stale executing runs as failed on startup');
  }
}
```

### Worker Loop Heartbeat (FOUND-07)

```typescript
// Heartbeat every 15 seconds for active runs
function heartbeat(runId: string): void {
  sqlite.prepare(`
    UPDATE task_runs SET heartbeat_at = datetime('now') WHERE id = ?
  `).run(runId);
}

// Stale detection (D-11: 2 minutes = 120 seconds)
function markStaleRuns(): void {
  sqlite.prepare(`
    UPDATE task_runs
    SET status = 'failed', failed_at = datetime('now'), failure_reason = 'heartbeat_timeout'
    WHERE status = 'executing'
    AND heartbeat_at < datetime('now', '-120 seconds')
  `).run();
}
```

### FTS5 Search Query (FOUND-03)

```typescript
// src/lib/fts.ts
export function searchDocuments(query: string, limit = 20): SearchResult[] {
  return sqlite.prepare(`
    SELECT
      d.id, d.title, d.source, d.department,
      snippet(documents_fts, 1, '<mark>', '</mark>', '...', 32) as snippet,
      bm25(documents_fts, 5.0, 1.0) as rank
    FROM documents_fts
    JOIN documents d ON d.rowid = documents_fts.rowid
    WHERE documents_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit) as SearchResult[];
}
```

### Workspace Creation (FOUND-10)

```typescript
// src/lib/workspace.ts
import { mkdirSync, writeFileSync, symlinkSync } from 'fs';
import { join } from 'path';

export function createTaskWorkspace(taskId: string, department: string): string {
  const baseDir = join(process.cwd(), 'data', 'workspaces', taskId);
  const deskDir = join(baseDir, 'desk');
  const delivDir = join(baseDir, 'deliverables');

  mkdirSync(join(deskDir, '.claude', 'skills'), { recursive: true });
  mkdirSync(delivDir, { recursive: true });

  // Symlink active department + global skills into desk
  const deptSkills = join(process.cwd(), 'data', 'departments', department, 'skills');
  const globalSkills = join(process.cwd(), 'data', 'departments', 'global', 'skills');

  try { symlinkSync(deptSkills, join(deskDir, '.claude', 'skills', department)); } catch {}
  try { symlinkSync(globalSkills, join(deskDir, '.claude', 'skills', 'global')); } catch {}

  // Stub deliverable manifest
  writeFileSync(
    join(delivDir, 'deliverable_manifest.json'),
    JSON.stringify({ taskId, files: [], primaryFile: null }, null, 2)
  );

  return baseDir;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `experimental.instrumentationHook: true` | Stable `instrumentation.ts` (no config) | Next.js 14.2 (April 2024) | Remove experimental flag from next.config |
| Prisma with built-in SQLite driver | Prisma with `@prisma/adapter-better-sqlite3` | Prisma 5.x+ | Direct better-sqlite3 access alongside Prisma for FTS5 |
| zod v3 `.strict()` opt-in | zod v4 `.strict()` is default | zod 4.0 | Use `.passthrough()` for loose objects, not `.strict()` for strict ones |
| `pages/api/` for API routes | `app/api/route.ts` Route Handlers | Next.js 13.2+ | Web standard Request/Response API, native streaming support |

## Open Questions

1. **Prisma driverAdapters preview flag in v7.5**
   - What we know: Driver adapters were a preview feature in Prisma 5.x-6.x. By 7.5 they may be stable.
   - What's unclear: Whether `previewFeatures = ["driverAdapters"]` is still required or can be omitted.
   - Recommendation: Include it in schema.prisma. If Prisma warns it's unnecessary, remove. It is harmless if unneeded.

2. **create-next-app in existing directory**
   - What we know: The project root already has CLAUDE.md and docs/. create-next-app expects an empty or new directory.
   - What's unclear: Whether it will error, overwrite, or merge.
   - Recommendation: Initialize in a temp directory, then copy generated files into the project root. Or manually create package.json and next.config.mjs without create-next-app.

3. **Prisma schema for 9 tables -- which tables exactly?**
   - What we know: FOUND-02 mentions "all 9 tables" but only the tasks/task_runs tables are explicitly detailed in Phase 1 requirements. Other tables (documents, agents, departments, etc.) are implied by FOUND-03 through FOUND-11.
   - What's unclear: Exact set of 9 tables. Likely: tasks, task_runs, documents, agents, departments, cost_events, activity_log, deliverables, hire_requests.
   - Recommendation: Planner should define all 9 tables based on requirements. Tables needed by Phase 2+ can have minimal columns now, expanded later.

4. **Node.js version compatibility**
   - What we know: System runs Node.js v20.19.5. @types/node is pinned to 22.x per CLAUDE.md.
   - What's unclear: Whether any packages require Node 22 features not available in Node 20.
   - Recommendation: Node 20 is LTS and should work fine. The @types/node@22 is acceptable since it provides type definitions that are a superset. Monitor for any Node 22-specific API usage.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | Yes | 20.19.5 | -- |
| npm | Package management | Yes | 10.8.2 | -- |
| pnpm | PROJECT.md constraint | **NO** | -- | Install via `npm install -g pnpm` |
| git | Version control | Verify | -- | -- |
| SQLite | Database (via better-sqlite3) | Via npm package | Bundled with better-sqlite3 | -- |

**Missing dependencies with no fallback:**
- None (pnpm can be installed)

**Missing dependencies with fallback:**
- pnpm: Not installed. Install with `npm install -g pnpm` before any other work. This is a blocking prerequisite.

## Sources

### Primary (HIGH confidence)
- npm registry -- all 12+ package versions verified via `npm view` on 2026-03-25
- Next.js 14.2.35 official docs (nextjs.org/docs/14/) -- instrumentation.ts patterns, Route Handler streaming
- Next.js 14.2 release blog -- confirmed instrumentation.ts stable (no experimental flag)
- SQLite FTS5 official docs (sqlite.org/fts5.html) -- CREATE VIRTUAL TABLE, triggers, MATCH, bm25()

### Secondary (MEDIUM confidence)
- Prisma + better-sqlite3 driver adapter pattern -- based on known Prisma driver adapter API and npm package existence (could not fetch detailed docs due to 404/403)
- `previewFeatures = ["driverAdapters"]` -- may or may not be required in Prisma 7.5 (was required in earlier versions)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified on npm registry
- Architecture: HIGH -- patterns based on official Next.js 14 docs and established SQLite/FTS5 practices
- Pitfalls: HIGH -- well-known issues in Next.js dev mode, Prisma HMR, SQLite PRAGMA ordering
- Prisma adapter config: MEDIUM -- exact API verified via npm package existence but detailed docs unavailable

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (30 days -- stable technologies, no fast-moving dependencies)
