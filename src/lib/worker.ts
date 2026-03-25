import { sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/events';
import { logger } from '@/lib/logger';

const POLL_INTERVAL_MS = 2000;         // D-09: 2 second fixed interval
const HEARTBEAT_INTERVAL_MS = 15000;   // FOUND-07: heartbeat every 15s
const STALE_THRESHOLD_S = 120;         // D-11: 2 minutes = 120 seconds
const MAX_CONCURRENT = 3;              // FOUND-07: max 3 concurrent SDK subprocesses

const log = logger.child({ module: 'worker' });

// Track active runs for heartbeat
const activeRuns = new Map<string, NodeJS.Timeout>();

/**
 * Called once on server startup (per D-12).
 * Any task_runs still in 'executing' state are immediately marked 'failed'.
 * This handles the case where the server crashed mid-execution.
 */
export function recoverStaleRuns(): void {
  const result = sqlite.prepare(`
    UPDATE task_runs
    SET status = 'failed', failedAt = datetime('now'), failureReason = 'stale_on_startup'
    WHERE status = 'executing'
  `).run();

  if (result.changes > 0) {
    log.warn({ count: result.changes }, 'Marked stale executing runs as failed on startup');

    // Also transition the parent tasks to failed
    const staleRuns = sqlite.prepare(`
      SELECT id, taskId FROM task_runs WHERE failureReason = 'stale_on_startup' AND failedAt > datetime('now', '-5 seconds')
    `).all() as Array<{ id: string; taskId: string }>;

    for (const run of staleRuns) {
      // Best-effort transition -- task may already be in a terminal state
      sqlite.prepare(`
        UPDATE tasks SET state = 'failed', updatedAt = datetime('now')
        WHERE id = ? AND state IN ('working', 'submitted')
      `).run(run.taskId);
    }
  }
}

/**
 * Marks runs that haven't heartbeated in STALE_THRESHOLD_S as failed.
 * Called periodically during the poll loop.
 */
function markHeartbeatStaleRuns(): void {
  const result = sqlite.prepare(`
    UPDATE task_runs
    SET status = 'failed', failedAt = datetime('now'), failureReason = 'heartbeat_timeout'
    WHERE status = 'executing'
    AND heartbeatAt < datetime('now', '-' || ? || ' seconds')
  `).run(STALE_THRESHOLD_S);

  if (result.changes > 0) {
    log.warn({ count: result.changes }, 'Marked heartbeat-stale runs as failed');
  }
}

/**
 * Count currently executing runs.
 */
function getActiveRunCount(): number {
  const row = sqlite.prepare(
    "SELECT COUNT(*) as count FROM task_runs WHERE status = 'executing'"
  ).get() as { count: number };
  return row.count;
}

/**
 * Attempt to claim one queued run via optimistic lock.
 * Returns the claimed run or null if queue is empty / concurrent claim.
 */
function claimNextRun(): Record<string, unknown> | null {
  // Optimistic lock: UPDATE WHERE status='queued' AND id=(subselect oldest queued)
  const claimed = sqlite.prepare(`
    UPDATE task_runs
    SET status = 'executing', claimedAt = datetime('now'), heartbeatAt = datetime('now')
    WHERE id = (
      SELECT id FROM task_runs
      WHERE status = 'queued'
      ORDER BY createdAt ASC
      LIMIT 1
    ) AND status = 'queued'
    RETURNING *
  `).get() as Record<string, unknown> | undefined;

  return claimed || null;
}

/**
 * Start heartbeat interval for an active run.
 */
function startHeartbeat(runId: string): void {
  const interval = setInterval(() => {
    try {
      sqlite.prepare(
        "UPDATE task_runs SET heartbeatAt = datetime('now') WHERE id = ? AND status = 'executing'"
      ).run(runId);
    } catch (err) {
      log.error({ err, runId }, 'Heartbeat failed');
    }
  }, HEARTBEAT_INTERVAL_MS);

  activeRuns.set(runId, interval);
}

/**
 * Stop heartbeat for a run.
 */
function stopHeartbeat(runId: string): void {
  const interval = activeRuns.get(runId);
  if (interval) {
    clearInterval(interval);
    activeRuns.delete(runId);
  }
}

/**
 * Execute a claimed run. In Phase 1, this is a placeholder -- actual SDK invocation
 * comes in Phase 2 (invokeAgent). For now, just mark as completed after a brief delay.
 */
async function executeRun(run: Record<string, unknown>): Promise<void> {
  const runId = run.id as string;
  const taskId = run.taskId as string;
  const employeeId = run.employeeId as string;

  log.info({ runId, taskId, employeeId }, 'Executing run (Phase 1 stub)');

  startHeartbeat(runId);

  // Emit worker claim event
  eventBus.emit('worker:claim', { runId, taskId, employeeId });

  // Log to activity_log
  sqlite.prepare(`
    INSERT INTO activity_log (id, taskId, agentId, actionType, description, createdAt)
    VALUES (?, ?, ?, 'WORKER_CLAIM', ?, datetime('now'))
  `).run(generateId('log'), taskId, employeeId, `Run ${runId} claimed by worker`);

  try {
    // Phase 1 stub: In Phase 2, this calls invokeAgent() which runs the SDK query().
    // For now, we just mark the run as completed to prove the loop works.
    // The actual implementation will be:
    //   await invokeAgent({ taskId, runId, employeeId, ... });

    // Mark run completed
    sqlite.prepare(`
      UPDATE task_runs
      SET status = 'completed', completedAt = datetime('now')
      WHERE id = ?
    `).run(runId);

    log.info({ runId, taskId }, 'Run completed (Phase 1 stub)');
  } catch (err) {
    log.error({ err, runId, taskId }, 'Run execution failed');

    sqlite.prepare(`
      UPDATE task_runs
      SET status = 'failed', failedAt = datetime('now'), failureReason = ?
      WHERE id = ?
    `).run(err instanceof Error ? err.message : 'unknown_error', runId);
  } finally {
    stopHeartbeat(runId);
  }
}

/**
 * Single poll iteration: check for stale runs, then claim and execute if under capacity.
 */
async function poll(): Promise<void> {
  try {
    // Check for heartbeat-stale runs
    markHeartbeatStaleRuns();

    // Check concurrency
    const activeCount = getActiveRunCount();
    if (activeCount >= MAX_CONCURRENT) {
      log.debug({ activeCount }, 'At concurrency cap, skipping claim');
      return;
    }

    // Try to claim a run
    const claimed = claimNextRun();
    if (!claimed) return;  // Queue empty or lost race

    // Execute asynchronously (don't block the poll loop)
    executeRun(claimed).catch((err) => {
      log.error({ err, runId: claimed.id }, 'Unhandled error in executeRun');
    });
  } catch (err) {
    log.error({ err }, 'Worker poll error');
  }
}

/**
 * Start the worker loop. Called once from instrumentation.ts.
 * Polls every 2 seconds with fixed interval (no backoff per D-10).
 * Fire-and-forget -- does not block server startup.
 */
export function startWorkerLoop(): void {
  log.info({
    pollInterval: POLL_INTERVAL_MS,
    maxConcurrent: MAX_CONCURRENT,
    heartbeatInterval: HEARTBEAT_INTERVAL_MS,
    staleThreshold: STALE_THRESHOLD_S,
  }, 'Starting worker loop');

  // Recover stale runs from previous crash (D-12)
  recoverStaleRuns();

  // Start polling -- D-09: fixed 2s interval, D-10: no backoff
  setInterval(() => {
    poll().catch((err) => log.error({ err }, 'Poll iteration failed'));
  }, POLL_INTERVAL_MS);
}
