# 15 -- Memory Architecture: How Agents Remember, Learn, and Compound Value

## Overview

An autonomous company that forgets everything between tasks cannot compound value. Each task would start from zero -- the CTO would not know what it built last week, the CMO would not remember the brand guidelines it established, and Tamir would not remember how the CEO likes to communicate.

Myelin's memory architecture solves this by giving each agent tier access to appropriate forms of persistent memory, with different trust levels, storage mechanisms, and automation. The design principle: **Tamir gets curated, bounded, security-scanned memory injected into every prompt. Department heads get self-managed journals. Temp employees get ephemeral access with minimal persistent state.**

This document covers the full memory landscape -- from Tamir's bounded COS files to the knowledge system, vault, skills as procedural memory, shared library, and asset compounding. It ties together what Docs 02, 08, 13, and 14 cover individually.

## Memory Tiers by Agent Type

### Tamir (Chief of Staff)

Tamir's memory is the most sophisticated: three bounded files in the COS directory (`data/cos/`), managed by the `MemoryStore` class with character limits, security scanning, frozen snapshots for prefix cache stability, and automatic background review.

**Storage:** `data/cos/MEMORY.md` (2,200 chars), `data/cos/USER.md` (1,375 chars), `data/cos/COMPANY.md` (3,000 chars)

**Tool:** A single `memory` MCP tool with `add`, `replace`, `remove` actions and three targets (`memory`, `user`, `company`). All writes go through MemoryStore with security scanning and char limit enforcement.

**System prompt injection:** All three files are loaded at session start via `formatForSystemPrompt()`, which returns a frozen snapshot. The snapshot never changes mid-session, keeping the prefix cache stable and LLM costs predictable.

**Automatic updates:**
- COMPANY.md: Programmatic refresh after every task completion + daily LLM consolidation (see Doc 14)
- MEMORY.md / USER.md: Background memory review agent fires after sessions with 3+ CEO turns, reads the JSONL chat transcript, extracts preferences and conventions

**Filesystem boundary:** Tamir's effective boundary is the entire `data/` directory, not just the COS directory. This allows Tamir to install skills, manage tools, and access any department's resources.

For full COMPANY.md details, see Doc 14.

### Department Heads (CTO, CMO, COO)

Department heads have simpler but unlimited memory. They manage their own journals through standard `read_memory` and `write_memory` MCP tools.

**Storage:** `data/agents/{agentId}/MEMORY.md` -- one file per agent, no character limit

**Tools:**
- `read_memory` -- Read the agent's MEMORY.md file. Read-only hint allows SDK optimizations.
- `write_memory` -- Full-replacement write of MEMORY.md content. Takes the complete new content as a string parameter.

**No security scanning.** Department head memory is not injected into system prompts, so prompt injection risk is lower. The trade-off is that a compromised memory file could influence the department head's behavior if they read it at task start -- but this is accepted because department heads are trusted agents.

**No automatic injection.** Unlike Tamir, department heads must explicitly call `read_memory` at the start of a task to recall their context. The memory is not automatically included in the system prompt.

**Structured journal format (by convention, not enforced):**
- Recent Projects -- what was built recently
- Company Conventions -- patterns and standards learned
- Goals -- current objectives
- Notes -- miscellaneous operational context

**Additional tools (dept heads + Tamir):**
- `approve_deliverable`, `request_changes` -- task review
- `hire_employee` -- provision temp workers
- `file_to_vault` -- promote documents to company vault
- `update_asset_health`, `add_asset_event`, `link_asset_dependency` -- asset stewardship

### Temp Employees

Temp employees are the most restricted tier. They are dynamically hired for specific tasks and dismissed after completion. Their memory access reflects this ephemeral role.

**Storage:** Same as department heads (`data/agents/{agentId}/MEMORY.md`), but in practice rarely used across sessions since temp employees are short-lived.

**Tools (whitelist-only):**
- `read_memory`, `write_memory` -- basic journal access
- `read_knowledge`, `search_knowledge` -- can consume knowledge
- `promote_to_deliverable` -- can produce deliverables
- `propose_skill` -- can propose new skills (requires approval chain)
- `submit_for_review` -- submit work to supervisor
- `install_tool`, `install_skill` -- self-serve capability additions
- `suggest_asset_promotion` -- can suggest (not execute) asset promotion

**Cannot use:** vault tools, inbox, department status, hiring, approval, asset health/event/dependency tools.

### Tier Comparison

| Capability | Tamir | Dept Heads | Temp Employees |
|-----------|-------|-----------|----------------|
| Memory storage | COS directory (3 files) | `data/agents/{id}/MEMORY.md` | `data/agents/{id}/MEMORY.md` |
| Char limits | 2,200 / 1,375 / 3,000 | None | None |
| Security scanning | Yes (14 threat patterns) | No | No |
| System prompt injection | Automatic (frozen snapshot) | Manual (must call read_memory) | Manual |
| Background updates | Memory review + company refresh | None | None |
| Filesystem boundary | Entire `data/` directory | Task workspace only | Task workspace only |
| Vault access | Yes | Yes | No |
| Knowledge access | Yes | Yes | Read + search only |
| Asset management | Yes | Yes | Suggest only |
| Hiring | No (CEO function) | Yes | No |

