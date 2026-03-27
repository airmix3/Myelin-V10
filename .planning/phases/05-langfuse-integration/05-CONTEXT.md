# Phase 5: Langfuse Integration - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Langfuse observability to the agent execution layer. Provides hierarchical trace visualization (agent → tool → LLM call nesting) and cost analytics dashboard on top of existing cost_events table and activity logs. Traces flow to Langfuse Cloud SaaS asynchronously without blocking agent execution. Developer tool with minimal CEO-facing UI (status badge only).

Enhances observability beyond current flat build logs. Does not replace existing cost tracking, activity logs, or SSE real-time monitoring.

</domain>

<decisions>
## Implementation Decisions

### Integration Scope

- **D-01:** Primary value is **trace visualization** — hierarchical trace trees showing agent → tool → LLM call nesting. Current build logs are flat/linear; Langfuse adds nested structure that helps debug multi-step reasoning and tool chains.
- **D-02:** Secondary value is **cost analytics dashboard** — aggregate views (trends over time, cost by agent/department, token usage patterns). Supplements existing `cost_events` table with visual analytics.
- **D-03:** **Not using** prompt management (soul.md files are version-controlled in git), datasets/evals (defer to future phase if needed), or feedback collection (single-user system makes this less relevant).
- **D-04:** Trace **all invocations** — both planning (Tamir routing, dept head chat) and execution (task_runs). Complete observability. Estimated ~10-50 traces/day for single-user system.
- **D-05:** Trace retention: **90 days**. Auto-purge older traces. Sufficient for debugging recent issues and trend analysis. Storage: ~5-10GB for 90 days at expected scale.

### Deployment Model

- **D-06:** Use **Langfuse Cloud SaaS** (cloud.langfuse.com). Free tier: 50K trace events/month (sufficient). Zero infrastructure overhead — no Postgres, no Docker containers. Data encrypted in transit and at rest. Fastest to implement.
- **D-07:** Initialize Langfuse SDK in **instrumentation.ts bootstrap** (same pattern as worker loop, FTS5 init from Phase 1). Singleton survives HMR, ready before first agent invocation.
- **D-08:** Tracing active **when API keys present** — if `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` exist in `.env`, tracing is on. Otherwise silently disabled. No separate enable flag needed.
- **D-09:** **Fail silently** if Langfuse Cloud API unavailable. SDK sends traces async in background with built-in retry/exponential backoff. Log warning on failure but never block agent execution. Observability failure must not break agent work.

### Instrumentation Points

- **D-10:** Trace structure: **one trace per task** (taskId = trace ID). All agent invocations for that task (planning, execution, supervisor review) are spans within one trace. Natural hierarchy: Task → Planning Agent → Executor → Supervisor. Matches existing task lifecycle.
- **D-11:** Capture detail level (all 4):
  - **LLM generations**: Every LLM call (prompt, completion, tokens, cost). Langfuse SDK has built-in generation tracking.
  - **Tool calls**: Every MCP tool invocation (tool name, input, output, duration). Shows read_memory, promote_to_deliverable, etc. in trace tree.
  - **Agent metadata**: Attach agentId, department, soul.md excerpt to each span. Helps filter traces by agent in Langfuse UI.
  - **Task metadata**: Attach task title, description, currentActorId, state transitions to trace. Full task context visible in Langfuse.
- **D-12:** SDK event mapping: **one span per agent invocation**. Each `invokeAgent()` call = one Langfuse span. SDK's internal events (tool_progress, assistant messages) captured as metadata on that span. Simple 1:1 mapping. Langfuse SDK handles LLM generation tracking automatically.
- **D-13:** Performance: **SDK background queue**. Langfuse SDK batches traces and sends async in background. Zero performance impact on agent invocations. Built-in retry and backoff. Default SDK behavior — just call `langfuse.trace().generation().end()`.

### UI Integration

- **D-14:** Langfuse is a **developer tool** — no CEO access via Cortex UI. CEO continues using existing Dashboard/build logs. Developer accesses cloud.langfuse.com directly for deep debugging/trace inspection.
- **D-15:** Minimal UI indicator: **"Observability: Active" badge in settings page**. Shows tracing status. Confirms traces flowing to Langfuse. Low-friction visibility without cluttering core UI.

### Claude's Discretion

- Exact Langfuse SDK initialization code in instrumentation.ts
- Span metadata schema (which fields from Task model to attach)
- How to extract/attach soul.md excerpt per span (first N lines? summary?)
- Error handling detail level (log warnings to Pino, activity_log, or both?)
- Settings page badge styling (color, icon, placement)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Langfuse Documentation
- Langfuse TypeScript SDK docs — https://langfuse.com/docs/sdk/typescript (SDK initialization, trace/span API, generation tracking, async flushing)
- Langfuse Cloud setup — https://langfuse.com/docs/deployment/cloud (API key generation, project setup, free tier limits)

