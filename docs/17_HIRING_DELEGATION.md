# 17 -- Hiring & Delegation: Employee Lifecycle, Delegation Judgment, and Sub-Execution

## Overview

Department heads (CTO, CMO, COO) are managers, not just executors. They have the skill and judgment to decide when a piece of work is better handled by a specialized employee rather than themselves. This document defines how employees are hired, how delegation works, how sub-tasks execute through the worker pipeline, and how communication flows between head and employee.

**Core principle:** Delegation is a judgment call by the department head -- not a system-enforced workflow. The head's soul and delegationplan skill teach it *when* to delegate (clear capability gap, one-time specialized need, large context it doesn't want to absorb) and *when not to* (simple enough to do directly, reqopeuires cross-cutting context only the head has).

## Two Kinds of Employees

### Permanent Employees

Long-lived agents that persist across tasks. They have a defined role, expertise, and belong to exactly one department. Examples: Market Researcher under CMO, Backend Engineer under CTO.

- Created via hire request with CEO approval
- Persist indefinitely, available for any task in their department
- Have a full `soul.md` written by the department head, approved by CEO
- Appear in the org tree

### Temporary Employees

Disposable agents hired for a specific sub-task within a single task execution. Created when the head is convinced the sub-task requires specialized context or tools that the head doesn't have and won't need again.

**When to hire a temp:**

- The sub-task requires absorbing a huge context the head shouldn't carry (e.g., summarizing a 300-page document)
- The sub-task needs specialized tools/skills not generally useful to the department (e.g., a one-off video transcription tool)
- The work is clearly one-shot -- what the employee learns today won't help it do better tomorrow

**Lifecycle:** Temps are **terminated when the parent task completes**. Their `Employee` record is set to `status: "terminated"` and they no longer appear anywhere in the system (not in org tree, not in `list_my_employees`, not in UI). No promotion path. If a head keeps needing the same kind of temp, that's a signal to hire a permanent employee instead.

```
[hire request] -> pending -> approved -> active -> terminated (on task completion)
                         \-> rejected
```

### What Defines Employee Capabilities

An employee's capabilities are a structured summary derived from their `soul.md`. The soul defines who they are; the capabilities summary is what the head sees when deciding whether to delegate.

```json
{
  "agentId": "mkt_researcher_01",
  "name": "Alex Chen",
  "role": "Market Research Analyst",
  "specialty": "competitive analysis, market sizing, trend reports",
  "outputTypes": ["report", "analysis", "data_table"],
  "description": "Researches markets, analyzes competitors, produces structured reports with data backing"
}
```

This is stored in the `Employee` record and surfaced via the `list_my_employees` tool.

## Hiring Process

### When Hiring Happens

Hiring can happen during planning or during execution:

- **During planning:** Head realizes the plan requires expertise it doesn't have. Requests hire before CEO approval.
- **During execution:** Head encounters a sub-task mid-work that would benefit from delegation. Requests hire inline.

### Hire Request Flow

1. Head calls `hire_employee` tool with role description, specialty, justification, type (temp/permanent), and a `soul.md` draft for the employee
2. System creates a `HireRequest` record
3. **CEO escalation** (configurable):
  - **Default:** Task transitions to `input-required` with `inputType: "hire_approval"`. CEO sees the request in Kanban / `/escalations` with the employee's proposed title, specialties, and soul draft. CEO approves or rejects.
  - **Configurable per-company:** Some CEOs may set `hiring.tempAutoApprove: true` to let heads hire temps autonomously, or `hiring.autoApprove: true` for full autonomy. CEO still gets an activity log notification.
4. On approval: Employee record created with soul configuration, tools assigned, agent registered in orchestrator, ready for delegation

### Agent Registration

The orchestrator (`src/lib/orchestrator.ts`) currently registers 4 agents at startup (Tamir, CTO, CMO, COO). Employees need registration too so they appear in analytics, logging, and the agent registry.

The orchestrator needs a `registerAgent(agentId, soul, config)` method, called by:

