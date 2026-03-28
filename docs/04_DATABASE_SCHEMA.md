# 04 -- Database Schema (Prisma + SQLite)

## Overview

Myelin v10 uses SQLite via Prisma ORM. Single file, zero config, perfect for single-user. FTS5 for full-text search via raw SQL.

**Key changes from earlier versions:**
- Task and TaskPlan unified into one `Task` model (one record, one lifecycle)
- SharedDesk model removed (desk is filesystem-based, not DB)
- Company DNA stored in vault (DB `documents` table), not a hardcoded JSON file
- FTS5 stores essence + path, NOT full document content
- `taskId` added to CostEvent, ActivityLog, and HireRequest for per-task tracking
- Cost tracking uses SDK-provided `total_cost_usd` (no hardcoded pricing)
- **No custom A2A states** -- only standard: submitted, working, input-required, completed, failed, canceled
- **No `phase` field** -- lifecycle stage derived from timestamps (approvedAt, completedAt) and currentActorId
- **Chat history on filesystem** -- stored as JSONL files, NOT in SQLite JSON columns
- **Indexes** on frequently queried columns (department, status, taskId foreign keys)

## Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL") // "file:./data/myelin.db"
}

// ── 1. Employees (executives + temp hires) ──

model Employee {
  agentId          String   @id @map("agent_id")
  name             String
  role             String
  type             String   @default("permanent") // permanent | temp
  department       String?
  reportsTo        String?  @map("reports_to")
  status           String   @default("active") // active | idle | terminated
  systemPrompt     String?  @map("system_prompt")
  budgetMonthlyCents Int    @default(10000) @map("budget_monthly_cents")
  spentMonthlyCents  Int    @default(0) @map("spent_monthly_cents")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@map("employees")
}

// ── 2. Tasks (UNIFIED: plan + execution in one record) ──
// A task starts as a plan (CEO describes, dept head clarifies, plan generated).
// When CEO approves, the same record transitions to execution states.
// One record, one lifecycle, one contextId.

model Task {
  taskId           String   @id @map("task_id")
  contextId        String?  @map("context_id")        // A2A: groups all messages in this task lifecycle
  assignedBy       String   @map("assigned_by")        // Who created it (tamir or ceo)
  department       String?
  description      String                              // CEO's original request
  status           String   @default("submitted")      // Standard A2A states ONLY (see below)
  referenceTaskIds String   @default("[]") @map("reference_task_ids")  // JSON: linked parent/child tasks
  sessionId        String?  @map("session_id")         // SDK session ID for resume
  planningAgentId  String?  @map("planning_agent_id")  // Dept head that planned with the CEO
  executorAgentId  String?  @map("executor_agent_id")  // Agent currently executing approved work
  supervisorAgentId String? @map("supervisor_agent_id") // Agent responsible for review/closure
  currentActorId   String?  @map("current_actor_id")   // Who is expected to act next

  // Plan fields (populated during planning)
  planDocument     String?  @map("plan_document")      // Markdown plan
  deliverableType  String?  @map("deliverable_type")   // report, code, video, etc.
  autonomyLevel    String   @default("balanced") @map("autonomy_level")
  maxBudgetCents   Int      @default(1000) @map("max_budget_cents")  // Default $10 (1000 cents)
  constraints      String?
  selectedTools    String   @default("[]") @map("selected_tools")   // JSON: CEO tool hints
  selectedSkills   String   @default("[]") @map("selected_skills")  // JSON: CEO skill hints
  // NOTE: chatHistory is stored on FILESYSTEM as JSONL, not in this table.
  // Planning chat: data/departments/{dept}/planning-desk/chat/{taskId}.jsonl
  // Task chat:     data/departments/{dept}/tasks/{slug}/chat.jsonl
  artifactHistory  String   @default("[]") @map("artifact_history") // JSON: persisted task artifacts/events used by UI + replay

  // Execution fields (populated when task is approved and running)
  workspacePath    String?  @map("workspace_path")     // Filesystem: task root (contains desk/ + deliverables/)
  deskPath         String?  @map("desk_path")          // Filesystem: agent's working directory
  deliverablesPath String?  @map("deliverables_path")  // Filesystem: CEO-visible outputs
  taskSlug         String?  @map("task_slug")          // URL-friendly name for filesystem

  // Review fields (review happens in 'working' state with currentActorId = supervisor)
  reviewFeedback   String?  @map("review_feedback")    // Supervisor feedback text
  reviewRound      Int      @default(0) @map("review_round")  // Increments each review cycle

  // Task metadata (JSON: inputType for input-required, failureReason, etc.)
  metadata         String   @default("{}") @map("metadata")

  // Cost tracking
  totalCostUsd     Float    @default(0) @map("total_cost_usd")  // Accumulated from SDK cost tracking
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")
  approvedAt       DateTime? @map("approved_at")       // Set when CEO approves plan. NULL = still planning.
  completedAt      DateTime? @map("completed_at")      // Set when task reaches terminal state.

  // Relations
  taskRuns         TaskRun[]
  deliverables     Deliverable[]
  hireRequests     HireRequest[]
  costEvents       CostEvent[]
  activityLogs     ActivityLog[]

  @@index([department])
  @@index([status])
  @@index([currentActorId])
  @@map("tasks")
}

