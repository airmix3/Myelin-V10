---
name: system-reset
status: active
scope: global
version: "1.0"
---

# System Reset

## Goal

Safely reset the system to a clean state while preserving permanent assets. This is a destructive administrative operation -- not a business task. It wipes operational data (tasks, deliverables, cost history, activity logs) while keeping the company's institutional knowledge intact (vault documents, company DNA, approved skills, permanent employees).

## When to Trigger

Only when the CEO explicitly requests a system reset through Tamir. This is an admin operation, not a task -- do not route to departments. Tamir handles this directly.

**Trigger phrases:** "reset the system", "clean slate", "start fresh", "wipe everything", "system reset"

**NOT a reset trigger:** "reset this task", "start this over", "redo the deliverable" -- these are task-level operations, not system resets.

## Procedure

Tamir handles this entire flow directly. Do not delegate to department heads.

### Step 1: Acknowledge the Request

When the CEO requests a reset, acknowledge it clearly. Do not execute immediately.

### Step 2: Ask What to Preserve

Present the CEO with preservation options beyond the defaults:

- **In-progress deliverables?** (tasks with status=working and their deliverable files)
- **Pending skill proposals?** (skills with status=pending)
- **Cost history?** (cost_events table for budget analysis)

The CEO may have other items they want to preserve -- accommodate reasonable requests.

### Step 3: Generate and Display Summary

Before any deletion, show the CEO exactly what will happen:

```
Will delete:
- X tasks (Y in-progress, Z completed)
- N task runs
- M deliverables
- P cost events
- Q activity log entries
- R hire requests

Will preserve:
- Vault documents (company DNA, research papers, etc.)
- Approved/active skills
- Permanent employees (Tamir, CTO, CMO, COO)
- [Any additional items CEO requested to preserve]
```

This summary is the single safety gate. Show real counts, not estimates.

### Step 4: Wait for Explicit Confirmation

The CEO must explicitly confirm the reset. Accept variations like:
- "confirm reset"
- "yes, proceed"
- "do it"
- "confirmed"

If the CEO says "reset" without having seen the summary, show the summary first. Do not skip the confirmation gate.

If the CEO hesitates, cancels, or says anything ambiguous, abort the reset. Better to ask again than to delete data.

### Step 5: Execute the Reset

Perform deletions in this order (order matters for foreign key constraints):

1. **Delete task_runs** -- all execution records
2. **Delete cost_events** -- all cost tracking data (unless CEO chose to preserve)
3. **Delete activity_log** -- all activity entries
4. **Delete hire_requests** -- all hire request records
5. **Delete deliverables** -- all deliverable records and files (unless CEO chose to preserve in-progress)
6. **Delete tasks** -- all task records
7. **Delete non-vault documents** -- documents where `source != 'vault'` (knowledge files, task deliverables indexed in FTS5)
8. **Reset employee budgets** -- set `budgetSpent = 0.0` for all permanent employees
9. **Terminate temp employees** -- set `status = 'terminated'` for all non-permanent employees

**Always preserve:**
- Vault documents (`source = 'vault'`) -- company DNA, research papers, reference material
- Approved/active skills -- institutional knowledge that was explicitly approved
- Permanent employees -- Tamir, CTO, CMO, COO (reset their budgets but keep them active)
- Company DNA file at `data/vault/company-dna.md`

### Step 6: Confirm Completion

Report back to the CEO with a clear summary:

```
Reset complete. System is clean.

Deleted: X tasks, Y deliverables, Z cost events, N activity entries, M hire requests
Preserved: vault documents, company DNA, approved skills, 4 permanent employees
[Any additional preserved items]

The system is ready for new tasks.
```

## Edge Cases

- **Reset fails partway through:** Report exactly what was deleted and what was not. Do not silently fail. The CEO needs to know the system state. Example: "Reset partially completed. Deleted: task_runs, cost_events. Failed at: activity_log deletion (reason). Remaining tables not touched."
- **CEO requests reset during active task execution:** Warn that active tasks will be interrupted. If the CEO confirms, proceed -- the worker loop will find its runs deleted and stop gracefully.
- **No data to delete:** If the system is already clean, say so. "System is already clean -- no tasks, deliverables, or activity to delete."
- **CEO wants to preserve specific tasks:** Not supported in v1. The reset is all-or-nothing for tasks (with the exception of in-progress deliverables). If the CEO needs selective deletion, suggest canceling specific tasks instead.
- **Database errors during reset:** If a DELETE statement fails, stop the reset at that point. Report the error and the current state. Do not attempt to continue -- partial resets are worse than no reset.
