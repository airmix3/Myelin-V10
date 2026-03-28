---
phase: quick
plan: 260328-cjp
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/worker.ts
autonomous: true
must_haves:
  truths:
    - "Completed task_runs cause parent task to transition from working to completed"
    - "Dashboard Active Tasks count excludes tasks whose runs have completed"
    - "Existing stuck tasks in working state with completed runs are fixed"
  artifacts:
    - path: "src/lib/worker.ts"
      provides: "transitionTask call after successful run completion"
      contains: "transitionTask(taskId, 'working', 'completed')"
  key_links:
    - from: "src/lib/worker.ts"
      to: "src/lib/state-machine.ts"
      via: "transitionTask call on run success"
      pattern: "transitionTask\\(taskId.*completed"
---

<objective>
Fix Active Tasks count showing completed tasks. The worker marks task_runs as completed but never transitions the parent task state from 'working' to 'completed', so completed tasks permanently inflate the dashboard count.

Purpose: Dashboard accuracy -- Active Tasks should only count genuinely active tasks.
Output: Fixed worker.ts with task state transition on run completion.
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/worker.ts
@src/lib/state-machine.ts
@src/app/page.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add transitionTask call after successful run completion and fix stuck tasks</name>
  <files>src/lib/worker.ts</files>
  <action>
In `executeRun()`, after the task_run is marked completed (line 233, after `.run(runId)`), and after the deliverable status update block (after line 248), add a call to transition the parent task to completed:

```typescript
// Transition parent task to completed
transitionTask(taskId, 'working', 'completed');
```

Place this AFTER the deliverable update (lines 236-248) and BEFORE the eventBus.emit on line 251. The transitionTask function is already imported at line 7. The state machine validates the transition and handles concurrent modification safely (returns success:false if task is no longer in 'working' state), so no additional guards are needed.

Additionally, fix existing stuck tasks by running a one-time SQL migration. Create a temporary script or use the dev server's SQLite connection to update tasks that are stuck in 'working' state but have all their task_runs completed:

After adding the transitionTask call, also add a one-time fix in the `recoverStaleRuns()` function (which runs once on server startup). Add a new block after the existing stale-run recovery (after line 48):

```typescript
// One-time fix: transition tasks stuck in 'working' whose runs are all completed
const stuckTasks = sqlite.prepare(`
  SELECT DISTINCT t.id FROM tasks t
  WHERE t.state = 'working'
  AND NOT EXISTS (
    SELECT 1 FROM task_runs tr
    WHERE tr.taskId = t.id AND tr.status IN ('queued', 'executing')
  )
  AND EXISTS (
    SELECT 1 FROM task_runs tr
    WHERE tr.taskId = t.id AND tr.status = 'completed'
  )
`).all() as Array<{ id: string }>;

for (const task of stuckTasks) {
  sqlite.prepare(`
    UPDATE tasks SET state = 'completed', updatedAt = datetime('now')
    WHERE id = ? AND state = 'working'
  `).run(task.id);
  log.info({ taskId: task.id }, 'Fixed stuck working task with completed runs');
}

if (stuckTasks.length > 0) {
  log.info({ count: stuckTasks.length }, 'Fixed stuck working tasks on startup');
}
```

This handles both the forward fix (new completions) and the backward fix (existing stuck tasks).
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && grep -n "transitionTask(taskId, 'working', 'completed')" src/lib/worker.ts | head -5</automated>
  </verify>
  <done>
    1. worker.ts executeRun() calls transitionTask(taskId, 'working', 'completed') after run completion
    2. worker.ts recoverStaleRuns() fixes existing stuck tasks on startup
    3. Dashboard Active Tasks count will correctly exclude completed tasks after next server restart
  </done>
</task>

</tasks>

<verification>
1. `grep "transitionTask(taskId, 'working', 'completed')" src/lib/worker.ts` shows the new call in executeRun
2. `grep "Fixed stuck working" src/lib/worker.ts` shows the startup recovery logic
3. After server restart, check dashboard -- Active Tasks count should drop by the number of previously stuck tasks
</verification>

<success_criteria>
- transitionTask call exists in executeRun success path
- Startup recovery handles existing stuck tasks
- TypeScript compiles without errors: `npx tsc --noEmit` passes (or next build succeeds)
</success_criteria>

<output>
After completion, create `.planning/quick/260328-cjp-fix-active-tasks-count-showing-completed/260328-cjp-SUMMARY.md`
</output>