## Knowledge System

Knowledge is the department-level reference material that agents produce and consume during task execution. Unlike memory (personal notes) and vault (company-level reference), knowledge lives within department boundaries.

**Storage:** `data/departments/{dept}/knowledge/`

**Tools:**
- `read_knowledge` -- read a specific knowledge file
- `write_knowledge` -- create or update a knowledge file. File-locked and auto-upserted into the `documents` table for FTS5 indexing.
- `search_knowledge` -- search ALL indexed documents (knowledge + vault + deliverables) via FTS5 with Porter stemming, Unicode61 tokenizer, and BM25 ranking

**Indexing:** When `write_knowledge` creates or updates a file, it automatically upserts a row in the `documents` SQLite table with `source: 'knowledge'`. This makes the content searchable via FTS5 alongside vault documents and deliverables.

**Cross-department search:** `search_knowledge` is not department-scoped. It searches the global `documents_fts` virtual table, which indexes all knowledge, vault, and deliverable documents. An agent in the tech department can find marketing knowledge if the search terms match.

**Access:** All agent tiers can read and search knowledge. Only department heads and Tamir can write knowledge (enforced by access control).

## Skills as Procedural Memory

While knowledge and memory store declarative information (facts, conventions, preferences), skills represent procedural memory -- learned procedures that agents can follow when performing specific types of work. A skill is essentially a recipe that persists across sessions.

**Storage:**
- Global skills: `data/departments/global/skills/{skill-name}/SKILL.md`
- Department skills: `data/departments/{dept}/skills/{skill-name}/SKILL.md`

**Workspace linkage:** When a task workspace is created, skills are symlinked into the desk at `desk/.claude/skills/{dept}/` and `desk/.claude/skills/global/`. The Claude Agent SDK discovers these automatically via its built-in skill loading mechanism.

**Proposal flow:**
1. Any agent calls `propose_skill` -- creates the skill directory + DB record with status `pending`
2. Inbox notification sent to Tamir
3. Department head reviews and approves
4. CEO gives final approval
5. Skill becomes `active` and available to all agents in scope

**Active global skills (available to all agents):**
- `memory-management` -- how to maintain personal memory effectively
- `agent-browser` -- web browsing patterns
- `skill-approval` -- how to evaluate skill proposals
- `skill-extractor` -- how to extract skills from task executions
- `system-reset` -- recovery procedures
- `tool-approval` -- how to evaluate tool installation requests

**COS-specific skills (Tamir only):**
- `installer` -- how to install tools and skills
- `skill-creator` -- how to create well-formed skills
- `skill-tool-manager` -- managing the skill/tool ecosystem

For full skill and tool details, see Doc 08.

## Vault

The vault is the company's outward-facing reference library -- documents that represent what the company is, what it knows, and what it has decided. Unlike knowledge (inward-facing, operational), vault documents are curated company reference material.

**Storage:** `data/vault/`

**Tool:** `file_to_vault` -- copies a file into the vault and indexes it in the `documents` table (source: `'vault'`). Available to department heads and Tamir only.

**First-boot behavior:** On server startup, any unindexed `.md` files in the vault are scanned and indexed. Additionally, `company-dna.template.md` is copied to the vault on first boot as the foundational company document.

**Searchable:** Vault documents are indexed in the same FTS5 table as knowledge and deliverables, so `search_knowledge` finds them.

**Key distinction:** Vault = what the company IS (DNA, brand, reference). Knowledge = what agents KNOW (operational, department-scoped).

## Shared Library and Data Catalog

Each department has a shared library (`data/departments/{dept}/sharedlib/`) that holds files with provenance tracking. This is the department's curated data repository -- deliverables that have been ingested, reference data, and shared assets.

**Provenance sidecars:** Every file in the shared library has a `.meta.json` sidecar containing:

```json
{
  "filename": "report.md",
  "addedBy": "cto",
  "addedAt": "2026-04-01T10:00:00Z",
  "sourceTaskId": "task_abc123",
  "description": "Quarterly technology review",
  "location": "local",
  "contentHash": "sha256:..."
}
```

**DATA_CATALOG.md:** The `compileCatalog()` function in `src/lib/catalog.ts` generates a markdown index for each department's shared library. It includes per-file metadata and a 200-character content preview. Compilation is incremental -- it detects changes via `<!-- hash:abc123 -->` comments embedded in the catalog and only reprocesses new or modified files.

**Daily recompile:** A `setInterval` in `src/instrumentation.ts` triggers periodic catalog recompilation to keep indexes current.

