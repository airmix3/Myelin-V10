# Phase 4: Deliverable Workspace + Integration - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

The deliverable workspace page (`/deliverables/[id]`) — split-pane with live build log, chat continuation, agent log, file browser, and deliverable preview. Plus the supervisor review loop (executor → supervisor → approve/request_changes cycle), skill extraction trigger, error handling UX, and end-to-end acceptance scenarios proving real agent work. A /settings page with danger zone is also added.

Requirements covered: UI-09, DELIV-01 through DELIV-08, INT-01 through INT-05.

</domain>

<decisions>
## Implementation Decisions

### Supervisor Invocation

- **D-01:** `submit_for_review` enqueues a **new `task_run` row** (status=queued, agentId=supervisorAgentId) — the existing worker loop picks it up exactly like any execution run. No new invocation mechanism needed; consistent with the Phase 1 worker pattern.
- **D-02:** `request_changes` sets `currentActorId` back to the executor AND auto-enqueues a new `task_run` for the executor automatically — no CEO intervention required. CEO observes the full review loop in the build log.

### Acceptance Scenarios

- **D-03:** Scenarios pass when agents produce **real output artifacts**. Scenario A (CMO): agent must use native SDK tools to discover AI video generation tools via web search and produce a real video deliverable (or invoke a video tool that returns one). Scenario B (CTO): agent must execute real Python via SDK bash tool and produce real EEG metrics/plots. Text-only output does not pass.
- **D-04:** Agents use SDK `preset: claude_code` native capabilities for web search and Python execution — **no custom web_search MCP tool** needed. The Claude Code SDK toolset (bash, web search, file I/O) is available to all agents out of the box.
- **D-05:** Phase 4 ships a **test EEG fixture file** (e.g., `data/test-fixtures/eeg-sample.csv` or `.edf`) in the repository so Scenario B has real data the CTO agent can work with. The fixture should contain a short multi-channel EEG recording with labeled epochs.

### Error Handling + Budget UX

- **D-06:** SDK `api_retry` events are already logged in `invoke-agent.ts`. Phase 4 **surfaces retries in the Build Log UI only** (amber "Retrying…" entry with attempt number + delay) — no custom backoff wrapper on top of SDK retry. SDK handles 503 resilience; UI communicates it.
- **D-07:** Budget exceeded creates a **dual signal**:
  1. A system message in the chat panel ("⚠ Budget exceeded — this task needs more budget to continue. Approve an increase to resume.")
  2. An amber card in the Build Log with a budget input field (pre-filled with current max) + "Approve Increase" button.
  Both point to `POST /api/tasks/[id]/budget` which updates `task.config.maxBudgetUsd` and re-enqueues a new task_run for the current actor. Task state transitions from `input-required` back to `working` on approval.

### System Reset Surface

- **D-08:** System reset exposed via **two paths**:
  1. **Tamir-routed**: CEO types "reset system" in Tamir chat → routed to system-reset global skill. Agent executes the reset.
  2. **Dedicated /settings page**: A 6th nav item (Settings ⚙) added to the sidebar. The page has a "Danger Zone" section with a red "Reset System" button. A confirm modal warns: "This will delete all tasks, task runs, activity logs, and deliverables. Vault documents, company DNA, skills, and permanent employees are preserved." Calls `POST /api/system/reset`.
- **D-09:** The `/settings page` also shows system info (Node.js version, pnpm version, DB path, worker status) for dev convenience. No other settings for v10.

### Hire Request Approval (UI-09)

- **D-10:** Hire approval button (UI-09 — pending from Phase 3) renders inline in the Build Log when `task.state === 'input-required'` AND `task.metadata.inputType === 'hire_approval'`. Same pattern as budget approval: amber card with employee role description + Approve / Reject buttons. Calls `POST /api/hire_requests/[id]/approve` (built in Phase 2).

### Claude's Discretion

