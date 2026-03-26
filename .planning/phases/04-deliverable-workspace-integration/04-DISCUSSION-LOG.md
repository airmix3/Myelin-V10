# Phase 4: Deliverable Workspace + Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 04-deliverable-workspace-integration
**Areas discussed:** Supervisor invocation, Acceptance scenario scope, Error handling + budget UX, System reset surface

---

## Supervisor Invocation

| Option | Description | Selected |
|--------|-------------|----------|
| Enqueue new task_run | submit_for_review creates a new task_run row (queued, supervisorAgentId). Worker picks it up like any run. | ✓ |
| Event-driven invoke | SSE event triggers inline supervisor invocation, no new task_run row. | |
| Periodic worker check | Worker detects currentActorId mismatch and auto-schedules. | |

**User's choice:** Enqueue new task_run (recommended default)
**Notes:** Consistent with Phase 1 worker pattern — no new mechanism needed.

**Follow-up: request_changes re-execution**

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-resume executor | request_changes auto-enqueues new task_run for executor. CEO just watches. | ✓ |
| CEO approves re-execution | request_changes waits for CEO to click "Resume execution". | |

**User's choice:** Auto-resume executor
**Notes:** CEO is observer — full loop visible in build log, no gating.

---

## Acceptance Scenario Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Architecture demonstrated | Pass = state machine executes correctly, output can be realistic mock. | |
| Real output required | CMO must produce real video artifact. CTO must execute real Python with real metrics. | ✓ |
| Semi-real | CTO Python real, CMO mock. | |

**User's choice:** Real output required
**Notes:** User clarified that agents use native SDK capabilities (`preset: claude_code`) — web search and bash are available out of the box. No custom web_search MCP tool needed. All SDK capabilities are in scope. Agents should be fully autonomous using their available tools.

**Follow-up: capabilities in scope**

User selected all capabilities: web search (native SDK), Python execution (bash tool), real EEG data fixture. User explicitly stated: "Web search is available natively through agent SDK and the agent should decide how to behave... agents should be very autonomous and use all the available tools/skills they provided out of the box."

---

## Error Handling + Budget UX

**503 Retry:**

| Option | Description | Selected |
|--------|-------------|----------|
| Display only — SDK handles it | Surface api_retry events in Build Log as amber entries. No custom code. | ✓ |
| Custom backoff on top | Custom wrapper with 2s/4s/8s retry on top of SDK retry. | |

**User's choice:** Display only
**Notes:** SDK auto-retry is sufficient; Phase 4 just makes it visible.

**Budget exceeded:**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in build log | Amber card with budget input + Approve button in build log. | ✓ (combined) |
| Chat panel interrupt | System message in chat panel. | ✓ (combined) |
| Separate approval page | Dedicated approval page. | |

**User's choice:** Both options 1 and 2 combined.
**Notes:** User described it as an "escalation" — visible in both chat (agent notifies CEO) and build log (approve button). "Of course see it in the build log."

---

## System Reset Surface

**Initial choice:** Via Tamir only (recommended)

**Revisited:** User decided to also add a button in the Cortex UI.

| Option | Description | Selected |
|--------|-------------|----------|
| Via Tamir only | CEO types 'reset system' in Tamir chat. Skill-based. | (reconsidered) |
| Add danger button in UI | Both Tamir route + button in Cortex. | ✓ |
| Dev API only | POST /api/system/reset, no UI surface. | |

**Location decision:**

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard footer | Danger Zone at bottom of Dashboard. | |
| Dedicated settings page | New /settings page with Danger Zone section. 6th nav item. | ✓ |
| Org Context page | Tucked into Org Context. | |

**User's choice:** Dedicated /settings page as 6th sidebar nav item (Settings ⚙).

---

## Claude's Discretion

- Build log entry styling for retry vs. heartbeat vs. hire vs. budget approval cards
- Exact EEG fixture format and size
- Supervisor greeting message content
- /settings page layout and system info items
