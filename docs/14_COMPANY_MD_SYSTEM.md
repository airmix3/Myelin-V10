# 14 -- COMPANY.md System: Bounded Company State for Tamir

## Overview

Tamir, the Chief of Staff, needs to know what the company has done recently -- which deliverables were completed, which assets exist and how healthy they are, and what knowledge documents are in the vault. But Tamir is an LLM agent. Every token of context costs money and competes with the actual task at hand. Feeding Tamir the full database on every invocation would be wasteful and slow.

COMPANY.md is the solution: a single bounded file at `data/cos/COMPANY.md` that holds a compressed snapshot of company state. It is injected into Tamir's system prompt at session start and stays frozen for the duration of that session. The file has a hard 3,000-character limit enforced by MemoryStore, which means it can never grow beyond what fits comfortably in a system prompt.

The file is one of three bounded memory files that form Tamir's persistent state, collectively stored in the COS (Company Operating State) directory.

## The COS Directory

The COS directory (`data/cos/`) is Tamir's persistent brain. It contains three bounded memory files, each with a different purpose and character limit:

| File | Path | Char Limit | Purpose |
|------|------|-----------|---------|
| MEMORY.md | `data/cos/MEMORY.md` | 2,200 | Tamir's operational notes: routing patterns, tool quirks, conventions, lessons learned |
| USER.md | `data/cos/USER.md` | 1,375 | CEO profile: name, preferences, communication style, decision patterns |
| COMPANY.md | `data/cos/COMPANY.md` | 3,000 | Company state: recent deliverables, assets, knowledge documents |

These limits are defined as constants in `src/lib/memory-store.ts`:

```typescript
export const MEMORY_CHAR_LIMIT = 2200;
export const USER_CHAR_LIMIT = 1375;
export const COMPANY_CHAR_LIMIT = 3000;
```

Character limits (not token limits) are used because char counts are model-independent. The combined budget (~6,575 chars) is small enough to sit in a system prompt without meaningful cost impact, but large enough to hold operationally useful context.

The COS directory also contains Tamir's chat history (`chat/`), planning desk, manager desk, shared library, skills, and tools -- but the three `.md` files are the bounded memory system.

## Entry Format

COMPANY.md uses a flat, delimiter-separated format designed for both machine parsing and LLM readability. Entries are separated by the section sign character:

```
\n\u00A7\n    (newline, section sign, newline)
```

Each entry is a one-line summary with a prefixed ID that identifies the source type:

```
DEL-{id}: {title} | {agent} | {status} | updated {relative_time}
AST-{id}: {title} | {healthStatus} | updated {relative_time}
DOC-{id}: {title} | {source} | updated {relative_time}
```

A live example from a running system:

```
DEL-deliv_2a57ee5d: Create 20s investor vision video with AI avatar | cmo | completed | updated 3h ago
(section sign)
AST-asset_ce1168fa: SVG logo for Myelin | healthy | updated 2d ago
(section sign)
DOC-doc_f5a70969: Myelin Company DNA | vault | updated 2d ago
```

The prefix scheme (`DEL-`, `AST-`, `DOC-`) enables the programmatic refresh system to find and replace specific entries by prefix without ambiguity.

## MemoryStore

All three COS memory files are managed by the `MemoryStore` class (`src/lib/memory-store.ts`). This class enforces character limits, provides atomic file writes, scans for security threats, and implements the frozen snapshot pattern that keeps LLM costs predictable.

### Frozen Snapshot Pattern

When MemoryStore loads from disk (`loadFromDisk()`), it captures a frozen snapshot of the current entries. This snapshot is returned by `formatForSystemPrompt()` and injected into Tamir's system prompt at session start.

The snapshot is **never updated mid-session**. If Tamir adds, replaces, or removes entries during a conversation, those changes are written to disk immediately -- but the system prompt snapshot stays the same. This is intentional: the system prompt is part of the **prefix cache**. If it changed between turns, every turn would require reprocessing the entire prompt from scratch, dramatically increasing cost and latency.

The trade-off: Tamir cannot "see" memory changes made during the current session in the system prompt. Tool responses do reflect the live state, so Tamir gets feedback on writes -- but the frozen snapshot in the prompt remains stable.

```typescript
// loadFromDisk() captures the snapshot once
this.snapshot = this._renderBlock();

// formatForSystemPrompt() always returns the frozen snapshot
formatForSystemPrompt(): string | null {
  if (this.snapshot) return this.snapshot;
  const block = this._renderBlock();
  return block || null;
}
```

### Security Scanning

Every entry written to memory is scanned against 14 threat patterns before acceptance. This matters because memory entries are injected into the system prompt -- a compromised entry could hijack Tamir's behavior.

**Threat patterns (from source):**

| Category | Patterns | Pattern ID |
|----------|----------|------------|
| Prompt injection | "ignore previous instructions", "you are now", "do not tell the user" | `prompt_injection`, `role_hijack`, `deception_hide` |
| System prompt | "system prompt override", "disregard your instructions", "act as if you have no restrictions" | `sys_prompt_override`, `disregard_rules`, `bypass_restrictions` |
| Extraction | "reveal/show/display your system prompt/instructions" | `sys_prompt_extract` |
| Exfiltration | `curl` or `wget` with secret env vars, `cat` on credential files | `exfil_curl`, `exfil_wget`, `read_secrets` |
| Persistence | SSH authorized_keys, ~/.ssh access | `ssh_backdoor`, `ssh_access` |
| Data exfil | "send/transmit/exfiltrate to http/ftp/email" | `data_exfil` |