// Lifecycle stage is derived (NOT stored as a field):
// - Planning:  approvedAt IS NULL
// - Execution: approvedAt IS NOT NULL AND completedAt IS NULL
// - Review:    same as execution, but currentActorId === supervisorAgentId
// - Done:      completedAt IS NOT NULL OR status IN (completed, failed, canceled)

model TaskRun {
  id           String   @id
  taskId       String   @map("task_id")
  task         Task     @relation(fields: [taskId], references: [taskId])
  status       String   @default("queued") // queued | executing | completed | failed | canceled
  startedAt    DateTime? @map("started_at")
  heartbeatAt  DateTime? @map("heartbeat_at")
  completedAt  DateTime? @map("completed_at")
  errorMessage String?  @map("error_message")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@index([taskId])
  @@map("task_runs")
}

// Task status values (standard A2A states ONLY -- no custom extensions):
// submitted       -- Tamir routed, dept head not yet engaged
// working         -- Agent actively planning, executing, OR reviewing
// input-required  -- Agent needs CEO clarification, hire approval, or budget increase
// completed       -- Supervisor approved deliverable, task done
// failed          -- Unrecoverable error OR agent determined task not feasible
// canceled        -- CEO or Tamir canceled

// ── 3. Deliverables ──

model Deliverable {
  id           String   @id
  taskId       String?  @map("task_id")
  task         Task?    @relation(fields: [taskId], references: [taskId])
  creator      String
  department   String?
  type         String?  // report | script | brief | code | analysis | plan
  format       String   @default("markdown")
  filePath     String?  @map("file_path") // Path to task WORKSPACE ROOT (contains both desk/ and deliverables/)
  primaryFile  String?  @map("primary_file") // Relative path to the main file rendered in the Deliverable tab
  content      String?                     // Summary/excerpt for display (not full content -- files are on filesystem)
  metadata     String   @default("{}") // JSON: title, source, chat_history, config, deliverable manifest metadata
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("deliverables")
}

// ── 4. Activity Log ──

model ActivityLog {
  id          Int      @id @default(autoincrement())
  agentId     String   @map("agent_id")
  taskId      String?  @map("task_id")
  task        Task?    @relation(fields: [taskId], references: [taskId])
  actionType  String   @map("action_type")
  description String?
  metadata    String   @default("{}") // JSON
  timestamp   DateTime @default(now())

  @@index([taskId])
  @@index([agentId])
  @@map("activity_log")
}

// ── 5. Hire Requests ──

