# Phase 5: Langfuse Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 05-langfuse-integration
**Areas discussed:** Integration scope & value, Deployment model, Instrumentation points, UI integration

---

## Integration scope & value

### What observability gap does Langfuse fill?

| Option | Description | Selected |
|--------|-------------|----------|
| Trace visualization | Current build logs are flat/linear. Langfuse adds hierarchical trace trees showing agent → tool → LLM call nesting. Helps debug multi-step reasoning and tool chains. Most valuable Langfuse feature for agent systems. | ✓ |
| Cross-task analytics | Current cost_events are per-task. Langfuse adds aggregate views: cost trends over time, most expensive agents, token usage by department. Analytics dashboard you don't have today. | |
| External audit/compliance | Current activity_log is in private SQLite. Langfuse provides external trace storage with retention policies, export capabilities. Relevant if you need to share observability with investors/auditors. | |
| Future-proofing | Current observability is sufficient today, but Langfuse prepares for scale. Add it now to avoid retrofitting later when you have months of production data to migrate. | |

**User's choice:** Trace visualization
**Notes:** Primary value is hierarchical trace trees — helps visualize agent → tool → LLM call nesting that current flat build logs don't show.

---

### Beyond trace visualization, which features to use?

| Option | Description | Selected |
|--------|-------------|----------|
| Cost analytics dashboard | Aggregate cost views: trends over time, cost by agent/department, token usage patterns. Supplements your cost_events table with visual analytics. | ✓ |
| Datasets & evaluations | Test suites for agent behaviors. Run acceptance scenarios (CMO video, CTO EEG classifier) as regression tests. Relevant for your INT-04/INT-05 requirements. | |
| Prompt management | Version control for prompts. Less relevant since you use soul.md files committed to git, but could version-control prompt templates if needed. | |
| Just traces | Start minimal - trace visualization only. Add other features if you discover a need. Keeps Phase 5 scope tight. | |

**User's choice:** Cost analytics dashboard (in addition to trace visualization)
**Notes:** Analytics dashboard adds aggregate views on top of existing cost_events table.

---

### Which agent invocations should send traces?

| Option | Description | Selected |
|--------|-------------|----------|
| All invocations | Every invoke-agent.ts call creates a Langfuse trace. Complete observability. ~10-50 traces/day for single-user system. Storage grows but traces compress well. | ✓ |
| Production only (skip planning) | Only execution phase (task_runs) sends traces. Planning turns with Tamir/dept heads are excluded. Reduces trace volume by ~40%, but loses visibility into planning behavior. | |
| Selective (flag-based) | Add optional tracingEnabled flag to invokeAgent() options. CEO controls per-task via UI toggle. Max flexibility, but adds UI complexity and requires decision per task. | |

**User's choice:** All invocations
**Notes:** Trace both planning and execution for complete observability.

---

### How long should trace data be retained?

| Option | Description | Selected |
|--------|-------------|----------|
| 90 days | Keeps last 3 months of traces. Enough for debugging recent issues and trend analysis. Auto-purge older traces to prevent unbounded storage growth. ~5-10GB for 90 days at your scale. | ✓ |
| Forever (manual cleanup) | Never auto-delete traces. Good for audit/compliance needs or if you want full historical record. Requires manual cleanup when storage fills. Grows ~1-2GB/month. | |
| 30 days | Aggressive retention for minimal storage footprint. Keeps only last month. Sufficient if you debug issues quickly and don't need long-term trend data. | |

**User's choice:** 90 days
**Notes:** 90-day retention balances debugging needs with storage constraints.

---

## Deployment model

### Where should Langfuse run?

| Option | Description | Selected |
|--------|-------------|----------|
| Self-hosted Langfuse server | Docker container with Postgres database. Keeps all trace data local (no external dependencies). Adds Postgres + Docker to your stack. ~500MB RAM overhead. Fully aligned with 'persistent self-hosted' constraint. | |
| Langfuse Cloud (SaaS) | Hosted by Langfuse team. Zero infrastructure overhead - just add API key. Free tier: 50K trace events/month (enough for you). Data leaves localhost but encrypted in transit/rest. Fastest to implement. | ✓ |
| Hybrid: SDK + SQLite | Use Langfuse TypeScript SDK for instrumentation, but store traces in YOUR SQLite (not Langfuse server). Custom implementation - no Langfuse UI out of box, but fully aligned with SQLite-first architecture. Build custom trace viewer in Cortex. | |