### Existing Observability (Phase 1-4 outputs to extend)
- `src/lib/invoke-agent.ts` — Central instrumentation point wrapping SDK `query()`. Lines 49-225 show existing cost tracking (cost_events INSERT), activity logging, SSE emissions. Langfuse instrumentation adds here.
- `src/lib/logger.ts` — Pino structured JSON logger with child contexts. Use for Langfuse error logging.
- `prisma/schema.prisma` — `cost_events`, `activity_log`, `task_runs`, `tasks` tables. Phase 5 does NOT add new tables (traces live in Langfuse Cloud).

### Architecture Patterns (carry-forward from prior phases)
- `.planning/phases/01-foundation-infrastructure/01-CONTEXT.md` §D-06 — All bootstrap code goes in `instrumentation.ts` under `NEXT_RUNTIME === 'nodejs'` guard with singleton flag
- `.planning/phases/02-agent-execution-layer/02-CONTEXT.md` §D-01 — SDK-first approach: integrate at SDK extension points, not custom wrappers
- `.planning/PROJECT.md` §Constraints — Persistent self-hosted Node.js, single-user localhost

### Settings Page (Phase 4)
- `src/app/settings/page.tsx` — Settings page exists from Phase 4 (system info, danger zone). Phase 5 adds "Observability: Active" badge here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/invoke-agent.ts`: Central instrumentation point — every agent invocation goes through this. Lines 49-225 show:
  - Lines 100-101: SDK `query()` call with options
  - Lines 104-221: Async generator iteration over SDK messages
  - Lines 158-209: Result message handling with cost extraction
  - **Integration point**: Wrap lines 100-221 in Langfuse trace/span — capture sessionId, cost, duration
- `src/lib/logger.ts`: Pino logger with `logger.child({ module, taskId, agentId })` pattern — use for Langfuse error logging
- `src/lib/events.ts`: SSE event bus singleton — existing pattern for HMR-safe singletons (applies to Langfuse client singleton)
- `src/instrumentation.ts`: Bootstrap hook under `NEXT_RUNTIME === 'nodejs'` guard — where Langfuse client init goes

### Established Patterns
- Singleton pattern: `globalThis.__sseEventBus`, `globalThis.__sqlite`, `globalThis.__prisma` — apply same pattern for `globalThis.__langfuse`
- Async background operations: Worker loop polls every 2s without blocking server startup — Langfuse SDK background queue matches this pattern
- Resilient external calls: Phase 4 external API calls use AbortController + 5s timeout for graceful degradation — same principle for Langfuse (fail silently)
- Conditional features via env vars: Worker loop, FTS5 init check for required env/config before activating — Langfuse checks for `LANGFUSE_PUBLIC_KEY`

### Integration Points
- `src/instrumentation.ts`: Add Langfuse client init after line ~20 (after FTS5 init, before worker start)
- `src/lib/invoke-agent.ts`: Wrap `query()` call in Langfuse trace span — start span before line 100, end span at line 209
- `src/app/settings/page.tsx`: Add "Observability" section with status badge showing Langfuse active/inactive state
- `.env.local`: Add `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` (never commit to repo)

</code_context>

<specifics>
## Specific Ideas

- Langfuse trace ID should match taskId for easy correlation — when viewing a task in Cortex, you can find its trace in Langfuse by searching for the same ID.
- The settings page badge should use existing `--green` CSS variable from Phase 3 design system when active, `--text-muted` when inactive. Keep visual language consistent.
- Soul.md excerpt for span metadata: first 3 lines (persona definition) is enough. Full soul.md is 2-4 pages — too much for trace metadata. Just enough to identify agent personality at a glance in Langfuse UI.
- Cost in Langfuse should match cost_events table exactly — same calculation, same precision. Langfuse becomes alternate view of same data, not a separate source of truth.

</specifics>

<deferred>
## Deferred Ideas

- Datasets & evaluations (test suites for agent behaviors) — could be useful for INT-04/INT-05 acceptance scenarios, but defer until v10.1 when system is mature enough to have regression test needs
- Custom trace viewer in Cortex (fetch via Langfuse API and render custom UI) — too much scope for Phase 5. Developer accessing cloud.langfuse.com directly is sufficient for now.
- Prompt management in Langfuse — soul.md files in git version control are working fine. No need to duplicate prompt versioning in Langfuse.
- Embedded iframe of Langfuse dashboard in Cortex — may have auth/CORS issues with Langfuse Cloud. Link-out approach is simpler.

</deferred>

---

*Phase: 05-langfuse-integration*
*Context gathered: 2026-03-27*
