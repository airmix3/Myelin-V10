# Quick Task 260329-fse: Fix Escalation Response Delivery

## Problem

When CEO responded to an escalation (e.g., providing AWS credentials), the agent:
1. Did NOT receive the CEO's response — it got the original task prompt again on resume
2. Marked the task as "completed" even though it was still blocked
3. Used `read_inbox` to try to find the response (wrong tool — that's for notifications, not escalation responses)

## Root Cause

In `worker.ts`, when a new task_run is created after an escalation response:
- The prompt was always built from `task.title + description + planMarkdown` (the original task)
- The CEO's escalation response was saved in task.metadata but never injected into the resume prompt
- After `invokeAgent()` returned, the worker always transitioned to `completed` regardless of task state

## Fix (worker.ts)

### Fix 1: Inject CEO response as resume prompt
When `run.sessionId` exists AND `taskMetadata.escalationResolved` is true, the worker now builds a specific continuation prompt:
```
## CEO Response to Your Escalation
Resolution: approved/answered
Response: [CEO's actual response text]
Continue with your task using this information.
```
After injecting, clears the escalation metadata so subsequent resumes don't replay it.

### Fix 2: Check for re-escalation after run
After `invokeAgent()` returns, the worker now checks if the task is in `input-required` state (agent called `escalate_to_ceo` again). If so:
- Does NOT mark task as completed
- Does NOT update deliverables to completed
- Task stays in `input-required` — stays live for CEO
- Emits `agent:escalated` event instead of `agent:completed`

## About `read_inbox`
The agent used `mcp__cortex__read_inbox` trying to find the CEO response. This tool reads the agent's notification inbox (`data/agents/{id}/inbox.jsonl`) — it's for async Tamir notifications, NOT for escalation responses. The escalation response should come through the resume prompt, which this fix now delivers correctly.

## Commit
- `22e0c6d`: fix(quick-260329-fse): deliver CEO escalation response to agent on resume