- **Startup:** Register permanent employees alongside dept heads
- **Hire approval route:** Register temp employees dynamically when CEO approves
- **Temp cleanup:** Unregister on task completion when temp is terminated

### CEO-Created Employees (UI Feature)

The CEO can proactively create employees from the Cortex UI without waiting for a head to request one:

1. CEO navigates to org tree / employee management
2. Describes what the employee does, what tasks they typically handle, their specialties
3. System generates a `soul.md` and agent configuration from the description
4. CEO assigns tools, skills, and department
5. **Employee evaluation mode:** CEO can test the employee before deploying -- provide sample input, see what the employee produces, iterate on the soul/tools until satisfied (similar to testing an n8n sub-workflow)
6. Once satisfied, employee is activated and visible to the department head

This is a significant UI feature -- documented here for completeness but implementation is a separate phase.

## Delegation: The Head's Judgment Call

Delegation is **not** a system-enforced routing decision. It's a skill embedded in the department head's soul and tool awareness. The head's soul includes guidance on delegation patterns:

- "When you receive a task, assess whether any of your employees are better suited for specific components"
- "Use `list_my_employees` to check your roster and match capabilities to task requirements"
- "Delegate when the sub-task requires deep specialized context you don't have, or tools you don't normally use"
- "Keep orchestration and final assembly to yourself -- delegate components, not judgment"
- "If an employee's output doesn't meet your standards, re-delegate with better explanation. If it still falls short, consider doing it yourself at the head level."

### Two Delegation Modes

These are **two distinct modes with no overlap**:

#### Mode 1: Full Task Delegation (Planning Phase)

The head decides during planning that a permanent employee should execute the entire task. The employee becomes the sole executor. **No sub-tasks, no orchestration.** This is standard executor/supervisor flow.

**When it applies:** The entire task is within one employee's capabilities and doesn't need the head's orchestration.

**Mechanism:**

1. Head plans with CEO, identifies the right executor from its roster
2. Head stores its recommendation in task metadata: `metadata.recommendedExecutor = "mkt_researcher_01"`
3. In the approval UI, the CEO sees a **dropdown of department employees** with the head's recommendation pre-selected. CEO can accept or pick a different employee.
4. On approval, the system sets `executorAgentId` = selected employee, `supervisorAgentId` = head
5. Worker invokes the employee for execution (standard task_run, standard pipeline)
6. Employee works in the standard task workspace (`data/workspaces/{taskId}/desk/`)
7. On completion, head reviews as supervisor (existing review flow)

**Actor model:**


| Role              | Agent                                             |
| ----------------- | ------------------------------------------------- |
| planningAgentId   | Department head                                   |
| executorAgentId   | Employee                                          |
| supervisorAgentId | Department head                                   |
| currentActorId    | Employee (during execution), Head (during review) |


This reuses the existing executor/supervisor split with zero new architecture.

#### Mode 2: Head-as-Executor with Sub-Task Delegation (During Execution)

The head IS the executor. It starts executing the task itself, and during execution, it can delegate specific components to employees. The head orchestrates -- deciding what to delegate, to whom, in what order, and assembling the results.

**When it applies:** The task needs the head's orchestration across multiple components, or only parts of the task benefit from delegation.

**Example: CMO competitive advantage video**

```
CMO receives: "Create a competitive advantage video"
CMO is the executor. CMO orchestrates:
  1. delegate_subtask → market_researcher: "Research top 5 BCI competitors"
     → CMO's session ends (cold suspend), employee runs via worker
     → employee completes, CMO re-invoked with session_id + results
  2. delegate_subtask → media_specialist: "Create visuals from this research"
     → same cold suspend/resume cycle
  3. delegate_subtask → video_editor: "Produce 3-min video with these assets"
     → same cold suspend/resume cycle
  4. CMO reviews video, requests changes if needed (another delegate_subtask)
  5. CMO assembles final deliverable for CEO
```

