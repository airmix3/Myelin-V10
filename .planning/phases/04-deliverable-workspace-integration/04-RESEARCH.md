# Phase 4: Deliverable Workspace + Integration - Research

**Researched:** 2026-03-26
**Domain:** Split-pane workspace UI, supervisor review loop, skill extraction, acceptance testing, system reset
**Confidence:** HIGH

## Summary

Phase 4 is the capstone phase that connects all prior work into a functioning end-to-end system. It has three distinct domains: (1) the deliverable workspace UI (`/deliverables/[id]`) with split-pane layout, chat continuation, tabbed workspace (Deliverable/Agent Log/Build Log/Files), and inline approval cards; (2) backend orchestration for the supervisor review loop (enqueue task_runs for supervisor after `submit_for_review`, auto-re-enqueue executor on `request_changes`, trigger skill extraction after `approve_deliverable`); (3) integration hardening including error handling UX, budget enforcement flow, system reset API + settings page, and two acceptance scenarios proving agents do real work.

The existing codebase provides nearly all the building blocks. The worker loop already processes `task_run` rows. The review tools (`submit_for_review`, `approve_deliverable`, `request_changes`) exist but need task_run enqueue calls added. The SSE event bus streams `task:buildlog` events. The Tamir page demonstrates the split-pane CSS pattern. The hire approval route demonstrates the exact pattern for creating task_runs with session resume. No new libraries or infrastructure are needed.

**Primary recommendation:** Build the workspace UI components first (reusing ChatPanel and split-pane CSS from Phase 3), then wire up the supervisor review loop by adding task_run inserts to the existing review tools, then layer on error/budget UX and the settings page, and finally validate with the two acceptance scenarios.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `submit_for_review` enqueues a new `task_run` row (status=queued, agentId=supervisorAgentId) -- the existing worker loop picks it up exactly like any execution run.
- **D-02:** `request_changes` sets `currentActorId` back to the executor AND auto-enqueues a new `task_run` for the executor automatically -- no CEO intervention required.
- **D-03:** Scenarios pass when agents produce real output artifacts. Scenario A (CMO): real video deliverable. Scenario B (CTO): real Python execution with real EEG metrics/plots. Text-only does not pass.
- **D-04:** Agents use SDK `preset: claude_code` native capabilities for web search and Python execution -- no custom web_search MCP tool needed.
- **D-05:** Phase 4 ships a test EEG fixture file (e.g., `data/test-fixtures/eeg-sample.csv`) so Scenario B has real data.
- **D-06:** SDK `api_retry` events surfaced in Build Log UI only (amber "Retrying..." entry) -- no custom backoff wrapper on top of SDK retry.
- **D-07:** Budget exceeded creates a dual signal: system message in chat panel + amber card in Build Log with budget input + "Approve Increase" button. Task transitions input-required -> working on approval.
- **D-08:** System reset via two paths: Tamir-routed (uses system-reset global skill) and dedicated /settings page with danger zone.
- **D-09:** /settings page also shows system info (Node.js version, pnpm version, DB path, worker status).
- **D-10:** Hire approval button renders inline in Build Log when task is input-required with metadata.inputType=hire_approval. Same amber card pattern as budget approval.

