# Quick Task 260329-fy1: Reuse Conversation Thread on Follow-ups

## Problem
When CEO sent a follow-up message on a completed task, the system created a brand new SDK conversation every time. The agent lost all context from the planning and execution phases — had to reconstruct everything from the injected chat history text.

## Root Cause
Neither `tasks/[taskId]/message/route.ts` nor `deliverables/[id]/chat/route.ts` passed `sessionId` to `orchestrator.invoke()`. Every invocation started fresh.

## Fix

### Planning follow-ups (`tasks/[taskId]/message/route.ts`)
- Read `planningSessionId` from task.metadata before invoking
- Pass it as `sessionId` to `orchestrator.invoke()`
- After invocation, store `result.sessionId` back to task.metadata for next turn
- First planning turn has no sessionId (new conversation), subsequent turns resume

### Deliverable follow-ups (`deliverables/[id]/chat/route.ts`)
- Already queried latest task_run for `workspaceCwd` — now also grabs `sessionId`
- Pass `sessionId` to `orchestrator.invoke()`
- After invocation, update the latest task_run's sessionId for next follow-up

## Result
Follow-up messages now continue the same SDK conversation. Agent retains full context from planning and execution without needing to reconstruct from chat history text.

## Commit
- `b576387`: fix(quick-260329-fy1): reuse conversation thread on follow-up messages
