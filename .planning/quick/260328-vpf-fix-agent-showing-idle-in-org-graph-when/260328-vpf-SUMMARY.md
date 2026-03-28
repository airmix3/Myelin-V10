# Quick Task 260328-vpf: Fix agent idle in org graph when improving deliverable

## Problem

When a CEO triggers "improve" on a completed deliverable, a new task_run is created (status = 'executing') on the same task. But the org graph API only queried for tasks with `state IN ('submitted', 'working', 'input-required')` — since the task is already `completed`, the running agent didn't appear in the graph.

## Fix

Changed the org-graph API query to include tasks based on **task_run status** (executing/queued) in addition to task state. Now any employee with an active run shows up, regardless of whether the parent task is completed.

Also added deduplication by taskId (a task may have multiple runs from retries/improvements — only the most recent is shown).

## Files changed

- `src/app/api/org-graph/route.ts` — Updated WHERE clause + added dedup logic