model HireRequest {
  id              String   @id
  taskId          String   @map("task_id")
  task            Task     @relation(fields: [taskId], references: [taskId])
  requestedBy     String   @map("requested_by")
  name            String
  role            String
  department      String
  specialty       String?
  taskDescription String?  @map("task_description")
  empType         String   @default("temp") @map("emp_type")
  status          String   @default("pending") // pending | approved | rejected
  reviewedBy      String?  @map("reviewed_by")
  reviewNote      String?  @map("review_note")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@index([taskId])
  @@index([status])
  @@map("hire_requests")
}

// ── 6. Cost Events ──

model CostEvent {
  id           Int      @id @default(autoincrement())
  agentId      String   @map("agent_id")
  taskId       String?  @map("task_id")
  task         Task?    @relation(fields: [taskId], references: [taskId])
  modelId      String   @map("model_id")   // 'sdk-managed' -- SDK chooses model
  inputTokens  Int      @default(0) @map("input_tokens")
  outputTokens Int      @default(0) @map("output_tokens")
  costCents    Float    @default(0) @map("cost_cents")  // From SDK's total_cost_usd * 100
  timestamp    DateTime @default(now())

  @@index([taskId])
  @@map("cost_events")
}

// ── 7. Skills (metadata cache -- filesystem is source of truth) ──

model Skill {
  skillId     String   @id @map("skill_id")
  name        String
  description String
  category    String
  config      String?  // JSON
  exampleUsage String? @map("example_usage")
  tags        String   @default("")
  department  String
  createdBy   String   @map("created_by")
  approvedBy  String?  @map("approved_by")
  isBaseSkill Boolean  @default(false) @map("is_base_skill")
  isGlobal    Boolean  @default(false) @map("is_global")
  status      String   @default("pending") // pending | pending_ceo | active | deprecated
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("skills")
}

// ── 8. MCP Servers ──

model McpServer {
  serverId    String   @id @map("server_id")
  name        String
  description String?
  transport   String   @default("stdio")
  config      String   // JSON
  department  String?
  skillId     String?  @map("skill_id")
  status      String   @default("active")
  installedAt DateTime @default(now()) @map("installed_at")

  @@map("mcp_servers")
}

// ── 9. Documents (Vault + Knowledge Index + Task Index) ──
// This table stores METADATA + ESSENCE, not full content.
// Full content lives on the filesystem at filePath.
// FTS5 indexes the essence for search.

model Document {
  // FTS5 requires a stable integer rowid. Prisma string @id creates a separate rowid
  // that is NOT stable across REPLACE operations. We add an explicit integer `seq`
  // column and use it as the FTS5 content_rowid.
  seq        Int      @unique @default(autoincrement())  // Stable rowid for FTS5
  docId      String   @id @map("doc_id")
  title      String
  essence    String                      // Short summary/extract for FTS5 indexing (NOT full content)
  filePath   String   @map("file_path")  // Filesystem path to full document
  source     String   @default("vault")  // vault | knowledge | task_deliverable
  department String?
  tags       String   @default("")
  filedBy    String?  @map("filed_by")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@map("documents")
}
```

## Database Usage Guide: Who Writes What

This section is the canonical reference for understanding every DB write in the system. If you're implementing a handler and need to know "what tables does this touch?", look here.

### Write Map

```
CEO (via Cortex UI)
  ├─► tasks         (config, approve, cancel)
  ├─► hire_requests (approve/reject)
  └─► skills        (approve/dismiss)

Tamir Agent
  ├─► tasks         (create on route, state transitions)
  ├─► activity_log  (invocation logged)
  └─► cost_events   (SDK cost tracked)

Dept Head Agent (CTO/CMO/COO)
  ├─► tasks         (state transitions, review decisions)
  ├─► hire_requests (create via hire_employee tool)
  ├─► documents     (write_knowledge, file_to_vault)
  ├─► skills        (propose_skill)
  ├─► activity_log
  └─► cost_events

Temp Employee Agent (SDK subagent)
  ├─► documents     (promote_to_deliverable)
  ├─► skills        (propose_skill)
  ├─► activity_log
  └─► cost_events

