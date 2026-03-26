import path from 'path';
import { sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/events';
import { logger } from '@/lib/logger';
import { orchestrator } from '@/lib/orchestrator';
import { transitionTask } from '@/lib/state-machine';
import {
  WORKER_POLL_INTERVAL_MS,
  WORKER_HEARTBEAT_INTERVAL_MS,
  WORKER_STALE_THRESHOLD_S,
  WORKER_MAX_CONCURRENT,
} from '@/lib/config';

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
  `).run(WORKER_STALE_THRESHOLD_S);

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
  }, WORKER_HEARTBEAT_INTERVAL_MS);

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
 * Execute a claimed run. Invokes agent via orchestrator with real SDK query().
 * Handles workspace resolution, task state transitions, cost tracking, and error recovery.
 */
async function executeRun(run: Record<string, unknown>): Promise<void> {
  const runId = run.id as string;
  const taskId = run.taskId as string;
  const employeeId = run.employeeId as string;

  const runLog = logger.child({ module: 'worker', runId, taskId, employeeId });
  runLog.info('Executing run');

  startHeartbeat(runId);

  // Emit worker claim event
  eventBus.emit('worker:claim', { runId, taskId, employeeId });

  // Log to activity_log
  sqlite.prepare(`
    INSERT INTO activity_log (id, taskId, agentId, actionType, description, createdAt)
    VALUES (?, ?, ?, 'WORKER_CLAIM', ?, datetime('now'))
  `).run(generateId('log'), taskId, employeeId, `Run ${runId} claimed by worker`);

  try {
    // Look up the task for context
    const task = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Record<string, unknown> | undefined;
    if (!task) throw new Error(`Task ${taskId} not found`);

    // Look up the employee to get agentId
    const employee = sqlite.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) as Record<string, unknown> | undefined;
    if (!employee) throw new Error(`Employee ${employeeId} not found`);

    const agentId = employee.agentId as string;

    // Get workspace paths from the task run or task
    const workspaceCwd = run.workspaceCwd as string | null;
    let deskDir: string;
    let delivDir: string;
    let manifestPath: string;

    if (workspaceCwd) {
      // Resuming -- use stored workspace path
      deskDir = workspaceCwd;
      const baseDir = path.dirname(deskDir);
      delivDir = path.join(baseDir, 'deliverables');
      manifestPath = path.join(delivDir, 'deliverable_manifest.json');
    } else {
      // First run -- workspace should already be created by the approval flow
      // Fall back to constructing from convention
      const baseDir = path.resolve(process.cwd(), 'data', 'workspaces', taskId);
      deskDir = path.join(baseDir, 'desk');
      delivDir = path.join(baseDir, 'deliverables');
      manifestPath = path.join(delivDir, 'deliverable_manifest.json');
    }

    // Build the prompt from task description + plan
    const prompt = [
      task.title as string,
      task.description ? `\n\n${task.description}` : '',
      task.planMarkdown ? `\n\n## Approved Plan\n\n${task.planMarkdown}` : '',
    ].join('');

    // Transition task to working if it's in submitted state
    const currentState = task.state as string;
    if (currentState === 'submitted') {
      transitionTask(taskId, 'submitted', 'working');
    }

    // Parse subagent definitions from task_run (set by hire approval)
    const agentsJson = run.agents as string | null;
    const agents = agentsJson ? JSON.parse(agentsJson) : undefined;

    // Invoke the agent via orchestrator
    const result = await orchestrator.invoke({
      taskId,
      runId,
      agentId,
      prompt,
      deskDir,
      delivDir,
      manifestPath,
      sessionId: (run.sessionId as string) || undefined,
      maxBudgetUsd: (employee.budgetLimit as number) ?? 10,
      agents,
    });

    runLog.info({ sessionId: result.sessionId, costUsd: result.totalCostUsd }, 'Agent invocation completed');

    // Update employee budget spent
    sqlite.prepare(
      'UPDATE employees SET budgetSpent = budgetSpent + ?, updatedAt = datetime(\'now\') WHERE id = ?'
    ).run(result.totalCostUsd, employeeId);

    // Mark run completed
    sqlite.prepare(`
      UPDATE task_runs
      SET status = 'completed', completedAt = datetime('now')
      WHERE id = ?
    `).run(runId);

    // Emit completion event
    eventBus.emit('agent:completed', { taskId, runId, agentId, costUsd: result.totalCostUsd });

    runLog.info({ runId, taskId, costUsd: result.totalCostUsd }, 'Run completed');
  } catch (err) {
    runLog.error({ err, runId, taskId }, 'Run execution failed');

    // Mark run failed
    sqlite.prepare(`
      UPDATE task_runs
      SET status = 'failed', failedAt = datetime('now'), failureReason = ?
      WHERE id = ?
    `).run(err instanceof Error ? err.message : 'unknown_error', runId);

    // Transition task to failed if it was in working state
    const task = sqlite.prepare('SELECT state FROM tasks WHERE id = ?').get(taskId) as { state: string } | undefined;
    if (task && task.state === 'working') {
      transitionTask(taskId, 'working', 'failed');
    }
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
    if (activeCount >= WORKER_MAX_CONCURRENT) {
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
    pollInterval: WORKER_POLL_INTERVAL_MS,
    maxConcurrent: WORKER_MAX_CONCURRENT,
    heartbeatInterval: WORKER_HEARTBEAT_INTERVAL_MS,
    staleThreshold: WORKER_STALE_THRESHOLD_S,
  }, 'Starting worker loop');

  // Recover stale runs from previous crash (D-12)
  recoverStaleRuns();

  // Start polling -- D-09: fixed 2s interval, D-10: no backoff
  setInterval(() => {
    poll().catch((err) => log.error({ err }, 'Poll iteration failed'));
  }, WORKER_POLL_INTERVAL_MS);
}