- Build log entry styling for retry vs. heartbeat vs. hire approval vs. budget approval cards (same amber card pattern, different icons/copy)
- Exact EEG fixture format and size (CSV vs EDF — choose what's easiest to process with standard Python libraries)
- Supervisor greeting message content after taking over the review
- Exact /settings page layout and system info items

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Deliverable Workspace (primary spec)
- `docs/07_DELIVERABLE_WORKSPACE.md` — Complete split-pane layout spec: chat panel, participant avatars, chat restoration from JSONL, Deliverable tab (primaryFile rendering), Agent Log tab (activity_log rows), Build Log tab (SSE + partial messages), Files tab (two sections, inline preview), `deliverable_manifest.json` structure, path traversal prevention

### Acceptance Scenarios
- `docs/09_TASK_SCENARIOS.md` — Full step-by-step walkthroughs for Scenario A (CMO video) and Scenario B (CTO EEG classifier). Phase 4 must implement the system so these scenarios execute end-to-end.

### Visual Design (carry-forward from Phase 3)
- `docs/12_VISUAL_GUIDELINES.md` — ALL CSS variables, component styles, badge colors (action type badges for Agent Log, amber cards for approvals). Copy verbatim.

### Task State Machine + A2A
- `docs/03_A2A_PROTOCOL.md` — State machine, actor model (`currentActorId`), supervisor handoff pattern
- `src/lib/state-machine.ts` — `transitionTask()` + `VALID_TRANSITIONS` — use for all state transitions in supervisor flow and budget resume
- `src/a2a/types.ts` — A2A TypeScript interfaces

### Existing Tools (Phase 2 — Phase 4 extends these)
- `src/lib/mcp/tools/review.ts` — `submit_for_review`, `approve_deliverable`, `request_changes` implementations — Phase 4 adds task_run enqueue calls inside these tools
- `src/lib/mcp/tools/hire.ts` — `hire_employee` tool — hire approval UI in build log calls the API built in Phase 2

### Worker Loop (Phase 1 — Phase 4 enqueues into this)
- `src/lib/worker.ts` — Task run polling loop. Phase 4 adds task_run rows for supervisor invocation; no changes to the worker itself.
- `src/lib/invoke-agent.ts` — `invokeAgent()` wrapper, api_retry event handling (already logs retry events)

### Architecture + Canonical Decisions
- `docs/00_VISION_PRODUCT_BACKGROUND.md` §Canonical Implementation Decisions — 27 locked decisions. Especially: #4 (outputFormat always), #17 (chat JSONL paths), #27 (maxDuration=120 on agent routes)
- `docs/01_SYSTEM_ARCHITECTURE.md` — File system layout (desk/, deliverables/, manifest path)

### Error Handling
- `docs/10_CONFIGURATION_DEPLOYMENT.md` — `.env.local` keys + budget configuration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/invoke-agent.ts`: Already emits `task:buildlog` SSE events per partial message + logs `api_retry` — Build Log tab subscribes to these events directly
- `src/lib/mcp/tools/review.ts`: `submit_for_review` + `approve_deliverable` + `request_changes` built in Phase 2 — Phase 4 adds task_run enqueue calls to `submit_for_review` and `request_changes`
- `src/app/deliverables/page.tsx` + `DeliverablesClient.tsx`: Gallery page exists — `/deliverables/[id]` is a new route alongside it
- `src/app/api/sse/route.ts`: SSE endpoint already streams `task:buildlog`, `task:heartbeat`, `task:transition`, `hire:requested` — Build Log tab uses `EventSource` filtered to the specific taskId
- `src/lib/events.ts`: `eventBus` singleton — all emitters established; Phase 4 adds `task:review` event type for supervisor handoff
- `src/app/api/tasks/[taskId]/approve/route.ts`: Existing approve route creates task_run (status=queued) — same pattern for supervisor task_run enqueue

### Established Patterns
- Worker picks up `task_runs` rows with `status=queued` — Phase 4 adds supervisor and re-execution rows using the same pattern; no changes to worker
- Split pane: Phase 3 /tamir page already implements a chat + canvas split — deliverable workspace reuses the same CSS split-pane classes
- Chat JSONL on filesystem: chat loaded via `GET /api/tasks/[taskId]/chat`; deliverable workspace fetches the same JSONL then adds the "plan approved" divider
- SSE filtered by taskId: clients filter `task:buildlog` events by taskId from SSE stream; Build Log tab adds `includePartialMessages:true` context to the stream filter
- Inline approval cards in build log: hire approval (UI-09) pattern extends to budget approval (same amber card, different copy)

### Integration Points
- New routes: `app/deliverables/[id]/page.tsx` (split-pane workspace), `app/settings/page.tsx` (danger zone + system info)
- New API routes: `POST /api/deliverables/[id]/chat`, `GET /api/deliverables/[id]/file?path=...`, `POST /api/tasks/[id]/budget`, `POST /api/system/reset`
- Sidebar update: `app/layout.tsx` adds Settings ⚙ as 6th nav item
- `submit_for_review` in `src/lib/mcp/tools/review.ts` needs task_run insert for supervisor
- `request_changes` in same file needs task_run insert for executor + `currentActorId` update
- `approve_deliverable` triggers skill extraction: re-invokes supervisor (or a designated skill-extractor agent) for the extraction pass

</code_context>

<specifics>
## Specific Ideas

- Budget exceeded is an **escalation**, not just a technical error — the chat message should feel like the agent is notifying the CEO, not just a system alert: "I've hit the budget limit set for this task ($X). I can continue if you authorize additional budget — let me know how much more to allocate."
- The supervisor review loop should be **fully visible** to the CEO through the build log — they should see: executor calls submit_for_review → supervisor task_run enqueued → supervisor invoked → supervisor decision → if request_changes, executor re-enqueued. The CEO is an observer here, not a gatekeeper.
- Acceptance Scenario B (EEG): the test EEG fixture should be meaningful enough that a Python SVM classifier can actually train and produce a real confusion matrix or accuracy metric — not just a hello-world script.

</specifics>

<deferred>
## Deferred Ideas

- Tamir 15-minute cron (COORD-02) — v2 per prior Phase 2 decisions
- Cross-agent consultation via `consult_agent` tool (COORD-01) — v2
- HTTP/JSON-RPC A2A transport — v10.1+
- Org Chart, Budget tracking, Skills management, DNA editor pages — v10.1

</deferred>

---

*Phase: 04-deliverable-workspace-integration*
*Context gathered: 2026-03-26*