The head orchestrates each step sequentially. It decides what to delegate next based on what came back from the previous step and can also do stuff himself.

## Sub-Task Execution: Cold Suspend/Resume via Worker

### Same Pattern as Everything Else

The system already uses cold suspend/resume for every multi-step flow:

- **Tamir routing:** Tamir invoked cold → routes → session ends
- **Planning turns:** Head invoked cold → plans → session saved → CEO asks follow-up → head re-invoked with session_id
- **Hire approval:** Head requests hire → session ends → CEO approves → head re-invoked with session_id
- **CEO escalation:** Head needs input → session ends → CEO responds → head re-invoked with session_id

Sub-task delegation is the **exact same pattern**:

- Head delegates → **session ends** → employee runs via worker → employee completes → **head re-invoked with session_id + results**

No new architecture. No bridge. No warm sessions. No slot management. Just the existing worker pipeline.

### Execution Flow

```
T+0s    Worker claims head's task_run, invokes head's query() (COLD)
T+5s    Head does some work, decides to delegate
T+8s    Head calls delegate_subtask tool
        │
        │  Tool handler:
        │  1. Creates subtasks/st_abc123/ directory
        │  2. Symlinks shared files into subtask workspace
        │  3. Creates employee task_run in DB:
        │     { taskId, subtaskId: "st_abc123", employeeId: "mkt_researcher_01",
        │       parentRunId: head's run ID, status: "queued",
        │       onComplete: { action: "resume_parent", parentRunId: "..." } }
        │  4. Writes delegation_log.jsonl entry
        │  5. Returns: "Sub-task delegated to Alex Chen. You will be re-invoked with results."
        │
T+8s    Head's query() receives tool result, produces final message
T+9s    Head's query() ENDS (session saved via session_id)
T+9s    Worker marks head's task_run as 'paused'
        │  RAM FREED — head's SDK process exits
        │
T+10s   Worker claims employee's task_run (standard claim, uses freed slot)
T+10s   Worker invokes employee query() (COLD):
        │  - cwd: subtasks/st_abc123/
        │  - tools: restricted employee set
        │  - full build log streaming via SSE (to sub-task context)
        │  - standard cost tracking + heartbeat
        │
T+40s   Employee calls submit_deliverable, writes deliverable.json
T+42s   Employee's query() completes
T+42s   Worker marks employee's run as 'completed'
        │
        │  Worker onRunComplete handler:
        │  1. Reads onComplete: { action: "resume_parent", parentRunId: "..." }
        │  2. Reads deliverable.json from subtask workspace
        │  3. Creates new head task_run:
        │     { taskId, status: "queued", sessionId: head's saved session,
        │       resumePrompt: "Sub-task completed. Results at ..." }
        │  4. Marks paused head run as 'completed' (superseded)
        │
T+44s   Worker claims head's new task_run
T+44s   Worker invokes head's query() with session_id (WARM RESUME):
        │  Resume prompt injected:
        │  "Sub-task st_abc123 completed by Alex Chen.
        │   Status: completed
        │   Output: subtasks/st_abc123/output/competitor_report.md
        │   Cost: $0.22
        │   Review the output and continue your execution."
        │
T+45s   Head reads output, continues with next step
T+47s   Head calls delegate_subtask again (media specialist) → same cycle
        ...
T+90s   Head assembles final deliverable
T+92s   Head's query() completes normally
T+92s   Worker marks head's run as 'completed'
```

### Task Run States

```
queued → executing → completed
                  → failed
                  → canceled
                  → paused
```

The `paused` status already exists in the worker for CEO terminal takeover. Delegation reuses it — different use case, same status. Both mean "this run is not actively executing and should be skipped during claim." For delegation, `paused` means the head's session is saved and a child employee run must complete before the head is re-invoked.

### Why Cold Suspend/Resume