**User's choice:** Langfuse Cloud (SaaS)
**Notes:** Zero infrastructure overhead, free tier sufficient, fastest implementation path.

---

### Where should Langfuse SDK be initialized?

| Option | Description | Selected |
|--------|-------------|----------|
| instrumentation.ts bootstrap | Initialize Langfuse client in instrumentation.ts (same pattern as worker loop, FTS5 init). Singleton survives HMR, ready before first agent invocation. Follows Phase 1 pattern. | ✓ |
| On-demand in invoke-agent.ts | Create Langfuse client inside invokeAgent() per invocation. Simpler for conditional tracing (only trace when env var present), but loses singleton pattern. | |
| Lazy singleton | Create Langfuse client on first use (getOrCreateLangfuse() pattern). Defers initialization until first agent invocation. Middle ground between eager bootstrap and per-invocation creation. | |

**User's choice:** instrumentation.ts bootstrap
**Notes:** Follows established Phase 1 pattern for bootstrap initialization.

---

### When should tracing to Langfuse be active?

| Option | Description | Selected |
|--------|-------------|----------|
| Always (when keys present) | If LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY exist in .env, tracing is active. Otherwise silently disabled. Simple on/off via env vars. Recommended for single-user system. | ✓ |
| Explicit enable flag | Require LANGFUSE_ENABLED=true in addition to API keys. Gives you a separate toggle - you can have keys configured but tracing off. Extra control, extra complexity. | |
| Per-environment | Active in production (NODE_ENV=production), disabled in development. Reduces noise during local testing. But 'production' for localhost single-user is ambiguous. | |

**User's choice:** Always (when keys present)
**Notes:** Simple activation model — presence of API keys enables tracing.

---

### What happens if Langfuse Cloud API is unavailable?

| Option | Description | Selected |
|--------|-------------|----------|
| Fail silently | Langfuse SDK sends traces async in background. If API fails, log warning but don't block agent execution. Observability failure never breaks agent work. SDK has built-in retry with exponential backoff. | ✓ |
| Fail fast | If Langfuse API is down, throw error and abort agent invocation. Ensures no blind spots in observability, but creates external dependency that can break your agents. | |
| Fallback to local | On Langfuse API failure, write traces to local JSON files as backup. Adds complexity (file I/O, rotation, manual upload later) but ensures no trace loss. | |

**User's choice:** Fail silently
**Notes:** Observability failure must not break agent work. SDK handles retry with exponential backoff.

---

## Instrumentation points

### How should traces be structured?

| Option | Description | Selected |
|--------|-------------|----------|
| One trace per task | taskId = trace ID. All agent invocations for that task (planning, execution, supervisor review) are spans within one trace. Natural hierarchy: Task → Planning Agent → Executor → Supervisor. Matches your task lifecycle. | ✓ |
| One trace per invocation | Each invokeAgent() call creates a new trace. Simple 1:1 mapping. Loses cross-invocation context - you won't see planning → execution connection in one view. | |
| One trace per task_run | Execution-only tracing. Planning phase (Tamir routing, dept head chat) not traced. Reduces trace count, but loses visibility into plan generation. | |

**User's choice:** One trace per task
**Notes:** taskId = trace ID. All invocations for that task become spans within one trace.

---

### What level of detail should be captured?

| Option | Description | Selected |
|--------|-------------|----------|
| LLM generations | Every LLM call (prompt, completion, tokens, cost). Core of trace value. Langfuse SDK has built-in generation tracking. | ✓ |
| Tool calls | Every MCP tool invocation (tool name, input, output, duration). Shows read_memory, promote_to_deliverable, etc. in trace tree. | ✓ |
| Agent metadata | Attach agentId, department, soul.md excerpt to each span. Helps filter traces by agent in Langfuse UI. | ✓ |
| Task metadata | Attach task title, description, currentActorId, state transitions to trace. Full task context visible in Langfuse. | ✓ |