### Claude's Discretion
- Build log entry styling for retry vs. heartbeat vs. hire approval vs. budget approval cards (same amber card pattern, different icons/copy)
- Exact EEG fixture format and size (CSV vs EDF -- choose what's easiest for Python processing)
- Supervisor greeting message content after taking over review
- Exact /settings page layout and system info items

### Deferred Ideas (OUT OF SCOPE)
- Tamir 15-minute cron (COORD-02) -- v2
- Cross-agent consultation via consult_agent tool (COORD-01) -- v2
- HTTP/JSON-RPC A2A transport -- v10.1+
- Org Chart, Budget tracking, Skills management, DNA editor pages -- v10.1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-09 | Hire request approval in deliverable workspace build log | Existing hire approve API at `/api/hire_requests/[id]/approve`; amber card pattern from Doc 12; D-10 specifies inline build log rendering |
| DELIV-01 | `/deliverables/[id]` split-pane: 400px chat left, tabbed workspace right | Doc 07 full layout spec; split-pane CSS from Tamir page (`.split-pane`, `.split-chat`, `.split-canvas`); tab CSS from Doc 12 |
| DELIV-02 | Chat panel: restore planning JSONL, divider, agent greeting, continued chat | Existing `GET /api/tasks/[taskId]/chat` returns JSONL; ChatPanel component reusable; new `POST /api/deliverables/[id]/chat` route needed |
| DELIV-03 | Deliverable tab: render primaryFile from manifest (md/image/video/PDF) | Manifest structure defined in Doc 07; marked.js for markdown; native HTML for media; Deliverable.workspacePath + manifest.primaryFile |
| DELIV-04 | Build Log tab: live SSE partial events, expandable entries, heartbeat | `task:buildlog` SSE events already emitted by `invoke-agent.ts`; useSSE hook available; log entry CSS from Doc 12 |
| DELIV-05 | Files tab: two sections, card grid, inline preview, path traversal prevention | Doc 07 file serving pattern with `path.resolve` + `startsWith` guard; API route `GET /api/deliverables/[id]/file?path=...` |
| DELIV-06 | Agent Log tab: durable activity_log rows with SDK action types | activity_log table populated by invoke-agent.ts (SDK_ASSISTANT, SDK_TOOL_SUMMARY, etc.); badge colors from Doc 12 |
| DELIV-07 | Supervisor review flow: submit_for_review triggers supervisor invocation | D-01: add task_run enqueue to submit_for_review; follow hire approval route pattern for task_run creation with session resume |
| DELIV-08 | Skill extraction trigger after supervisor approves deliverable | D-01/D-02 pattern; after approve_deliverable, enqueue a second task_run for supervisor with skill-extractor skill; skill-extractor SKILL.md exists |
| INT-01 | LLM error handling: exponential backoff, empty response retry, tool failure logging | SDK handles api_retry natively; D-06: surface in Build Log UI; invoke-agent.ts already logs api_retry events |
| INT-02 | Budget enforcement: maxBudgetUsd on every query(), budget exceeded flow | D-07: dual signal (chat + build log); new `POST /api/tasks/[id]/budget` route; transition input-required -> working on approval |
| INT-03 | System reset: clear operational data, preserve vault/DNA/skills/employees | system-reset SKILL.md defines procedure; D-08: new `POST /api/system/reset` API; new /settings page |
| INT-04 | Acceptance Scenario A: CMO video -- routes, discovers tools, produces video, skill extracted | D-03/D-04: agent uses native SDK tools; no new infrastructure needed; manual acceptance test |
| INT-05 | Acceptance Scenario B: CTO EEG classifier -- real Python, real metrics/plots | D-05: test EEG fixture; D-03/D-04: agent uses SDK bash tool; manual acceptance test |
</phase_requirements>

## Architecture Patterns

### Deliverable Workspace Page Structure
```
src/app/deliverables/[id]/
  page.tsx           # Server component: fetch deliverable + task data
  WorkspaceClient.tsx  # Client component: split-pane, tabs, SSE, chat

src/components/
  WorkspaceChatPanel.tsx   # Smaller variant of ChatPanel (ws-bubble class)
  BuildLogPanel.tsx        # SSE-driven expandable log entries
  AgentLogPanel.tsx        # Durable activity_log table display
  FilesPanel.tsx           # Card grid + inline preview
  DeliverablePanel.tsx     # Render primaryFile by type
  MetadataBar.tsx          # ID, creator, dept, type, created, description
  ApprovalCard.tsx         # Amber card for hire/budget approvals in build log
```

### New API Routes
```
app/api/deliverables/[id]/
  chat/route.ts       # POST: route message to currentActorId
  file/route.ts       # GET: serve workspace files with traversal prevention

app/api/tasks/[id]/
  budget/route.ts     # POST: increase budget, re-enqueue task_run

app/api/system/
  reset/route.ts      # POST: system reset per INT-03

app/settings/
  page.tsx            # Settings page with danger zone
```

### Pattern 1: Supervisor Task Run Enqueue (in review.ts)
**What:** When `submit_for_review` is called, it now also creates a new `task_run` row for the supervisor agent, following the exact same pattern used by the hire approval route.
**When to use:** Every time `submit_for_review` or `request_changes` is called.
**Example:**
```typescript
// In submit_for_review handler, AFTER setting currentActorId to supervisor:
const supervisorEmployee = sqlite.prepare(
  'SELECT id FROM employees WHERE agentId = ?'
).get(task.supervisorAgentId) as { id: string } | undefined;

if (supervisorEmployee) {
  // Find previous run for session resume
  const prevRun = sqlite.prepare(
    'SELECT sessionId, workspaceCwd FROM task_runs WHERE taskId = ? ORDER BY createdAt DESC LIMIT 1'
  ).get(ctx.taskId) as { sessionId: string | null; workspaceCwd: string | null } | undefined;

  sqlite.prepare(`
    INSERT INTO task_runs (id, taskId, employeeId, status, sessionId, workspaceCwd, createdAt)
    VALUES (?, ?, ?, 'queued', ?, ?, datetime('now'))
  `).run(generateId('run'), ctx.taskId, supervisorEmployee.id, null, prevRun?.workspaceCwd);
}
```

### Pattern 2: Skill Extraction After Approval
**What:** After `approve_deliverable` marks task completed, enqueue one more task_run for the supervisor to do the extraction pass using the skill-extractor global skill.
**When to use:** After every successful deliverable approval.
**Example:**
```typescript
// After approve_deliverable transitions to completed:
// Enqueue extraction run (supervisor reviews with skill-extractor context)
sqlite.prepare(`
  INSERT INTO task_runs (id, taskId, employeeId, status, workspaceCwd, createdAt)
  VALUES (?, ?, ?, 'queued', ?, datetime('now'))
`).run(generateId('run'), ctx.taskId, supervisorEmployee.id, prevRun?.workspaceCwd);
// Worker picks this up; the supervisor's soul.md already includes skill-extractor skill
```

### Pattern 3: Build Log Approval Cards
**What:** Inline amber cards in the build log for hire approvals (UI-09) and budget approvals (INT-02). Rendered client-side when SSE events indicate the task is in `input-required` state with specific `inputType`.
**When to use:** When `task:transition` SSE event fires with `to: 'input-required'` and metadata contains `inputType`.

### Pattern 4: File Serving with Path Traversal Prevention
**What:** API route serves files from workspace directory with strict path validation.
**When to use:** Files tab, Deliverable tab.
**Example:**
```typescript
// Source: Doc 07 deliverable workspace spec
const workspace = deliverable.workspacePath;
const target = path.join(workspace, requestedPath);
// Security: prevent path traversal
if (!target.startsWith(path.resolve(workspace))) {
  return new Response('Forbidden', { status: 403 });
}
```

### Anti-Patterns to Avoid
- **Do NOT modify the worker loop** -- Phase 4 only inserts task_run rows; the worker picks them up unchanged.
- **Do NOT create custom agent invocation logic** -- All supervisor/executor re-invocations go through the existing worker -> orchestrator -> invokeAgent pipeline.
- **Do NOT add custom A2A states** -- Review is just `working` with `currentActorId === supervisorAgentId`. No "review" state.
- **Do NOT poll for file changes** -- Use SSE events and on-demand API fetches for live updates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom parser | `marked.js` (already in project) | Handles GFM, tables, code blocks, images |
| File MIME detection | Custom MIME map | Extension-based map from Doc 07 | Only ~8 types needed; no external library |
| Agent invocation | Direct SDK query() call | Existing worker loop + task_run row insert | Keeps invocation pipeline consistent |
| SSE event filtering | Custom event filter | Existing `useSSE` hook + event type matching | Already handles reconnection |
| State transitions | Direct SQL UPDATE on state | `transitionTask()` from state-machine.ts | Atomic WHERE-on-current-state + SSE emit |
| Chat JSONL parsing | Custom file reader | Existing `GET /api/tasks/[taskId]/chat` route | Already handles JSONL parsing |

## Common Pitfalls

### Pitfall 1: Supervisor Run Without Workspace CWD
**What goes wrong:** Supervisor task_run is enqueued without a `workspaceCwd`, so the worker falls back to a generic path that doesn't contain the executor's deliverables.
**Why it happens:** The submit_for_review tool runs inside the executor's context, but the task_run row needs the workspace path for the supervisor.
**How to avoid:** Always copy `workspaceCwd` from the most recent task_run for the same taskId when creating supervisor/executor re-invocation runs. The hire approval route already demonstrates this pattern.
**Warning signs:** Supervisor agent says "no files found" or "deliverables directory is empty."

### Pitfall 2: Skill Extraction Enqueue on Already-Completed Task
**What goes wrong:** After `approve_deliverable` transitions task to `completed`, the extraction task_run enqueue fails because the worker tries to transition the task from `submitted` to `working`, but it's already `completed`.
**Why it happens:** The worker's `executeRun()` transitions task to working if it's in submitted state.
**How to avoid:** The extraction run should NOT attempt any state transition on the parent task. Either: (a) use a separate "extraction task" that references the original task, or (b) have the worker skip state transition when the task is already in a terminal state. Option (b) is simpler -- the worker already checks `if (currentState === 'submitted')` before transitioning.
**Warning signs:** Worker logs show "Invalid state transition: completed -> working."

### Pitfall 3: Dual DB Access (Prisma vs SQLite) in Review Tools
**What goes wrong:** Review tools use raw `sqlite` for queries but the approve route uses `prisma`. Mixing can cause stale reads if Prisma's connection pool has a different view.
**Why it happens:** Phase 2 review tools were written with raw sqlite; Phase 3 routes use Prisma.
**How to avoid:** The review tools already use raw sqlite consistently. New API routes (budget, system reset) should use the same DB access pattern as the file they're in. For review.ts modifications, continue using raw sqlite. For new API routes, use prisma (consistent with Phase 3 patterns).
**Warning signs:** State appears inconsistent between UI and API responses.

### Pitfall 4: SSE Event Filtering for Build Log
**What goes wrong:** Build Log tab shows events from ALL tasks, not just the current deliverable's task.
**Why it happens:** The SSE endpoint streams all events to all clients. Filtering must happen client-side.
**How to avoid:** In the BuildLogPanel component, filter `task:buildlog` events by matching `data.taskId === currentTaskId`. The existing useSSE hook passes raw event data -- add taskId filtering in the handler callback.
**Warning signs:** Build log shows entries from unrelated tasks.

### Pitfall 5: Budget Increase Re-Enqueue Without Session Resume
**What goes wrong:** After budget increase, a new task_run is created but without the previous `sessionId`, causing the agent to start from scratch rather than continuing where it left off.
**Why it happens:** Budget approval route doesn't look up the previous run's session.
**How to avoid:** Follow the hire approval pattern exactly: find the previous task_run, copy its sessionId and workspaceCwd into the new run.
**Warning signs:** Agent re-executes the entire plan from the beginning after budget increase.

### Pitfall 6: Path Traversal in File Serving Route
**What goes wrong:** An attacker (or malformed request) accesses files outside the workspace.
**Why it happens:** `path.join(workspace, '../../etc/passwd')` resolves outside workspace.
**How to avoid:** Use `path.resolve()` on the joined path and check it `startsWith(path.resolve(workspace))`. Doc 07 shows the exact pattern.
**Warning signs:** Files from outside workspace directories are accessible via the API.

### Pitfall 7: Chat Panel Routing After Actor Change
**What goes wrong:** CEO sends a chat message in the workspace but it routes to the wrong agent because `currentActorId` changed (e.g., from executor to supervisor) and the UI didn't update.
**Why it happens:** The chat route reads `currentActorId` at request time, but the UI might show stale state.
**How to avoid:** The `POST /api/deliverables/[id]/chat` route should always read the current `currentActorId` from the database at call time, not from cached client state. The UI should listen for `task:review` SSE events to update the displayed actor.
**Warning signs:** Messages go to the executor when the supervisor should be the active actor.

## Code Examples

### Workspace Page Data Loading (Server Component)
```typescript
// app/deliverables/[id]/page.tsx
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import WorkspaceClient from './WorkspaceClient';

export default async function DeliverableWorkspacePage({ params }: { params: { id: string } }) {
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: params.id },
    include: { task: true },
  });
  if (!deliverable) notFound();

  // Load chat history from JSONL
  const chatRes = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/tasks/${deliverable.taskId}/chat`);
  const chatData = chatRes.ok ? await chatRes.json() : { messages: [] };

  // Load activity log
  const activityLog = await prisma.activityLog.findMany({
    where: { taskId: deliverable.taskId },
    orderBy: { createdAt: 'asc' },
  });

  return <WorkspaceClient
    deliverable={deliverable}
    task={deliverable.task}
    initialChat={chatData.messages}
    activityLog={activityLog}
  />;
}
```

### Build Log Entry Component Pattern
```typescript
// AmberCard in build log for hire/budget approvals
function ApprovalCard({ type, data, onAction }: {
  type: 'hire_approval' | 'budget_increase' | 'retry';
  data: Record<string, unknown>;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
}) {
  return (
    <div className="log-entry" style={{ borderColor: 'var(--amber)' }}>
      <div className="log-entry-header" style={{ background: 'rgba(255,179,71,0.08)' }}>
        <span className="log-type-tool">{type === 'hire_approval' ? 'HIRE' : 'BUDGET'}</span>
        <span>{/* description */}</span>
      </div>
      <div className="log-entry-body" style={{ display: 'block' }}>
        {/* Approval buttons */}
        <button className="btn-approve btn-sm" onClick={() => onAction('approve')}>
          Approve
        </button>
      </div>
    </div>
  );
}
```

### System Reset API Route Pattern
```typescript
// POST /api/system/reset
// Per INT-03 and system-reset SKILL.md procedure
// Delete order matters for foreign keys:
// 1. task_runs, 2. cost_events, 3. activity_log, 4. hire_requests,
// 5. deliverables, 6. tasks, 7. non-vault documents,
// 8. reset employee budgets, 9. terminate temp employees
```

### EEG Test Fixture (CSV format recommended)
```
# data/test-fixtures/eeg-sample.csv
# Multi-channel EEG recording: 4 channels, 256Hz, 10 seconds
# Labeled epochs: 0=rest, 1=motor_imagery
timestamp,Fp1,Fp2,C3,C4,label
0.000,12.3,-5.1,8.7,-3.2,0
0.004,13.1,-4.8,9.2,-2.9,0
...
```
CSV is recommended over EDF because standard Python libraries (pandas, numpy, scikit-learn) can process it directly without specialized EEG libraries like mne-python. The fixture should contain ~2560 rows (10 seconds at 256Hz) with clear binary labels so an SVM can produce a real confusion matrix.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom agent invocation in review tools | Task_run enqueue + worker pickup | Phase 4 (this phase) | Consistent invocation pipeline for all agents |
| No skill extraction | Automatic extraction pass after approval | Phase 4 (this phase) | Agents learn from every completed task |
| System reset via direct DB manipulation | Dedicated API + UI with confirmation | Phase 4 (this phase) | Safe, auditable reset process |

## Open Questions

1. **Skill extraction task_run vs. separate extraction task**
   - What we know: D-01 says supervisor task_run enqueue. After approval, we need another run for extraction.
   - What's unclear: Should the extraction run reuse the same task (now completed) or create a separate lightweight extraction task?
   - Recommendation: Reuse the same task. The worker should skip state transition for completed tasks. The supervisor's soul.md + skill-extractor skill is sufficient context. This avoids creating orphan "extraction tasks" that clutter the UI.

2. **Budget exceeded detection mechanism**
   - What we know: SDK throws on budget exceeded; invoke-agent.ts catches it in the error handler.
   - What's unclear: The exact error message/type from SDK when maxBudgetUsd is exceeded.
   - Recommendation: Check the error message in the catch block of executeRun for "budget" keyword. Transition to input-required with metadata.inputType=budget_increase instead of failing.

3. **Chat continuation routing for workspace**
   - What we know: `POST /api/deliverables/[id]/chat` routes to currentActorId.
   - What's unclear: Should this be a planning-style invocation (with outputFormat) or a free-form chat?
   - Recommendation: Free-form chat (no outputFormat) since the workspace chat is for status questions and ad-hoc interaction, not structured turn routing.

## Project Constraints (from CLAUDE.md)

- **TypeScript/Node.js only** -- no Python in the application layer (agents may run Python via SDK bash tool in their desk)
- **Custom CSS variables only** -- no Tailwind, no Bootstrap; use cortex.css design system
- **SQLite via Prisma** (with better-sqlite3 for raw SQL where needed)
- **Standard A2A states only** -- submitted, working, input-required, completed, failed, canceled
- **SDK First** -- use Claude Agent SDK built-ins before any custom implementation
- **Next.js 14 App Router** with Server Components for data loading, Client Components for interactivity
- **SSE for live updates** -- no WebSocket, no polling
- **Zod v4** (not v3) for any new schemas
- **marked.js** for markdown rendering
- **proper-lockfile** for concurrent file access
- **CSS copied verbatim from Doc 12** -- canonical source for all visual tokens

## Sources

### Primary (HIGH confidence)
- `docs/07_DELIVERABLE_WORKSPACE.md` -- Complete split-pane layout spec, file serving pattern, manifest structure
- `docs/09_TASK_SCENARIOS.md` -- Acceptance scenario walkthroughs
- `docs/03_A2A_PROTOCOL.md` -- State machine, actor model, supervisor handoff
- `docs/12_VISUAL_GUIDELINES.md` -- All CSS variables, badge classes, log entry styling
- `src/lib/mcp/tools/review.ts` -- Existing review tools implementation
- `src/lib/invoke-agent.ts` -- SDK event streaming, buildlog emission, cost tracking
- `src/lib/worker.ts` -- Worker loop, executeRun pattern
- `src/app/api/hire_requests/[id]/approve/route.ts` -- Canonical pattern for task_run enqueue with session resume
- `src/app/api/tasks/[taskId]/approve/route.ts` -- Deliverable creation + task_run enqueue on approval
- `src/lib/state-machine.ts` -- transitionTask with atomic WHERE-on-current-state
- `src/components/ChatPanel.tsx` -- Reusable chat component with avatar colors
- `src/components/useSSE.ts` -- SSE hook with addEventListener pattern
- `prisma/schema.prisma` -- Full database schema

### Secondary (MEDIUM confidence)
- `04-CONTEXT.md` -- All user decisions (D-01 through D-10)
- `data/departments/global/skills/skill-extractor/SKILL.md` -- Extraction procedure
- `data/departments/global/skills/system-reset/SKILL.md` -- Reset procedure with deletion order

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, no new dependencies needed
- Architecture: HIGH - Patterns established in Phases 1-3, this phase extends them
- Pitfalls: HIGH - Based on direct code analysis of existing implementations
- Acceptance scenarios: MEDIUM - Agent behavior is non-deterministic; scenarios depend on SDK capabilities working correctly

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- all patterns are internal to the codebase)