- **No deadlock:** Head frees its worker slot AND its RAM when it suspends. The employee runs in the freed resources. No capacity games.
- **No new infrastructure:** No DelegationBridge singleton, no heartbeat hacks, no slot management. Just the existing worker + task_run pipeline.
- **Full visibility:** Every run (head and employee) goes through the same worker pipeline — build log streaming, SSE, activity log, cost tracking, heartbeat, cancellation.
- **Scales naturally:** 5 heads can all delegate simultaneously. Each one suspends, freeing its slot. 5 employees run. As employees complete, heads resume.
- **Session continuity:** The SDK's `session_id` restores the head's conversation context on re-invocation. Same mechanism used for hire approval and CEO escalation — already proven to work.

### Trade-off: Cold-Start Latency

Each suspend/resume cycle costs ~4-8 seconds of cold-start latency when the head is re-invoked. For a task with 3 sequential delegations, that's ~12-24 seconds of overhead total. Acceptable for the simplicity gained.

**Future optimization (see `FUTURE_WARM_AGENT_BRIDGE.md`):** A generalized warm agent bridge can keep the head in RAM while the employee runs, eliminating cold-start latency. The bridge is a capacity-aware dual-path system: warm when RAM allows, cold suspend when at capacity. The tool API stays identical from the head's perspective — same `delegate_subtask` call, same results back. The bridge pattern generalizes beyond delegation to any agent wait point (hire approval, CEO escalation, cross-department tasks).

### Sub-Task Workspace Layout

```
data/workspaces/{taskId}/
├── desk/                              # Head's working directory (cwd)
│   ├── subtasks/
│   │   ├── st_abc123/                 # Employee 1's isolated workspace
│   │   │   ├── deliverable.json       # Sub-task manifest (written by employee)
│   │   │   ├── shared/                # Symlinks/copies of resources from parent
│   │   │   └── output/                # Employee's output files
│   │   ├── st_def456/                 # Employee 2's isolated workspace
│   │   │   └── ...
│   │   └── delegation_log.jsonl       # Ordered log of all delegations
│   └── ... (head's own working files)
├── deliverables/                      # Final CEO-visible deliverables
│   └── deliverable_manifest.json
└── chat.jsonl
```

### Sub-Task Deliverable Manifest

Each employee writes a `deliverable.json` in its sub-task directory via `submit_deliverable`:

```json
{
  "subtaskId": "st_abc123",
  "parentTaskId": "task_xyz",
  "assignedTo": "mkt_researcher_01",
  "description": "Research top 5 competitors in BCI space",
  "status": "completed",
  "summary": "Identified 5 key competitors: Neuralink, Kernel, NextMind, OpenBCI, Emotiv...",
  "primaryFile": "output/competitor_report.md",
  "iteration": 1,
  "completedAt": "2026-04-10T..."
}
```

## Head-Employee Communication

### During Delegation

Communication is **one-directional at delegation time**: the head provides task description, expected output, shared files, and budget via the `delegate_subtask` tool parameters. These are persisted in the employee's task_run record and workspace, so they survive the head's cold suspend.

### Employee Needs Input from Head

When an employee encounters ambiguity it can't resolve:

1. Employee calls `request_input` tool with a question
2. The tool writes the question to `deliverable.json` with `status: "needs_input"`
3. Employee's `query()` completes (it can't proceed without an answer)
4. Worker onComplete handler reads the `needs_input` status
5. Worker creates a new head task_run with resume prompt: "Employee Alex Chen needs your input: '{question}'"
6. Head is re-invoked with session_id, reads the question, decides the answer
7. Head calls `delegate_subtask` again with the answer baked into the task description → head suspends again, employee re-runs

```
Head executing → delegates → cold suspend
  Employee runs → hits ambiguity → request_input("Include stealth-mode competitors?") → session ends
    Head cold-resumes → reads question → re-delegates with clarification → cold suspend
      Employee runs again with clarified instructions → completes → session ends
        Head cold-resumes → reads output → continues
```

Each `request_input` costs one cold suspend/resume cycle for the head plus a new employee invocation. This naturally discourages over-asking -- the employee's soul should guide it to make reasonable assumptions and only ask when truly stuck.

