---
phase: quick
plan: 260328-its
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/mcp/tools/review.ts
  - src/lib/worker.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Build log shows bounded region when submit_for_review hands off to supervisor"
    - "Build log shows bounded region when request_changes hands back to executor"
    - "Build log shows bounded region when approve_deliverable triggers skill extraction"
    - "Bounded regions close properly when the worker finishes the enqueued run"
  artifacts:
    - path: "src/lib/mcp/tools/review.ts"
      provides: "AGENT_SWITCH_START emissions on review handoffs"
      contains: "AGENT_SWITCH_START"
    - path: "src/lib/worker.ts"
      provides: "AGENT_SWITCH_END emission when run completes for a different agent"
      contains: "AGENT_SWITCH_END"
  key_links:
    - from: "src/lib/mcp/tools/review.ts"
      to: "src/lib/activity-log.ts"
      via: "insertActivityLog with AGENT_SWITCH_START"
      pattern: "insertActivityLog.*AGENT_SWITCH_START"
    - from: "src/lib/worker.ts"
      to: "src/lib/activity-log.ts"
      via: "insertActivityLog with AGENT_SWITCH_END"
      pattern: "insertActivityLog.*AGENT_SWITCH_END"
---

<objective>
Emit AGENT_SWITCH_START/END activity log entries for review tool handoffs (submit_for_review, request_changes, approve_deliverable) so the AgentLogPanel renders bounding boxes around supervisor and executor re-runs, matching the existing pattern from install tools.

Purpose: Currently only install_tool/install_skill show agent switch bounding boxes in the build log. Review handoffs (which are the primary agent-to-agent transitions) are invisible -- the user sees activity entries but no visual grouping by agent.

Output: Updated review.ts with AGENT_SWITCH_START emissions; updated worker.ts with AGENT_SWITCH_END emission on run completion when agentId differs from task executor.
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/mcp/tools/review.ts
@src/lib/mcp/tools/install.ts (reference: existing AGENT_SWITCH pattern)
@src/lib/worker.ts
@src/lib/activity-log.ts
@src/components/AgentLogPanel.tsx (reference: how bounding boxes render)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add AGENT_SWITCH_START to review tools</name>
  <files>src/lib/mcp/tools/review.ts</files>
  <action>
Import `insertActivityLog` from `@/lib/activity-log` at the top of the file.

Add AGENT_SWITCH_START log emissions in three places:

1. **submit_for_review** — After the `currentActorId` UPDATE and before the task_run INSERT (around line 78), add:
```typescript
insertActivityLog({
  taskId: ctx.taskId,
  agentId: ctx.agentId,
  actionType: 'AGENT_SWITCH_START',
  description: `Submitting for review by ${task.supervisorAgentId}`,
  metadata: { fromAgent: ctx.agentId, toAgent: task.supervisorAgentId, reason: 'submit_for_review' },
});
```

2. **approve_deliverable** — After the task transition to completed and before the skill extraction task_run INSERT (around line 126), add:
```typescript
insertActivityLog({
  taskId: ctx.taskId,
  agentId: ctx.agentId,
  actionType: 'AGENT_SWITCH_START',
  description: `Skill extraction by ${taskForExtraction.supervisorAgentId}`,
  metadata: { fromAgent: ctx.agentId, toAgent: taskForExtraction.supervisorAgentId, reason: 'skill_extraction' },
});
```
Place this INSIDE the `if (taskForExtraction?.supervisorAgentId)` block, before the employee lookup.

3. **request_changes** — After the `reviewFeedback` UPDATE and before the executor task_run INSERT (around line 179), add:
```typescript
insertActivityLog({
  taskId: ctx.taskId,
  agentId: ctx.agentId,
  actionType: 'AGENT_SWITCH_START',
  description: `Requesting changes from ${task.executorAgentId}`,
  metadata: { fromAgent: ctx.agentId, toAgent: task.executorAgentId, reason: 'request_changes' },
});
```

Follow the exact metadata shape from install.ts: `{ fromAgent, toAgent, reason }` — the AgentLogPanel reads `toAgent` for the bounded region label.
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>All three review tools emit AGENT_SWITCH_START with fromAgent/toAgent/reason metadata before enqueuing the handoff task_run.</done>
</task>

<task type="auto">
  <name>Task 2: Add AGENT_SWITCH_END to worker on run completion</name>
  <files>src/lib/worker.ts</files>
  <action>
In the `executeRun` function, after the run completes successfully (after `runLog.info('Run completed')` around line 282) and also in the catch block for failed runs, emit AGENT_SWITCH_END when the current run's agent differs from the task's executor.

**Success path** (after line 282, before the closing `} catch`):

```typescript
// Emit AGENT_SWITCH_END if this run was by a non-executor agent (review handoff)
const executorAgentId = task.executorAgentId as string | null;
if (executorAgentId && agentId !== executorAgentId) {
  insertActivityLog({
    taskId,
    agentId,
    actionType: 'AGENT_SWITCH_END',
    description: `Returned from ${agentId}`,
    metadata: { fromAgent: agentId, toAgent: executorAgentId },
  });
}
```

**Failure path** — In the catch block (around line 283-333), add the same check after marking the run as failed (after the `failureReason` UPDATE, before the budget check):

```typescript
// Emit AGENT_SWITCH_END on failure too, so bounded region closes
const failedEmployee = sqlite.prepare('SELECT agentId FROM employees WHERE id = ?').get(employeeId) as { agentId: string } | undefined;
const failedTask = sqlite.prepare('SELECT executorAgentId FROM tasks WHERE id = ?').get(taskId) as { executorAgentId: string | null } | undefined;
if (failedEmployee && failedTask?.executorAgentId && failedEmployee.agentId !== failedTask.executorAgentId) {
  insertActivityLog({
    taskId,
    agentId: failedEmployee.agentId,
    actionType: 'AGENT_SWITCH_END',
    description: `Returned from ${failedEmployee.agentId} (failed)`,
    metadata: { fromAgent: failedEmployee.agentId, toAgent: failedTask.executorAgentId },
  });
}
```

Note: In the success path, `agentId` is already resolved (line 187). In the failure path, we need to look it up from `employeeId` since `agentId` may not be in scope if the error happened before line 187. Actually — looking at the code, the `agentId` variable IS in scope in the catch block since try/catch shares function scope in the `try` block assignments. But if the error occurs before `agentId` is assigned (e.g., employee not found), it won't be defined. Safer to re-query.

Actually, re-reading: `agentId` is declared with `const` inside the try block at line 187. It's NOT accessible in the catch block. So the catch block approach with the separate query is correct.
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Worker emits AGENT_SWITCH_END when a run completes (success or failure) and the running agent is not the task's executor, properly closing the bounded region in the build log UI.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors: `npx tsc --noEmit`
2. Grep confirms AGENT_SWITCH_START in review.ts: `grep -c AGENT_SWITCH_START src/lib/mcp/tools/review.ts` returns 3
3. Grep confirms AGENT_SWITCH_END in worker.ts: `grep -c AGENT_SWITCH_END src/lib/worker.ts` returns 2
</verification>

<success_criteria>
- review.ts emits AGENT_SWITCH_START with correct fromAgent/toAgent metadata for all three handoff points
- worker.ts emits AGENT_SWITCH_END when a completed/failed run was by a non-executor agent
- AgentLogPanel will render bounded regions around supervisor review runs and executor re-runs without any UI changes needed
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/260328-its-show-agent-switch-bounding-boxes-in-buil/260328-its-SUMMARY.md`
</output>