System (automated background)
  ├─► task_runs     (queue, claim, heartbeat, complete/fail)
  ├─► tasks         (transitionTask on behalf of tools)
  ├─► employees     (create temp on hire, terminate on task end)
  ├─► deliverables  (create on plan approval)
  ├─► documents     (startup indexing of knowledge/ dirs)
  └─► activity_log  (STATE_TRANSITION entries)
```

### What Is NOT in the Database

The DB is a **state machine + search index**. Heavy content lives on the **filesystem**:

| Data | Where It Lives | Why Not DB |
|------|---------------|------------|
| Chat history | JSONL files: `planning-desk/chat/{taskId}.jsonl`, `tasks/{slug}/chat.jsonl` | Append-only, no queries needed |
| Agent memory | `data/agents/{id}/MEMORY.md` | Agent-owned file, accessed via read/write_memory tools |
| Task plan + constraints | `desk/CLAUDE.md` | SDK loads from CWD automatically |
| Skill content + scripts | `data/departments/{dept}/skills/{name}/SKILL.md` + supporting files | Directories with code don't fit in DB; filesystem is source of truth |
| Knowledge files (full content) | `data/departments/{dept}/knowledge/*.md` | DB stores only essence + path for FTS5 search |
| Deliverable files | `data/departments/{dept}/tasks/{slug}/deliverables/` | Binary/large files don't belong in SQLite |
| Tamir inbox | `data/agents/tamir/inbox.jsonl` | Simple append-only, file-locked |
| Agent sessions | SDK-managed internally | SDK handles via `session_id` stored on task record |

### Table Summary (9 tables total)

| # | Table | Purpose | Primary Writers |
|---|-------|---------|-----------------|
| 1 | `employees` | Agent registry (permanent + temp) | Seed, hire approval, system |
| 2 | `tasks` | Central task lifecycle (planning → execution → review → done) | Every API handler, every tool |
| 3 | `task_runs` | Durable job queue for background execution | Approve handler, worker loop |
| 4 | `deliverables` | CEO-visible task outputs | Approve handler, promote_to_deliverable tool |
| 5 | `hire_requests` | Temp employee hiring workflow | hire_employee tool, CEO approval |
| 6 | `cost_events` | LLM spending per agent per task | invokeAgent() after each query() |
| 7 | `skills` | Metadata cache for skill registry (filesystem is truth) | propose_skill tool, approval APIs |
| 8 | `mcp_servers` | Registry of connected MCP tool servers | Seed/admin, tool search API |
| 9 | `documents` | Searchable index (essence + path) for vault, knowledge, deliverables | Tools, startup indexer |
| -- | `documents_fts` | FTS5 virtual table (auto-synced via triggers) | Triggers on documents table |
| -- | `activity_log` | Append-only audit trail of all actions | Every handler, every tool, system |

## FTS5 Full-Text Search (Essence + Path, Not Full Content)

FTS5 indexes the `essence` field (a summary/extract of each document), NOT the full content. The full document lives on the filesystem at `filePath`. When an agent searches, they get the essence + path, then use `read_knowledge` to load the full content if needed.

**Why essence, not full content?**
- Keeps the SQLite DB small and fast
- FTS5 works better on concise summaries than raw multi-page documents
- Agent can decide whether to read the full file based on the essence
- Documents are the filesystem, not the database -- DB is a smart searchable index

**Implementation tradeoff**: v10 stays with Prisma + raw SQL for FTS5 because the rest of the data model benefits from Prisma's type safety and migration workflow. If FTS5 ergonomics become a major pain point later, `better-sqlite3` is a reasonable v10.1+ alternative to evaluate, but it is not the canonical v10 choice.

```typescript
// src/db/fts.ts

export async function initFTS(prisma: PrismaClient) {
  // Use the explicit `seq` column as content_rowid (stable integer, unlike implicit rowid
  // which is unreliable with Prisma's string @id and INSERT OR REPLACE)
  await prisma.$executeRawUnsafe(`
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      title, essence, tags,
      content='documents',
      content_rowid='seq',
      tokenize='porter unicode61'
    );
  `);

  // Sync triggers -- use new.seq / old.seq (our stable integer column)
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS docs_ai AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(rowid, title, essence, tags) VALUES (new.seq, new.title, new.essence, new.tags);
    END;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS docs_au AFTER UPDATE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, essence, tags) VALUES ('delete', old.seq, old.title, old.essence, old.tags);
      INSERT INTO documents_fts(rowid, title, essence, tags) VALUES (new.seq, new.title, new.essence, new.tags);
    END;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS docs_ad AFTER DELETE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, essence, tags) VALUES ('delete', old.seq, old.title, old.essence, old.tags);
    END;
  `);
}

/**
 * Index a knowledge file: reads the file, generates a 2-3 sentence essence, stores path + essence in DB.
 */