### Escalation to CEO

Employees **cannot** escalate to the CEO directly. If an employee fails or needs input, it goes back to the head.

The head can escalate to the CEO at its own judgment. This is not hardcoded -- the head's soul guides when escalation is appropriate. The head uses the existing `escalate_to_ceo` tool that transitions the parent task to `input-required`.

## Review Cycle for Sub-Tasks

When the head is re-invoked after an employee completes, the resume prompt contains the sub-task results. The head reads the output and decides:

- **Satisfied:** Continues with the next step of its execution.
- **Not satisfied:** Calls `delegate_subtask` again to the same employee with better explanation and the previous output as shared context.
- **Still not satisfied after retry:** The head may choose to do the work itself at the head level.

The review is the employee's responsibility to initiate (via `submit_deliverable`), and the head's judgment to evaluate. No separate `review_subtask` tool -- the head reads the results on resume and acts. Retry guidance is in the head's `soul.md`, not enforced by the system.

### Iteration Tracking

The `delegation_log.jsonl` in the subtasks directory tracks all delegation attempts for audit purposes:

```jsonl
{"subtaskId":"st_abc123","employee":"mkt_researcher_01","description":"Research competitors","iteration":1,"status":"needs_input","question":"Include stealth-mode?","costUsd":0.15,"timestamp":"..."}
{"subtaskId":"st_abc124","employee":"mkt_researcher_01","description":"Research competitors (public only)","iteration":2,"status":"completed","costUsd":0.22,"timestamp":"..."}
```

## Tool Architecture

### Department Head Tools (Delegation-Related)


| Tool                | Purpose                                                | When Available          |
| ------------------- | ------------------------------------------------------ | ----------------------- |
| `list_my_employees` | Roster with capabilities, type, status                 | Planning + Execution    |
| `hire_employee`     | Request new employee (cold suspend, CEO escalation)    | Planning + Execution    |
| `delegate_subtask`  | Set up sub-workspace, queue employee run, cold suspend | Execution only (Mode 2) |


**Tool implementation:** `delegate_subtask` is a `tool()` callback (not MCP) because it needs process-local access to: the DB (to create task_runs), the filesystem (to create workspaces). Full deep-dive on tool implementation is deferred to implementation time.

The head does NOT get a `review_subtask` tool. Full task delegation (Mode 1) is a planning-phase decision expressed in the plan text and enforced at approval time by setting `executorAgentId`. Sub-task review (Mode 2) happens naturally when the head is re-invoked with employee results.

### Employee Tools (Restricted Set)


| Tool                          | Available    | Notes                                                                          |
| ----------------------------- | ------------ | ------------------------------------------------------------------------------ |
| Read, Write, Edit, Glob, Grep | Yes          | `cwd` set to sub-task directory                                                |
| Bash                          | Yes          | `cwd` set to sub-task directory                                                |
| WebSearch, WebFetch           | Per employee | Based on `toolWhitelist` in Employee record                                    |
| `submit_deliverable`          | Yes          | Writes `deliverable.json`, signals completion                                  |
| `request_input`               | Yes          | Writes question to `deliverable.json`, exits cleanly. Routed to head, NOT CEO. |
| `hire_employee`               | No           |                                                                                |
| `delegate_subtask`            | No           | No recursion -- single-level delegation only                                   |
| `escalate_to_ceo`             | No           | Goes through head                                                              |
| MCP servers                   | Per employee | Based on `toolWhitelist`                                                       |
| Department-specific tools     | Per employee | Head can grant specific tools at delegation time                               |


### Tool Assignment

Tools are determined by:

1. **Employee record `toolWhitelist`:** Static list of tools this employee type should have
2. **Delegation-time overrides:** The head can add specific tools when delegating (e.g., grant a transcription MCP server for a specific sub-task)

## Database Schema Changes

### Employee Extensions