**User's choice:** All 4 (LLM generations, Tool calls, Agent metadata, Task metadata)
**Notes:** Full detail capture for comprehensive trace context.

---

### How should SDK events map to Langfuse spans?

| Option | Description | Selected |
|--------|-------------|----------|
| One span per agent invocation | invokeAgent() call = one Langfuse span. SDK's internal events (tool_progress, assistant messages) are captured as metadata on that span. Simple 1:1 mapping. Langfuse SDK handles LLM generation tracking automatically. | ✓ |
| Nested spans for tools | invokeAgent() = parent span. Each tool call = child span. Creates deeper trace tree. More granular but adds instrumentation complexity (need to intercept tool execution in MCP server). | |
| Custom event spans | Map each SDK message type (assistant, tool_progress, tool_use_summary) to its own Langfuse span. Maximum granularity but creates very wide/flat traces with 10-50 spans per invocation. | |

**User's choice:** One span per agent invocation
**Notes:** Simple 1:1 mapping. SDK internal events captured as span metadata.

---

### How should traces be sent to Langfuse Cloud?

| Option | Description | Selected |
|--------|-------------|----------|
| SDK background queue | Langfuse SDK batches traces and sends async in background. Zero performance impact on agent invocations. Built-in retry and backoff. Default SDK behavior - just call langfuse.trace().generation().end(). | ✓ |
| Synchronous (await flush) | Await langfuse.flushAsync() after each invocation to ensure trace is sent before proceeding. Guarantees delivery but adds ~50-200ms latency per invocation. | |
| Manual batching | Accumulate traces in memory, flush every N invocations or every M seconds. More control over send timing, but adds complexity and risks losing traces on crash. | |

**User's choice:** SDK background queue
**Notes:** Default SDK behavior with built-in retry. Zero performance impact.

---

## UI integration

### How should the CEO access Langfuse trace data?

| Option | Description | Selected |
|--------|-------------|----------|
| Link out to Langfuse Cloud UI | Add 'View Trace' links in deliverable workspace that open cloud.langfuse.com in new tab. Simple - no iframe embedding, just direct links. CEO switches between Cortex and Langfuse tabs. | |
| Embedded iframe in Cortex | Embed Langfuse dashboard as iframe in a new Cortex page (sidebar nav item). Single-pane view but iframe may have auth/CORS issues with Langfuse Cloud. | |
| Custom trace viewer in Cortex | Fetch trace data via Langfuse API and render custom trace tree UI in Cortex. Most integrated UX but requires building custom visualization (significant scope add for Phase 5). | |
| Dev-only (no CEO access) | Langfuse is a developer tool only. CEO uses existing Dashboard/build logs. You access Langfuse directly for deep debugging. No Cortex UI integration. | ✓ |

**User's choice:** Dev-only (no CEO access)
**Notes:** Langfuse is a developer tool. CEO continues using existing Dashboard/build logs.

---

### Should there be any UI indication that tracing is active?

| Option | Description | Selected |
|--------|-------------|----------|
| No indicator | Tracing is transparent to the CEO user. System works exactly the same whether Langfuse is on or off. You check cloud.langfuse.com directly when debugging. | |
| Small status badge | Add a tiny 'Observability: Active' badge in the Dashboard or settings page. Confirms traces are flowing. Low-friction visibility. | ✓ |
| Trace ID in build log | Show Langfuse trace ID as a metadata entry in the build log. Gives you a direct link from build log to specific trace if you need to cross-reference. | |

**User's choice:** Small status badge in settings page
**User's notes:** "tiney Observability: Active badge in the settings page"
**Notes:** Low-friction status indicator in settings page.

---

## Claude's Discretion

- Exact Langfuse SDK initialization code in instrumentation.ts
- Span metadata schema (which Task model fields to attach)
- How to extract/attach soul.md excerpt per span (first N lines? summary?)
- Error handling detail level (log to Pino, activity_log, or both?)
- Settings page badge styling (color, icon, placement)
