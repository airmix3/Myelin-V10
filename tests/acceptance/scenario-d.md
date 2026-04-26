# Acceptance Scenario D: Mode 2 Sub-Task Delegation with Cold Suspend/Resume

> Tests the hiring & delegation system per docs/17_HIRING_DELEGATION.md, Phase 2.

## Preconditions
- System is running (`pnpm dev`)
- System has been reset (POST /api/system/reset)
- At least one employee in the marketing department (or CMO will hire a temp)
- Worker loop is active

## Steps

### 1. Submit Task via Tamir
- Navigate to `/tamir`
- Type: "Create a competitive analysis report for Myelin's BDaS product"
- Verify: Tamir routes to CMO / marketing department
- Verify: Task created with `department = "marketing"`

### 2. Planning + Approve
- CMO plans the task, CEO approves with CMO as executor
- POST /api/tasks/{taskId}/approve (CMO is the executor, no override)
- Verify: task_run queued with CMO's employee DB id
- Verify: task.executorAgentId = "cmo"

### 3. CMO Calls delegate_subtask
- During execution, CMO calls `delegate_subtask` with:
  - employee_agent_id: employee's agentId
  - description: "Research top 5 BCI competitors"
  - shared_files: [] (or relevant files)
  - budget_cents: 500
- Verify: Subtask workspace created at desk/subtasks/st_xxx/
  - Contains: shared/, output/, CLAUDE.md, .claude/settings.json
- Verify: delegation_log.jsonl written in desk/subtasks/ with delegation entry
- Verify: Child task_run created with:
  - status: "queued"
  - subtask_id: "st_xxx"
  - subtask_description: "Research top 5 BCI competitors"
  - parent_run_id: CMO's run ID
  - on_complete: `{ action: "resume_parent", parentRunId: "...", subtaskId: "..." }`
- Verify: CMO's parent run marked as "paused" (cold suspend)

### 4. Employee Executes
- Worker claims employee's task_run (standard claim)
- Verify: Employee workspaceCwd = subtask directory (desk/subtasks/st_xxx/)
- Verify: Employee has CLAUDE.md with instructions in subtask dir
- Verify: shared/ directory exists in subtask workspace
- Verify: Build Log shows employee-specific activity

### 5. Employee Calls submit_deliverable
- Employee writes output files to output/ directory
- Employee calls `submit_deliverable` with summary and primaryFile
- Verify: deliverable.json written in subtask dir with:
  - status: "completed"
  - summary: non-empty
  - primaryFile: path to output file
  - subtaskId: matches the subtask ID

### 6. onRunComplete Fires
- Worker completes employee run and calls onRunComplete
- Verify: onComplete JSON parsed, action = "resume_parent"
- Verify: task.metadata updated with:
  - subtaskCompleted: true
  - subtaskSummary: matches deliverable summary
  - subtaskResultPath: path to subtask directory
  - subtaskStatus: "completed"
  - subtaskCostUsd: numeric value
- Verify: New head (CMO) task_run queued with:
  - sessionId: CMO's saved session ID
  - status: "queued"
- Verify: Paused parent run marked as "completed" (superseded)

### 7. Head Resumes
- Worker claims new CMO task_run, invokes with session_id (warm resume)
- Verify: Resume prompt includes:
  - Sub-task status
  - Results path
  - Summary
  - Cost
- Verify: subtask metadata cleared from task after building prompt (no replay on next resume)

### 8. Head Assembles Final Deliverable
- CMO uses employee output to produce the final competitive analysis
- Verify: Task completes normally through standard pipeline
- Verify: Final deliverable references or incorporates employee output

## Pass Criteria
- Cold suspend/resume cycle completed (head paused -> employee ran -> head resumed)
- Employee output visible to head via subtask results in resume prompt
- delegation_log.jsonl has at least one entry with correct fields
- No orphan task_runs (all runs in terminal state: completed, failed, or canceled)
- Subtask workspace isolation maintained (employee worked in subtasks/st_xxx/ only)