```prisma
model Employee {
  // ... existing fields ...
  capabilities     String?  // JSON: summary of soul.md capabilities (for list_my_employees)
  toolWhitelist    String?  @map("tool_whitelist")   // JSON: default tools for this employee
}
```

No `maxBudgetPerTask` on the employee -- the head decides budget per-delegation based on its own task budget and real-time judgment.

### TaskRun Extensions

Add these fields to the existing `TaskRun` model (which already has `id`, `taskId`, `employeeId`, `status`, `sessionId`, `workspaceCwd`, `agents`, `claimedAt`, `heartbeatAt`, `completedAt`, `failedAt`, `failureReason`):

```prisma
model TaskRun {
  // ... existing fields ...

  // NEW: Sub-task support
  parentRunId        String?   @map("parent_run_id")       // FK to parent TaskRun (NULL for top-level)
  subtaskId          String?   @map("subtask_id")           // Unique sub-task identifier
  subtaskDescription String?   @map("subtask_description")  // What the employee should do
  onComplete         String?   @map("on_complete")          // JSON: completion action (e.g., resume_parent)

  // Status values: queued | executing | completed | failed | paused
  // 'paused' is used for both CEO terminal takeover and delegation (head waiting for employee)

  @@index([parentRunId])  // NEW index
}
```

Note: `employeeId`, `sessionId`, `workspaceCwd` already exist in the schema — no changes needed for those.

### `onComplete` Action Schema

The `onComplete` field tells the worker what to do when a run finishes:

```json
// Employee run → re-invoke the parent head with results
{
  "action": "resume_parent",
  "parentRunId": "run_abc",
  "subtaskId": "st_abc123"
}

// Top-level run → standard completion (default if onComplete is null)
{
  "action": "complete_task"
}
```

### CostEvent Extension

```prisma
model CostEvent {
  // ... existing fields ...
  runId       String?  @map("run_id")       // Specific task_run
  subtaskId   String?  @map("subtask_id")   // Sub-task identifier for breakdown
}
```

## Worker Integration

### Worker onRunComplete Handler (New Code)

The worker currently has no post-completion handler. Unlike hire approval (where the CEO approval API route creates the resume run), delegation has no external trigger — the employee finishes and the system must automatically resume the parent. A new `onRunComplete` function is needed, called at the end of `executeRun()` in its `finally` block.

```typescript
async function onRunComplete(run: TaskRun) {
  const onComplete = JSON.parse(run.onComplete ?? '{}');

  if (onComplete.action === 'resume_parent') {
    const parentRun = await getTaskRun(onComplete.parentRunId);
    if (parentRun.status !== 'paused') return; // guard against double-resume

    // Read the sub-task results
    const subtaskDir = path.join(taskWorkspace, 'desk', 'subtasks', onComplete.subtaskId);
    const deliverable = readSubtaskDeliverable(subtaskDir);

    // Store sub-task results in task.metadata (same pattern as escalationResponse)
    const taskMetadata = JSON.parse(task.metadata ?? '{}');
    taskMetadata.subtaskCompleted = true;
    taskMetadata.subtaskId = onComplete.subtaskId;
    taskMetadata.subtaskResultPath = subtaskDir;
    taskMetadata.subtaskSummary = deliverable?.summary;
    taskMetadata.subtaskStatus = deliverable?.status ?? run.status;
    taskMetadata.subtaskCostUsd = run.costUsd ?? 0;
    sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
      .run(JSON.stringify(taskMetadata), parentRun.taskId);

    // Create a new queued run for the head (resume with saved session)
    await createTaskRun({
      taskId: parentRun.taskId,
      employeeId: parentRun.employeeId,   // the head's agentId
      sessionId: parentRun.sessionId,     // resume the head's SDK session
      status: 'queued',
    });

    // Mark the paused run as completed (superseded by the new run)
    await updateTaskRun(onComplete.parentRunId, { status: 'completed' });
  }
}
```

The worker's `executeRun()` then reads `task.metadata.subtaskCompleted` (same pattern as `escalationResolved`) to build the resume prompt:

```typescript
if (run.sessionId && taskMetadata.subtaskCompleted) {
  prompt = [
    '## Sub-task Completed',
    '',
    `**Status:** ${taskMetadata.subtaskStatus}`,
    `**Results at:** ${taskMetadata.subtaskResultPath}`,
    `**Summary:** ${taskMetadata.subtaskSummary}`,
    `**Cost:** $${taskMetadata.subtaskCostUsd}`,
    '',
    'Review the output and continue your execution.',
  ].join('\n');

  // Clear metadata so subsequent resumes don't replay it
  const cleaned = { ...taskMetadata };
  delete cleaned.subtaskCompleted;
  delete cleaned.subtaskId;
  delete cleaned.subtaskResultPath;
  delete cleaned.subtaskSummary;
  delete cleaned.subtaskStatus;
  delete cleaned.subtaskCostUsd;
  sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
    .run(JSON.stringify(cleaned), taskId);
}
```

### Worker Cancellation

When a parent task is canceled:

1. All `task_runs` for this `taskId` with `status IN ('queued', 'executing', 'paused')` are set to `canceled`
2. If an employee is actively running, the next heartbeat check detects cancellation and terminates the run
3. No new runs are queued for a canceled task

Clean cascade: cancel task → cancel all runs → no orphans.

## State Machine: Parent-Child Interaction

### Normal Flow

```
Head run:     queued → executing → paused ──────────────── → completed (superseded)
                                     ↓
Employee run:                     queued → executing → completed
                                                         ↓
New head run:                                          queued → executing → ...
```

### Employee Failure

If an employee's run fails (crash, timeout, budget exceeded):

1. Worker marks the employee run as `failed`
2. onComplete handler still fires — creates a new head run with failure context instead of success context
3. Head resumes, sees the failure, and decides: retry with better explanation, try different employee, do it himself, or escalate
4. Parent task status stays `working` -- the failure is internal to the head's execution

### Budget Enforcement

- The head passes `budgetCents` to `delegate_subtask`
- The tool handler stores this in the employee's task_run config
- The worker enforces it via `maxBudgetUsd` on the employee's `query()` call
- The head manages its task budget in real-time -- no system-level per-employee budget caps
- If the employee exceeds budget, the SDK's enforcement kicks in, the run fails, and the head is resumed with the error

## Cost Attribution

All costs roll up to the parent task:

- `cost_events.taskId` = parent task ID (always)
- `cost_events.agentId` = the employee who incurred the cost
- `cost_events.subtaskId` = identifies which sub-task
- `task.totalCostUsd` = sum of head + all employee costs

CEO sees one total cost per task. The detailed breakdown is in the Activity Log.

## CEO Visibility

Sub-tasks are **internal to the department**. They do NOT appear in the CEO's Kanban board or task list.

What the CEO sees:

- One task with one total cost
- Activity Log entries: "CMO delegated 'competitor research' to Alex Chen" / "Sub-task completed ($0.22)"
- **Task Flow tab:** Employee nodes in the task timeline. Click an employee to see its execution log.
- **Agent Log tab:** Dropdown selector to pick which agent's log to view (head, employee 1, employee 2, etc.). Each agent involved in the task gets its own log stream.
- Files tab shows the `subtasks/` directory if the CEO browses the workspace

What the CEO does NOT see:

- Sub-tasks as separate Kanban items
- Sub-task review iterations
- Employee input requests (these are head-internal)

The head may choose to mention delegation in its chat messages, but this is the head's judgment, not system-enforced.

## Organizational Tree

Employees belong to exactly one department. No cross-department sharing.

```
CEO (Omer)
├── Tamir (Chief of Staff / Router)
├── CTO
│   ├── Backend Engineer (permanent)
│   └── [temps hired per-task as needed]
├── CMO
│   ├── Market Researcher (permanent)
│   ├── Content Writer (permanent)
│   └── [temps hired per-task as needed]
└── COO
    ├── Operations Analyst (permanent)
    └── [temps hired per-task as needed]
```

