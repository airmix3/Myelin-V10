# Phase 2: Agent Execution Layer - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

The layer that makes agents actually execute tasks. Replaces the Phase 1 `executeRun` stub with `invokeAgent()`, wires up the Claude Agent SDK with per-invocation MCP tool servers, defines agent identity for all 4 executives, implements all 14 custom MCP tools, builds the hire approval API, and ships the 3 global skills. The result: an agent can be invoked, run in an isolated desk, use tools, cost-track, resume sessions, and spawn temp employees.

Requirements covered: AGENT-01 through AGENT-06, TOOL-01 through TOOL-14, GSKILL-01 through GSKILL-03.

</domain>

<decisions>
## Implementation Decisions

### Build Strategy (Validation Spike)

- **D-01:** Plan 1 is a spike-embedded plan: delivers real production code for `invokeAgent()` + MCP server + 3-4 core tools. Validates the concurrent-agent + per-invocation MCP isolation model while shipping shippable work. If concurrent isolation breaks, we discover it at Plan 1 (50-100 lines), not after Plan 3 (1,000+ lines).
- **D-02:** Validation criterion for the spike: 2 agents run concurrently, each with its own ToolContext closure, and tools from one agent cannot affect the other's state. If this fails, replanning happens before proceeding.

### Agent soul.md Design

- **D-03:** All soul.md files are comprehensive guides — 2-4 pages each. Not minimal personas. They define persona, tone, decision-making philosophy, how to handle ambiguity, cross-department behavior, tool usage patterns. Agents should behave like seasoned executives from day one without needing to be trained through interaction.
- **D-04:** Tamir is a sharp operator — direct, no filler, but substantive. When Tamir speaks, it's worth reading: clear answer + reasoning + next step, no padding. Not curt one-liners, not a rambling advisor. A well-briefed CoS who respects the CEO's time but gives enough context to not need follow-up questions.
- **D-05:** CTO, CMO, COO are domain experts with strong opinions. They push back when something doesn't make sense. CTO thinks in architecture tradeoffs. CMO thinks in narratives and audience. COO thinks in systems and second-order effects. They don't just execute — they advise.
- **D-06:** Agent names for now: role titles only (CTO, CMO, COO). Names can be added when the user wants them to feel more personal.

### Global Skills

- **D-07:** All 3 global skills are step-by-step procedures with clear why/goal. Not just "what to do" but "why it matters." The structure: goal statement → when to trigger → step-by-step procedure → edge case handling.

- **D-08 (memory-management):** Agent's discretion — not mandatory on every task. Write to MEMORY.md when something meaningful happened. MEMORY.md is a structured employee journal with these sections:
  - `## Recent Projects` — each entry has task description, link to deliverable path, link to relevant knowledge files written. A future agent should be able to pick up context from this section.
  - `## Company Conventions` — patterns and decisions discovered during work (e.g., "CTO prefers async patterns", "CEO wants sources cited")
  - `## Goals` — active company objectives relevant to the agent's department
  - Read MEMORY.md at task start to load context. Write at task end only when something genuinely new was learned or something changed.

- **D-09 (skill-extractor):** Both executor and supervisor extract skills. Executor calls `propose_skill` during the task when they notice a reusable pattern mid-execution. Supervisor does a review pass after approving the deliverable — catches things the executor missed. Two chances to capture skills. The skill teaches the executor what counts as worth capturing: novel tool combination, reusable workflow, domain insight that would help future agents.

- **D-10 (system-reset):** CEO triggers via Tamir (not a direct API call). Flow: CEO requests reset → Tamir asks what to preserve (deliverables? skill proposals? cost history?) → Tamir shows a summary (X tasks, Y deliverables, Z cost events will be deleted, preserving: vault docs, DNA, approved skills, permanent employees + whatever CEO chose) → CEO explicitly confirms → reset executes. One safety gate: the summary confirmation. Not instant, not overly paranoid.

### Hire Approval API

- **D-11:** `POST /api/hire_requests/[id]/approve` is built in Phase 2. Business logic (create employee record, transition task back to working, re-invoke dept head with employee as SDK AgentDefinition subagent) belongs in the agent layer, not the UI layer. Phase 3 just calls this endpoint from the approval button in the build log.
- **D-12:** Phase 2 also builds `POST /api/hire_requests/[id]/reject` for completeness — task returns to the dept head with rejection context.

### Claude's Discretion