**Deliverable ingestion:** When a deliverable is completed and worth sharing, `ingestDeliverable()` copies it to the department's shared library with a provenance sidecar. Filename conflicts are handled by appending a timestamp.

**Workspace linkage:** Each task workspace gets the department's `sharedlib/` symlinked at `desk/sharedlib/`, giving the executing agent read access to department data.

**Google Drive support:** Sidecars support `location: 'gdrive'` with optional `driveUrl` and `driveFileId` fields for files stored externally.

## Asset Compounding

Assets are the highest tier of persistent value in the system. When a deliverable proves worth keeping -- a logo, a codebase, an IP document, a digital product -- the CEO promotes it to an asset. Assets have their own lifecycle, health tracking, and stewardship model that feeds back into COMPANY.md.

**Promotion:** CEO-initiated via the UI. Creates an asset record and a local git repository at `data/assets/{assetId}/`.

**Branch isolation:** Each task that works on an asset gets its own branch (`task-{taskId}`). On completion, the branch is merged. This prevents concurrent tasks from conflicting.

**Stewardship:** Department heads can be invoked in "steward mode" with extra asset context and specialized tools (`update_asset_health`, `add_asset_event`, `link_asset_dependency`). Stewardship assessments are recorded as asset events.

**Asset events audit trail:** Every significant action on an asset is recorded: `steward_assessment`, `deliverable_absorbed`, `health_change`, `dependency_added`.

**Dependency graph:** Assets can declare dependencies on other assets via `link_asset_dependency`. A recursive CTE query enables ripple-chain analysis -- if asset A depends on asset B, and B's health degrades, the system can trace the impact.

**FTS5 search:** Assets have their own `assets_fts` virtual table with Porter stemming for full-text search.

**COMPANY.md feedback loop:** Asset health (`healthy`, `needs-attention`, `critical`) appears in COMPANY.md entries via the `AST-` prefix. The programmatic refresh (Tier 1 of the two-tier update cycle) picks up asset changes automatically.

For the full asset system, see Doc 13.

## How It All Connects

The following diagram shows how information flows from task execution through the memory architecture:

```
                          TASK EXECUTION
                               |
                               v
                    +---------------------+
                    |    Deliverable       |
                    |  (task output file)  |
                    +---------------------+
                       |            |
            +----------+            +------------+
            v                                    v
  +-------------------+                +-----------------+
  | Shared Library    |                | CEO Promotes?   |
  | (sharedlib/ +     |                |   (manual)      |
  |  .meta.json)      |                +-----------------+
  +-------------------+                        |
            |                                  v
            v                         +-----------------+
  +-------------------+               |     Asset       |
  | DATA_CATALOG.md   |               | (git repo +     |
  | (auto-compiled)   |               |  stewardship)   |
  +-------------------+               +-----------------+
                                               |
                                               v
                    +---------------------+----+----+
                    |                     |         |
                    v                     v         v
          +----------------+    +-----------+  +----------+
          | Knowledge      |    | Vault     |  | DB rows  |
          | (dept-scoped)  |    | (company) |  | (assets, |
          +----------------+    +-----------+  | delivs,  |
                    |                |         | docs)    |
                    +--------+-------+         +----------+
                             |                      |
                             v                      v
                    +------------------+   +------------------+
                    | FTS5 Index       |   | COMPANY.md       |
                    | (search_knowledge|   | (Tier 1: refresh |
                    |  searches all)   |   |  after task_run) |
                    +------------------+   +------------------+
                                                    |
                                                    v
                                           +------------------+
                                           | Tamir System     |
                                           | Prompt (frozen   |
                                           | snapshot)        |
                                           +------------------+
                                                    |
                                                    v
                                           +------------------+
                                           | Tamir routes     |
                                           | next task with   |
                                           | company context  |
                                           +------------------+
```

**The compounding loop:** Task output becomes a deliverable. Important deliverables get promoted to assets. Assets, deliverables, and knowledge documents are indexed and searchable. COMPANY.md aggregates the top items from each category. Tamir receives this aggregation in every session, informing routing and planning decisions. Those decisions create new tasks, which produce new deliverables -- and the cycle continues.

**Memory feeds forward:** An agent writes a convention to its MEMORY.md today. Tomorrow, it reads that memory at task start and follows the convention. A CEO preference captured in USER.md shapes how Tamir communicates in every future session. A skill extracted from one task becomes a procedure available to all agents in future tasks.

This is how an autonomous company with ephemeral agent sessions builds institutional knowledge over time.

---

**Source files:** `src/lib/memory-store.ts`, `src/lib/company-refresh.ts`, `src/lib/memory-review.ts`, `src/lib/catalog.ts`, `src/lib/mcp/tools/memory.ts`, `src/lib/mcp/access-control.ts`
**Related docs:** Doc 02 (Agent System), Doc 08 (Tools/Skills/MCP), Doc 13 (Assets System), Doc 14 (COMPANY.md System)