**Cross-department needs:** If the CTO needs marketing research, it hires its own temp researcher or asks Tamir to route a separate task to CMO. The parent task can reference the cross-department task via `referenceTaskIds`.

## Configuration

```json
{
  "hiring": {
    "tempAutoApprove": false,
    "autoApprove": false,
    "maxTempPerTask": 5,
    "maxPermanentPerDept": 10
  },
  "delegation": {
    "subtaskTimeoutMinutes": 60
  }
}
```

## Implementation Phases

### Phase 1: Employee Roster + Full Task Delegation (Mode 1)

Minimal changes:

1. Add `capabilities` and `toolWhitelist` to `Employee` model
2. Add `registerAgent(agentId, soul, config)` method to orchestrator for dynamic employee registration
3. Implement `list_my_employees` tool for department heads
4. Allow `executorAgentId` to be a permanent employee at approval time (dropdown in approval UI, head's recommendation pre-selected)
5. Head becomes supervisor, employee becomes executor -- existing review flow handles the rest
6. Add delegation guidance to department head souls

### Phase 2: Sub-Task Delegation (Mode 2)

Extend the existing worker pipeline with cold suspend/resume:

1. Add `parentRunId`, `subtaskId`, `subtaskDescription`, `onComplete` to `TaskRun` (other fields already exist)
2. Reuse existing `paused` status for delegation (worker already skips paused runs)
3. Implement `delegate_subtask` tool (`tool()` callback):
  - Creates subtask workspace + shared file symlinks
  - Creates employee task_run (queued, with `onComplete: resume_parent`)
  - Returns message telling head it will be re-invoked
  - Head's query() ends naturally, worker marks run as `paused`
4. Implement new `onRunComplete` handler in worker (called in `executeRun()` finally block):
  - Reads `onComplete` from completed run
  - If `resume_parent`: stores subtask results in `task.metadata`, creates new queued head run with `sessionId`
5. Add subtask resume prompt building in `executeRun()` (same pattern as `escalationResolved`)
6. Implement `submit_deliverable` tool for employees (writes `deliverable.json`)
7. Implement `request_input` tool for employees (writes question, exits → head resumes with question)
8. Add `subtaskId` to `CostEvent` for cost breakdown
9. Implement `delegation_log.jsonl` writing
10. Implement cancellation cascade (cancel task → cancel all runs including paused)
11. Wire up sub-task SSE streaming to separate context per employee

### Phase 3: Hiring Flow + Config

1. Enhance existing `hire_employee` tool (add soul.md draft, type param, cold suspend/resume path)
2. CEO hire approval UI (in escalations / Kanban)
3. Configurable auto-approve settings
4. Temp employee cleanup on task completion (set status to `terminated`)
5. Activity log entries for delegation events

### Phase 4: CEO Employee Designer (UI Feature)

1. Employee creation UI in org tree
2. Soul/prompt crafting from natural language description
3. Tool and skill assignment UI
4. Employee evaluation mode (test input -> inspect output -> iterate)
5. One-click deployment to department

### Phase 5: Warm Agent Bridge (Future)

See `FUTURE_WARM_AGENT_BRIDGE.md` for the full design. Generalized warm bridge that applies to delegation and any other agent wait point:

1. Implement `AgentBridge` singleton (generalized in-memory promise map)
2. Capacity-aware dual path: warm when RAM allows, cold suspend at capacity
3. Worker slot tracking (active vs blocked vs free)
4. Tool handler heartbeat interval during blocking
5. Apply to delegation first, then evaluate for hire approval and other wait points

### Phase 6: Concurrency (Future)

1. Allow head to delegate multiple sub-tasks before suspending
2. Worker processes multiple employee runs in parallel
3. `waitForAll` aggregation: head resumes only when all sibling sub-tasks complete
4. File conflict prevention across concurrent sub-tasks