Additionally, content is checked for invisible Unicode characters (zero-width spaces, directional overrides, etc.) that could be used for injection attacks.

If any pattern matches, the write is rejected with a descriptive error. No partial writes occur.

### Atomic Writes

File writes use a temp-file-then-rename pattern for atomicity:

1. Write content to a temporary file in the same directory (`.mem_{timestamp}_{random}.tmp`)
2. `renameSync()` the temp file to the target path (atomic on same filesystem)
3. On failure, clean up the temp file

All write operations also use `proper-lockfile` for multi-process safety:

```typescript
const release = await lockfile.lock(this.filePath, {
  retries: { retries: 3, minTimeout: 100, maxTimeout: 1000 },
  stale: 10000,
});
```

This prevents corruption when multiple agent processes (e.g., a task completion and a consolidation run) attempt to update the same memory file concurrently.

### Operations

MemoryStore exposes three operations, all of which reload from disk before executing (to pick up changes from other processes) and hold a file lock during the operation:

| Operation | Behavior |
|-----------|----------|
| `add(content)` | Append a new entry. Rejects duplicates. Rejects if total would exceed char limit. |
| `replace(oldText, newContent)` | Find the entry containing `oldText` (substring match), replace it with `newContent`. Rejects if multiple distinct entries match (ambiguity). Rejects if replacement would exceed char limit. |
| `remove(oldText)` | Find and delete the entry containing `oldText` (substring match). Same ambiguity check as replace. |

All operations return a `MemoryResult` with success/failure status, current entries list, and usage statistics (e.g., "72% -- 2,160/3,000 chars").

## Two-Tier Update Cycle

COMPANY.md is kept current through two complementary mechanisms, implemented in `src/lib/company-refresh.ts`.

### Tier 1: Programmatic Event-Driven Refresh

After every `task_run` completion, the worker (`src/lib/worker.ts`) calls `refreshCompanyMemory()`. This function queries SQLite directly -- no LLM involved:

1. Fetch the 20 most recent deliverables (`ORDER BY updatedAt DESC LIMIT 20`)
2. Fetch the 15 most recent assets
3. Fetch the 15 most recent vault/knowledge documents
4. For each result, format a one-line entry with the appropriate prefix
5. Remove the old entry for that ID (if it exists), then add the new one

If the memory limit is reached during adds, remaining entries are skipped with a warning log. This ensures the file never exceeds its budget, even if the database has hundreds of deliverables.

Relative timestamps ("3h ago", "2d ago") are computed at refresh time by `formatRelativeTime()`, keeping entries readable without requiring the LLM to do date math.

### Tier 2: Daily Shadow Agent Consolidation

Once every 24 hours, a shadow Tamir agent is invoked to consolidate COMPANY.md. This is scheduled via `setInterval` in `src/instrumentation.ts` (not node-cron, to avoid the dependency).

The consolidation agent:

1. Calls `get_dept_status` for each department to understand current state
2. Uses `search_knowledge` to find recent knowledge entries
3. Reviews the current COMPANY.md entries
4. Rewrites the file to reflect current reality:
   - Removes completed/stale deliverables older than 7 days
   - Updates descriptions for clarity
   - Consolidates duplicate entries
   - Ensures the most important items stay within the 3,000 char budget

This is a fire-and-forget operation with a mutex guard (`activeConsolidation` flag) to prevent overlapping runs. Failures are logged but never block the system.

**Why two tiers?** Tier 1 keeps the data fresh in real-time (no LLM cost, no latency). Tier 2 keeps the data high-quality over time (pruning, deduplication, rewriting for usefulness). Neither alone is sufficient.

## Integration Points

### System Prompt Injection

When Tamir is invoked, the frozen snapshot from each MemoryStore is formatted with a header and injected into the system prompt:

```
══════════════════════════════════════════════
COMPANY STATE (deliverables, assets, knowledge) [72% -- 2,160/3,000 chars]
══════════════════════════════════════════════
DEL-deliv_2a57ee5d: Create 20s investor vision video...
(section sign)
AST-asset_ce1168fa: SVG logo for Myelin | healthy...
```

This gives Tamir awareness of company state without any tool calls at the start of every session.

### Tamir's Memory Tool

Tamir has a dedicated `memory` MCP tool (not the `read_memory`/`write_memory` used by department heads) with `add`, `replace`, and `remove` actions targeting `memory`, `user`, or `company`. All writes go through MemoryStore with security scanning and char limit enforcement. See Doc 08 for tool details.

### Asset System Connection

Asset health status (`healthy`, `needs-attention`, `critical`) appears in COMPANY.md entries via the `AST-` prefix. When assets are promoted, updated, or their health changes, the next Tier 1 refresh picks up the change. See Doc 13 for the full asset system.

### Memory Review

After Tamir sessions with 3+ CEO turns, a background review agent (`src/lib/memory-review.ts`) reads the conversation transcript and extracts CEO preferences and conventions into MEMORY.md and USER.md (not COMPANY.md -- that is handled by the programmatic refresh). See Doc 15 for the full memory architecture.

---

**Source files:** `src/lib/memory-store.ts`, `src/lib/company-refresh.ts`, `src/lib/memory-review.ts`
**Related docs:** Doc 02 (Agent System), Doc 08 (Tools/Skills/MCP), Doc 13 (Assets System), Doc 15 (Memory Architecture)