export async function indexKnowledgeFile(prisma: PrismaClient, dept: string, filename: string) {
  const filePath = join('data/departments', dept, 'knowledge', filename);
  const content = readFileSync(filePath, 'utf-8');
  const title = filename.replace('.md', '').replace(/-/g, ' ');
  const docId = `knowledge_${dept}_${filename.replace('.md', '')}`;

  // Generate essence: first 3 meaningful lines + total line count
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const essence = lines.slice(0, 3).join(' ').substring(0, 300) + ` [${content.split('\n').length} lines total]`;

  await prisma.$executeRawUnsafe(
    `INSERT OR REPLACE INTO documents (doc_id, title, essence, file_path, source, department, tags, filed_by)
     VALUES (?, ?, ?, ?, 'knowledge', ?, 'knowledge', 'system')`,
    docId, title, essence, filePath, dept
  );
}

/**
 * Index a task deliverable file after promotion.
 */
export async function indexTaskDeliverable(prisma: PrismaClient, taskId: string, dept: string, taskSlug: string, filename: string) {
  const filePath = join('data/departments', dept, 'tasks', taskSlug, 'deliverables', filename);
  const content = readFileSync(filePath, 'utf-8');
  const title = `[Task: ${taskSlug}] ${filename.replace(/\.(md|txt)$/, '')}`;
  const docId = `task_${taskId}_${filename.replace(/\.(md|txt)$/, '')}`;

  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const essence = lines.slice(0, 3).join(' ').substring(0, 300) + ` [${content.split('\n').length} lines]`;

  await prisma.$executeRawUnsafe(
    `INSERT OR REPLACE INTO documents (doc_id, title, essence, file_path, source, department, tags, filed_by)
     VALUES (?, ?, ?, ?, 'task_deliverable', ?, ?, 'system')`,
    docId, title, essence, filePath, dept, `task,${taskSlug}`
  );
}

/**
 * Search across all indexed content. Returns essence + path (not full content).
 * Agent uses read_knowledge to load full content if needed.
 */
