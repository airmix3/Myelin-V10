import path from 'path';
import { appendFileSync, existsSync, readFileSync } from 'fs';
import { sqlite } from '@/lib/db';
import { eventBus } from '@/lib/events';
import { logger } from '@/lib/logger';
import { orchestrator } from '@/lib/orchestrator';
import { transitionTask } from '@/lib/state-machine';
import { insertActivityLog } from '@/lib/activity-log';
import {
  WORKER_POLL_INTERVAL_MS,
  WORKER_HEARTBEAT_INTERVAL_MS,
  WORKER_STALE_THRESHOLD_S,
  WORKER_MAX_CONCURRENT,
} from '@/lib/config';
import { abortQuery } from '@/lib/query-abort';

const log = logger.child({ module: 'worker' });

// Track active runs for heartbeat
const activeRuns = new Map<string, NodeJS.Timeout>();

// Track paused runs (CEO terminal takeover)
const pausedRuns = new Set<string>();

/**
 * Pause a running SDK agent to allow CEO terminal takeover.
 * Aborts the SDK query loop and marks the run as paused.
 */
export async function pauseRun(runId: string): Promise<void> {
  log.info({ runId }, 'Pausing run for CEO takeover');
  pausedRuns.add(runId);

  // Abort the SDK query loop gracefully
  abortQuery(runId);

  // Mark run as paused in DB
  sqlite.prepare(
    "UPDATE task_runs SET status = 'paused' WHERE id = ? AND status IN ('executing', 'queued')"
  ).run(runId);

  // Emit event
  eventBus.emit('worker:pause', { runId });
}

/**
 * Resume a paused run after CEO exits the terminal.
 * Re-queues the run so the worker picks it up with the stored sessionId.
 */
export async function resumeRun(runId: string): Promise<void> {
  log.info({ runId }, 'Resuming run after CEO exit');
  pausedRuns.delete(runId);

  // Re-queue so the worker picks it up again (sessionId persists for resume)
  sqlite.prepare(
    "UPDATE task_runs SET status = 'queued' WHERE id = ? AND status = 'paused'"
  ).run(runId);

  // Emit event
  eventBus.emit('worker:resume', { runId });
}

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
  // Skip runs that are in the pausedRuns set (CEO terminal takeover in progress)
  const pausedIds = Array.from(pausedRuns);
  let query: string;
  if (pausedIds.length > 0) {
    const placeholders = pausedIds.map(() => '?').join(',');
    query = `
      UPDATE task_runs
      SET status = 'executing', claimedAt = datetime('now'), heartbeatAt = datetime('now')
      WHERE id = (
        SELECT id FROM task_runs
        WHERE status = 'queued' AND id NOT IN (${placeholders})
        ORDER BY createdAt ASC
        LIMIT 1
      ) AND status = 'queued'
      RETURNING *
    `;
  } else {
    query = `
      UPDATE task_runs
      SET status = 'executing', claimedAt = datetime('now'), heartbeatAt = datetime('now')
      WHERE id = (
        SELECT id FROM task_runs
        WHERE status = 'queued'
        ORDER BY createdAt ASC
        LIMIT 1
      ) AND status = 'queued'
      RETURNING *
    `;
  }
  const claimed = (pausedIds.length > 0
    ? sqlite.prepare(query).get(...pausedIds)
    : sqlite.prepare(query).get()
  ) as Record<string, unknown> | undefined;

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

  insertActivityLog({
    taskId,
    agentId: employeeId,
    actionType: 'WORKER_CLAIM',
    description: `Run ${runId} claimed by worker`,
    metadata: { runId, employeeId },
  });

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
    // Skip if task is already in a terminal state (e.g., extraction run on completed task -- Pitfall 2)
    const currentState = task.state as string;
    if (currentState === 'submitted') {
      transitionTask(taskId, 'submitted', 'working');
    } else if (currentState !== 'working' && currentState !== 'completed') {
      // Task is in unexpected state -- skip execution
      runLog.warn({ currentState, taskId }, 'Task not in executable state, skipping run');
      sqlite.prepare("UPDATE task_runs SET status = 'failed', failedAt = datetime('now'), failureReason = 'task_not_executable' WHERE id = ?").run(runId);
      return;
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

    // Update deliverable status + primaryFile from manifest when run completes
    try {
      const manifestJson = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf-8')) : null;
      const primaryFile = manifestJson?.primaryFile ?? null;
      sqlite.prepare(`
        UPDATE deliverables SET status = 'completed', primaryFile = COALESCE(?, primaryFile), updatedAt = datetime('now')
        WHERE taskId = ? AND status = 'in-progress'
      `).run(primaryFile, taskId);
    } catch {
      sqlite.prepare(`
        UPDATE deliverables SET status = 'completed', updatedAt = datetime('now')
        WHERE taskId = ? AND status = 'in-progress'
      `).run(taskId);
    }

    // Transition parent task to completed
    transitionTask(taskId, 'working', 'completed');

    // Emit completion event
    eventBus.emit('agent:completed', { taskId, runId, agentId, costUsd: result.totalCostUsd });

    runLog.info({ runId, taskId, costUsd: result.totalCostUsd }, 'Run completed');

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
  } catch (err) {
    runLog.error({ err, runId, taskId }, 'Run execution failed');

    // Mark run failed
    sqlite.prepare(`
      UPDATE task_runs
      SET status = 'failed', failedAt = datetime('now'), failureReason = ?
      WHERE id = ?
    `).run(err instanceof Error ? err.message : 'unknown_error', runId);

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

    // Check for budget exceeded -- transition to input-required instead of failed (INT-02, D-07)
    const errMsg = err instanceof Error ? err.message : '';
    if (errMsg.toLowerCase().includes('budget')) {
      const taskForBudget = sqlite.prepare('SELECT state, metadata, chatFilePath FROM tasks WHERE id = ?').get(taskId) as { state: string; metadata: string | null; chatFilePath: string | null } | undefined;
      if (taskForBudget && taskForBudget.state === 'working') {
        const existingMeta = taskForBudget.metadata ? JSON.parse(taskForBudget.metadata) : {};
        sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?').run(
          JSON.stringify({ ...existingMeta, inputType: 'budget_increase' }),
          taskId
        );
        transitionTask(taskId, 'working', 'input-required', { inputType: 'budget_increase' });

        // D-07 dual signal #1: Write system message to task JSONL chat file
        if (taskForBudget.chatFilePath) {
          appendFileSync(
            taskForBudget.chatFilePath,
            JSON.stringify({
              role: 'system',
              content: 'Budget limit reached. Approve an increase to resume.',
              ts: new Date().toISOString(),
            }) + '\n',
            'utf-8'
          );
        }

        // D-07 dual signal #2: Emit buildlog event for UI amber card
        eventBus.emit('task:buildlog', {
          taskId,
          event: { type: 'budget_exceeded', agentId: employeeId, message: `Budget limit exceeded for task ${taskId}` },
        });

        runLog.info({ taskId }, 'Budget exceeded -- task moved to input-required');
        return;  // Skip generic failure transition below
      }
    }

    // For completed tasks (skill extraction runs per Pitfall 2), skip state transition
    const taskForFailure = sqlite.prepare('SELECT state FROM tasks WHERE id = ?').get(taskId) as { state: string } | undefined;
    if (taskForFailure && taskForFailure.state === 'working') {
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
