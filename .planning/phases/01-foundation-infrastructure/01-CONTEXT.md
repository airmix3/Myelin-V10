# Phase 1: Foundation Infrastructure - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

A runnable Next.js application with correct SQLite configuration (WAL mode, Prisma + better-sqlite3), task state machine (6 A2A states), SSE event bus, worker loop, FTS5 full-text search, and project bootstrap files — the substrate every other component depends on.

Requirements covered: FOUND-01 through FOUND-11.

</domain>

<decisions>
## Implementation Decisions

### Company DNA Template

- **D-01:** Full company brief — not a minimal skeleton. The template ships with real content so agents have actual context from day one, not placeholders to fill in later.
- **D-02:** Mission framing: "Myelin builds BDaS — Brain Data as a Service — a privacy-first BCI integration layer that enables developers to build brain-computer interface applications without handling raw neural data."
- **D-03:** Stage context included: pre-seed, 300-day sprint, sole founder (Omer Shalev), primary goal is validating BDaS with first customers. Agents calibrate urgency accordingly.
- **D-04:** Departments with standard scope: Tech (CTO) — code, infra, data pipelines; Marketing (CMO) — content, brand, X/social; Operations (COO) — research, analysis, admin; Global — cross-cutting tasks routed by Tamir.
- **D-05:** Default budget philosophy: $10 per task. Agents know to flag if they think a task needs more before proceeding.
- **D-06:** Working style: technical precision — rigorous, cite sources, prefer concrete deliverables over summaries. Reflects founder's cryptography + neuroscience background.
- **D-07:** Privacy principles are NOT baked into the DNA — handled per-task via plan constraints. DNA focuses on identity, not operational rules.
- **D-08:** Collaboration norm: proactively consult relevant department heads even when not strictly required, to produce better outputs. Use `consult_agent` before guessing on cross-department decisions.

### Worker Loop Polling

- **D-09:** Poll interval: **2 seconds**. Picks up new tasks within ~2s of queueing. Low overhead for single-user SQLite.
- **D-10:** No backoff when queue is empty. Fixed 2s interval always. SQLite SELECT on an empty table is essentially free.
- **D-11:** Stale run threshold: **2 minutes** (~8 missed heartbeats at 15s each). Clear signal of a crashed process without false-positive risk.
- **D-12:** Shutdown behavior: on server startup, any `task_runs` still in `executing` state are immediately marked `failed`. Clean slate. Matches FOUND-07 spec — no session resume attempt on stale runs.

### Claude's Discretion

- Exact Prisma column definitions for all 9 tables — planner derives from requirements + standard patterns
- optimistic-lock SQL for worker claim (UPDATE WHERE status='queued' AND id=...)
- FTS5 index trigger SQL specifics
- instrumentation.ts singleton flag implementation detail

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Foundation Requirements
- `.planning/REQUIREMENTS.md` §Foundation Infrastructure — FOUND-01 through FOUND-11, exact specs for every deliverable in this phase
- `.planning/PROJECT.md` §Constraints — Tech stack constraints (no Tailwind, no Python, SQLite only, SDK First)
- `.planning/PROJECT.md` §Key Decisions — 10 architectural decisions already locked (filesystem JSONL for chat, MEMORY.md per agent, FTS5 over vector DB, etc.)

### Stack Reference
- `CLAUDE.md` §Technology Stack — exact versions for all packages (Next.js 14.2.35, Prisma 7.5.0, better-sqlite3 12.8.0, zod 4.3.6, etc.)
- `CLAUDE.md` §What NOT to Use — explicit exclusions the planner must not violate

[No external specs beyond project documents — requirements are fully captured above]

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

None — greenfield project. No existing code to reuse.

### Established Patterns

None yet. Phase 1 establishes the patterns that all subsequent phases follow.

### Integration Points

- `instrumentation.ts` is the bootstrap hook: worker loop + FTS5 init fire here under `NEXT_RUNTIME === 'nodejs'` guard with singleton flag
- `src/lib/events.ts` will be the single SSE EventEmitter that all producers and subscribers import — established in this phase, used by all subsequent phases
- `data/` directory at project root: `data/vault/`, `data/departments/`, `data/agents/` — all subsequent phases write here

</code_context>

<specifics>
## Specific Ideas

- Company DNA should feel like a real internal document, not a generic template — write it as if Omer wrote it himself, in first person where appropriate, capturing the actual Myelin voice
- The `generateId(prefix)` utility (`${prefix}_${randomBytes(4).hex}`) is specifically specified in FOUND-09 — implement exactly as specified, don't use UUID or nanoid

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-03-25*