- Exact MCP server wiring pattern (how `buildMyelinMcpServer(ctx)` is called inside `invokeAgent()`)
- Cost event schema fields beyond what AGENT-01 specifies
- Internal helper structure for the 14 tools (e.g., shared file path utilities)
- Exact content of CTO, CMO, COO soul.md beyond the persona direction above — Claude writes comprehensive guides matching the style direction
- skill-extractor criteria detail beyond what's captured in D-09

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent System Requirements
- `.planning/REQUIREMENTS.md` §Agent System — AGENT-01 through AGENT-06, exact specs for invokeAgent(), orchestrator, agent directories, structured output, A2A interfaces, temp employee hire flow
- `.planning/REQUIREMENTS.md` §Custom Tools (MCP) — TOOL-01 through TOOL-14, exact tool behavior, access control rules, filesystem paths, locking requirements
- `.planning/REQUIREMENTS.md` §Global Skills — GSKILL-01 through GSKILL-03, location and activation status for all 3 skills

### Architecture Decisions
- `.planning/PROJECT.md` §Key Decisions — 10 locked architectural decisions (SDK-first, MEMORY.md per agent, filesystem JSONL, etc.)
- `.planning/PROJECT.md` §Constraints — TypeScript only, no Tailwind, SDK First, SQLite

### Stack Reference
- `CLAUDE.md` §Technology Stack — exact versions: @anthropic-ai/claude-agent-sdk@0.2.83, @modelcontextprotocol/sdk@1.28.0, zod@4.3.6 (v4 mandatory, NOT v3)
- `CLAUDE.md` §What NOT to Use — explicit exclusions

### Integration Points (Phase 1 code to extend)
- `src/lib/worker.ts` — `executeRun` stub at line ~126 is the replacement target for `invokeAgent()`
- `src/lib/workspace.ts` — `createTaskWorkspace()` already creates desk + symlinks; Phase 2 reads `deskDir` as the agent CWD
- `src/lib/events.ts` — SSE event bus; Phase 2 emits build log events here during `invokeAgent()` streaming

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/worker.ts`: `executeRun(run)` is a clearly marked Phase 1 stub (lines ~124-150). Replace with `invokeAgent()` call. The surrounding claim/heartbeat/complete logic stays.
- `src/lib/workspace.ts`: `createTaskWorkspace()` already creates desk + deliverables dirs + skill symlinks + CLAUDE.md. Returns `{baseDir, deskDir, delivDir, manifestPath}`. Phase 2 uses `deskDir` as the agent CWD.
- `src/lib/events.ts`: SSE event bus. Import `eventBus` and emit typed events for build log streaming (`task:buildlog`, `task:heartbeat`).
- `src/lib/db.ts`: `sqlite` (better-sqlite3 instance) available for direct SQL. `prisma` for ORM queries.
- `src/lib/id.ts`: `generateId(prefix)` for consistent ID generation.
- `prisma/schema.prisma`: `Task` model already has `sessionId` and `workspaceCwd` fields for SDK session resume.

### Established Patterns
- Worker loop uses optimistic locking (`UPDATE WHERE status='queued'`) — same pattern should apply to hire request state transitions
- Stale run recovery on startup (already implemented) — model for similar safety-net patterns
- Junction symlinks (`symlinkSync(..., 'junction')`) for cross-platform skill sharing — already in workspace.ts
- Parameterized SQL (not template literals) for all queries — see worker.ts stale threshold query

### Integration Points
- `src/lib/worker.ts:executeRun()` → replace with `invokeAgent()` call
- `data/departments/{dept}/skills/` and `data/departments/global/skills/` → location for new global skills
- `data/agents/{agentId}/` → location for MEMORY.md and inbox.jsonl per agent
- `src/agents/` → create this directory with 4 subdirs (tamir, cto, cmo, coo) each containing soul.md + card.json + agent.ts

</code_context>

<specifics>
## Specific Ideas

- Tamir's voice: direct and substantive — not "Got it, routing to CTO." but more like "Routing to CTO — this maps to the EEG data pipeline work. CTO will need the dataset spec before starting; I've flagged that in the task context." The extra sentence that saves a follow-up.
- MEMORY.md format should feel like a real person's notes, not a database dump. Headers, brief entries, file paths where relevant. If an agent reads it, they should feel like they're reading their own notes from last week.
- system-reset is an admin operation, not a task. Tamir should handle it differently from a business task — no routing to departments, no deliverable workspace. Just a Tamir-handled flow with confirmation.

</specifics>

<deferred>
## Deferred Ideas

- `consult_agent` tool — deferred to v2 (COORD-01). Explicitly out of scope for Phase 2. Not in TOOL-01 through TOOL-14.
- Tamir 15-minute cron (COORD-02) — deferred to v2. Tamir in Phase 2 is invoked on demand only.
- Named personas for CTO/CMO/COO — left as role titles for now, user will add names when ready.

</deferred>

---

*Phase: 02-agent-execution-layer*
*Context gathered: 2026-03-26*
