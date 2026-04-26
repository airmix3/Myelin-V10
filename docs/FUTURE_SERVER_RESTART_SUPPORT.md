# Future: Server Restart Recovery

Things that need recovery support if the server crashes/restarts mid-operation. Not implemented now -- documented for when we get to reliability hardening.

## Warm Tamir Sessions Lost

- AsyncQueue + query object lost on crash
- Recovery: standbys are re-created on startup (already handled by `tamirStandby.init()`)
- Active conversations lose their warm session and fall back to cold path on next message

## Delegation Orphans (Cold Suspend/Resume)

With cold suspend/resume, most state survives in the DB. Edge cases:

1. **Suspended head + completed employee:** The `resume_parent` handler may have created a new queued head run that was never claimed before crash. Recovery: on startup, queued runs are picked up by the worker normally.

2. **Suspended head + executing employee:** Employee's SDK process dies on crash. Mark employee run as failed. The `resume_parent` handler fires, creates a new head run with failure context. Head resumes and decides how to handle.

3. **Executing head (mid-tool-call, about to delegate):** Head's SDK process dies. The `delegate_subtask` tool never completed. No employee run was created. Mark head run as failed. Normal retry/escalation.

## Warm Agent Bridge Recovery

If/when the warm agent bridge is implemented (see `FUTURE_WARM_AGENT_BRIDGE.md`), warm-blocked agents lose their query objects on crash. The bridge's in-memory promise map is gone. Recovery:

- Detect stale executing runs (heartbeat older than server start time)
- If the run had a pending bridge wait, the event may have already occurred (employee completed) or may still be in progress
- Fall back to the cold path: mark the warm run as failed, check if the event result exists on disk (e.g., `deliverable.json`), and create a new cold-resume run with the results

## Recovery Strategy (When Implemented)

On server startup, after all services initialize:

1. **Queued task_runs:** Survive restart (in DB). Worker picks them up on next poll. No action needed.
2. **Executing task_runs:** SDK process died. Mark as failed with "server restart" error. Let supervisor review or auto-retry.
3. **Suspended task_runs:** Check if child employee run completed. If yes, create queued head run with results. If no (employee was also executing), mark employee as failed, then create head run with failure context.
4. **Hire requests pending CEO approval:** Survive restart (in DB). No action needed.
5. **Planning sessions:** Chat history is on filesystem (JSONL). Session can resume via session_id if SDK supports it, otherwise cold restart.

The `delegation_log.jsonl` in each task workspace provides an audit trail for reconstruction.