export async function searchDocuments(prisma: PrismaClient, query: string, options?: {
  source?: string; department?: string; limit?: number;
}) {
  const limit = options?.limit || 10;
  const ftsQuery = query.split(/\s+/).filter(w => w.length > 2).map(w => `"${w}"`).join(' OR ');
  if (!ftsQuery) return [];

  let sql = `
    SELECT d.doc_id, d.title, d.department, d.source, d.file_path, d.filed_by, d.created_at,
           snippet(documents_fts, 1, '<mark>', '</mark>', '...', 32) as excerpt
    FROM documents_fts
    JOIN documents d ON d.seq = documents_fts.rowid
    WHERE documents_fts MATCH ?
  `;
  const params: any[] = [ftsQuery];

  if (options?.source) { sql += ` AND d.source = ?`; params.push(options.source); }
  if (options?.department) { sql += ` AND d.department = ?`; params.push(options.department); }

  sql += ` ORDER BY bm25(documents_fts) LIMIT ?`;
  params.push(limit);

  return prisma.$queryRawUnsafe(sql, ...params);
}
```

### What Gets Indexed

| Source | Indexed When | source Column | Essence Contains |
|--------|-------------|---------------|-----------------|
| Vault docs (incl. Company DNA) | On file via `file_to_vault` tool | `vault` | Summary + path |
| Department knowledge | On write via `write_knowledge` + at startup | `knowledge` | First 3 lines + line count + path |
| Task deliverables | When promoted via `promote_to_deliverable` | `task_deliverable` | First 3 lines + line count + path |

### Company DNA in Vault

Company DNA is stored as a vault document (NOT a hardcoded JSON file). It's filed during initial setup and searchable via FTS5:

```typescript
// During first boot / seed
await prisma.$executeRawUnsafe(
  `INSERT OR REPLACE INTO documents (doc_id, title, essence, file_path, source, department, tags, filed_by)
   VALUES ('company_dna', 'Company DNA - Myelin Organization',
   'Myelin is a neurotech startup: The Plaid of Brain Data. BDaS product. Departments: Tech (CTO), Marketing (CMO), Operations (COO). Pre-seed stage.',
   'data/vault/company-dna.md', 'vault', NULL, 'company,dna,organization', 'system')`
);
```

Tamir loads Company DNA via `search_knowledge(query='company organization departments', scope='vault')` for routing decisions.

## Deliverable Manifest (Canonical)

Every approved task workspace must contain a `deliverable_manifest.json` file in the `deliverables/` directory (e.g., `data/departments/tech/tasks/slug/deliverables/deliverable_manifest.json`).

Ownership rule:

- `createTaskWorkspace()` creates an initial stub manifest at approval time
- `promote_to_deliverable` creates or updates the manifest whenever a file is promoted
- `submit_for_review` validates that the manifest exists and that `primaryFile` is set

Initial stub example:

```json
{
  "version": 1,
  "title": "Pending Deliverable",
  "primaryFile": null,
  "previewText": "",
  "deliverableFiles": [],
  "workingFiles": []
}
```

Final example:

```json
{
  "version": 1,
  "title": "ZUNA EEG Evaluation",
  "primaryFile": "deliverables/report.md",
  "previewText": "Technical evaluation of the ZUNA EEG model on internal recordings.",
  "deliverableFiles": [
    "deliverables/report.md",
    "deliverables/confusion_matrix.png"
  ],
  "workingFiles": [
    "desk/scripts/train.py",
    "desk/raw-data/metrics.csv"
  ]
}
```

This manifest is the source of truth for:

- the Deliverable tab's primary rendered file
- gallery preview text and title
- the Files tab grouping between CEO-visible outputs and working files
- the `primaryFile` stored on the `Deliverable` record

## CEO Tool/Skill Hints During Execution

`selectedTools` and `selectedSkills` are not passive storage only. At execution start, they must be injected into the executor's context in one of two canonical ways:

1. appended to `desk/CLAUDE.md` under a `## CEO Hints` section
2. included in `extraSystemPrompt` for the execution invocation

The executor should see them as suggestions, not mandatory instructions.

## Seed Data

```typescript
// prisma/seed.ts
// Only 4 executive agents. All other workers are hired dynamically as temp employees.
const executives = [
  { agentId: 'tamir', name: 'Tamir', role: 'cos', type: 'permanent', department: null, reportsTo: null },
  { agentId: 'cto', name: 'CTO', role: 'cto', type: 'permanent', department: 'tech', reportsTo: 'tamir' },
  { agentId: 'cmo', name: 'CMO', role: 'cmo', type: 'permanent', department: 'marketing', reportsTo: 'tamir' },
  { agentId: 'coo', name: 'COO', role: 'coo', type: 'permanent', department: 'operations', reportsTo: 'tamir' },
];
```

## ID Generation

```typescript
import { randomBytes } from 'crypto';
export function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}
```
