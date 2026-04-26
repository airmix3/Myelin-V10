import path from 'path';
import { appendFileSync, existsSync, readFileSync } from 'fs';
import { sqlite } from '@/lib/db';
import { eventBus } from '@/lib/events';
import { logger } from '@/lib/logger';
import { orchestrator } from '@/lib/orchestrator';
import { transitionTask } from '@/lib/state-machine';
import { insertActivityLog } from '@/lib/activity-log';
import { generateId } from '@/lib/id';
import { dataPath } from '@/lib/paths';
import {
  WORKER_POLL_INTERVAL_MS,
  WORKER_HEARTBEAT_INTERVAL_MS,
  WORKER_STALE_THRESHOLD_S,
  WORKER_MAX_CONCURRENT,
} from '@/lib/config';
import { abortQuery } from '@/lib/query-abort';
import { triggerMemoryReview, readMemoryState } from '@/lib/memory-review';
import { refreshCompanyMemory } from '@/lib/company-refresh';
import { commitToAsset, mergeAssetBranch, discardAssetBranch } from '@/lib/asset-repo';
import { classifyColumn } from '@/lib/classify-column';

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
 * Cancel all active/queued/paused runs for a task.
 * Per doc 17: cascade cancellation to prevent orphan runs.
 */
export function cancelTaskRuns(taskId: string): number {
  const result = sqlite.prepare(`
    UPDATE task_runs SET status = 'canceled'
    WHERE taskId = ? AND status IN ('queued', 'executing', 'paused')
  `).run(taskId);
  if (result.changes > 0) {
    log.info({ taskId, count: result.changes }, 'Canceled task runs (cascade)');
  }
  return result.changes;
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
 * onRunComplete handler -- per doc 17 Phase 2.
 * Called after a run completes (success or failure).
 * If the run has onComplete: resume_parent, creates a new queued run for the head.
 */
export async function onRunComplete(run: Record<string, unknown>): Promise<void> {
  const onCompleteStr = run.on_complete as string | null;
  if (!onCompleteStr) return;

  let onComplete: Record<string, unknown>;
  try {
    onComplete = JSON.parse(onCompleteStr);
  } catch {
    return;
  }

  const runId = run.id as string;
  const taskId = run.taskId as string;
  const runStatus = run.status as string;

  if (onComplete.action === 'resume_parent') {
    const parentRunId = onComplete.parentRunId as string;
    const subtaskId = onComplete.subtaskId as string;

    // Guard: only resume if parent is paused
    const parentRun = sqlite.prepare('SELECT * FROM task_runs WHERE id = ?').get(parentRunId) as Record<string, unknown> | undefined;
    if (!parentRun || parentRun.status !== 'paused') {
      log.warn({ parentRunId, parentStatus: parentRun?.status }, 'Parent run not paused, skipping resume');
      return;
    }

    // Read sub-task deliverable
    const subtaskDir = path.join(parentRun.workspaceCwd as string, 'subtasks', subtaskId);
    let deliverable: Record<string, unknown> | null = null;
    const deliverablePath = path.join(subtaskDir, 'deliverable.json');
    if (existsSync(deliverablePath)) {
      try {
        deliverable = JSON.parse(readFileSync(deliverablePath, 'utf-8'));
      } catch { /* ignore parse errors */ }
    }

    // Calculate cost from cost_events for this run
    const costRow = sqlite.prepare(
      'SELECT COALESCE(SUM(costUsd), 0) as totalCost FROM cost_events WHERE taskId = ? AND run_id = ?'
    ).get(taskId, runId) as { totalCost: number };

    // Store subtask results in task.metadata (same pattern as escalationResolved)
    const task = sqlite.prepare('SELECT metadata FROM tasks WHERE id = ?').get(taskId) as { metadata: string | null } | undefined;
    const taskMetadata = task?.metadata ? JSON.parse(task.metadata) : {};
    taskMetadata.subtaskCompleted = true;
    taskMetadata.subtaskId = subtaskId;
    taskMetadata.subtaskResultPath = subtaskDir;
    taskMetadata.subtaskSummary = deliverable?.summary ?? (runStatus === 'failed' ? 'Sub-task failed' : 'No deliverable');
    taskMetadata.subtaskStatus = deliverable?.status ?? runStatus;
    taskMetadata.subtaskCostUsd = costRow.totalCost;
    // Check for needs_input
    if (deliverable?.status === 'needs_input') {
      taskMetadata.subtaskQuestion = deliverable.question;
    }
    sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
      .run(JSON.stringify(taskMetadata), taskId);

    // Create new queued run for the head (resume with saved session)
    sqlite.prepare(`
      INSERT INTO task_runs (id, taskId, employeeId, status, sessionId, workspaceCwd, createdAt)
      VALUES (?, ?, ?, 'queued', ?, ?, datetime('now'))
    `).run(
      generateId('run'),
      taskId,
      parentRun.employeeId as string,
      parentRun.sessionId as string,
      parentRun.workspaceCwd as string,
    );

    // Mark the paused parent run as completed (superseded)
    sqlite.prepare("UPDATE task_runs SET status = 'completed', completedAt = datetime('now') WHERE id = ?")
      .run(parentRunId);

    // Activity log
    insertActivityLog({
      taskId,
      agentId: 'system',
      actionType: 'DELEGATION_COMPLETED',
      description: `Sub-task ${subtaskId} completed (status: ${runStatus})`,
      metadata: { subtaskId, parentRunId, runStatus, costUsd: costRow.totalCost },
    });

    log.info({ parentRunId, subtaskId, runStatus }, 'Parent run queued for resume after subtask');
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
      // For subtask runs, delivDir/manifestPath are in the parent workspace
      // Check if this is a subtask run (has subtask_id)
      const subtaskId = run.subtask_id as string | null;
      if (subtaskId) {
        // Subtask workspace: deskDir is subtasks/st_xxx/, deliverables are in parent
        const parentWorkspace = path.resolve(deskDir, '..', '..');
        delivDir = path.join(parentWorkspace, '..', 'deliverables');
        manifestPath = path.join(delivDir, 'deliverable_manifest.json');
      } else {
        const baseDir = path.dirname(deskDir);
        delivDir = path.join(baseDir, 'deliverables');
        manifestPath = path.join(delivDir, 'deliverable_manifest.json');
      }
    } else {
      // First run -- workspace should already be created by the approval flow
      // Fall back to constructing from convention
      const baseDir = dataPath('workspaces', taskId);
      deskDir = path.join(baseDir, 'desk');
      delivDir = path.join(baseDir, 'deliverables');
      manifestPath = path.join(delivDir, 'deliverable_manifest.json');
    }

    // Build the prompt -- check for various resume scenarios
    const taskMetadata = task.metadata ? JSON.parse(task.metadata as string) : {};
    let prompt: string;

    if (run.sessionId && taskMetadata.subtaskCompleted) {
      // Resuming after subtask delegation completed (per doc 17)
      const subtaskStatus = taskMetadata.subtaskStatus;
      const subtaskQuestion = taskMetadata.subtaskQuestion;

      if (subtaskQuestion) {
        // Employee needs input
        prompt = [
          '## Employee Needs Your Input',
          '',
          `**Sub-task:** ${taskMetadata.subtaskId}`,
          `**Question:** ${subtaskQuestion}`,
          '',
          'Decide the answer and re-delegate with clarified instructions.',
        ].join('\n');
      } else {
        prompt = [
          '## Sub-task Completed',
          '',
          `**Sub-task:** ${taskMetadata.subtaskId}`,
          `**Status:** ${subtaskStatus}`,
          `**Results at:** ${taskMetadata.subtaskResultPath}`,
          `**Summary:** ${taskMetadata.subtaskSummary}`,
          `**Cost:** $${taskMetadata.subtaskCostUsd}`,
          '',
          'Review the output and continue your execution.',
        ].join('\n');
      }

      // Clear subtask metadata so subsequent resumes don't replay
      const cleaned = { ...taskMetadata };
      delete cleaned.subtaskCompleted;
      delete cleaned.subtaskId;
      delete cleaned.subtaskResultPath;
      delete cleaned.subtaskSummary;
      delete cleaned.subtaskStatus;
      delete cleaned.subtaskCostUsd;
      delete cleaned.subtaskQuestion;
      sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
        .run(JSON.stringify(cleaned), taskId);
    } else if (run.sessionId && taskMetadata.escalationResolved) {
      // Resuming after CEO responded to escalation -- inject the response as continuation prompt
      const escalationResponse = taskMetadata.escalationResponse ?? '';
      const escalationResolution = taskMetadata.escalationResolution ?? 'answered';
      prompt = [
        `## CEO Response to Your Escalation`,
        ``,
        `**Resolution:** ${escalationResolution}`,
        `**Response:** ${escalationResponse}`,
        ``,
        `The CEO has responded to your escalation. Continue with your task using this information.`,
        `If you still cannot proceed, escalate again with a specific explanation of what's still missing.`,
      ].join('\n');

      // Clear escalation metadata so subsequent resumes don't replay it
      const cleanedMetadata = { ...taskMetadata };
      delete cleanedMetadata.escalationResolved;
      delete cleanedMetadata.escalationResponse;
      delete cleanedMetadata.escalationResolution;
      delete cleanedMetadata.escalationId;
      sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
        .run(JSON.stringify(cleanedMetadata), taskId);
    } else {
      // Normal first run or non-escalation resume
      prompt = [
        task.title as string,
        task.description ? `\n\n${task.description}` : '',
        task.planMarkdown ? `\n\n## Approved Plan\n\n${task.planMarkdown}` : '',
      ].join('');
    }

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

    // Check if agent delegated a subtask -- detected by child TaskRun with parentRunId = runId
    const childRun = sqlite.prepare(
      "SELECT id FROM task_runs WHERE parent_run_id = ? AND status = 'queued'"
    ).get(runId) as { id: string } | undefined;

    if (childRun) {
      // Head delegated -- mark this run as paused (not completed)
      sqlite.prepare("UPDATE task_runs SET status = 'paused' WHERE id = ?").run(runId);
      runLog.info({ runId, childRunId: childRun.id }, 'Run paused for delegation');
      // Skip the normal completion path (don't transition task to completed)
      return;
    }

    // Mark run completed
    sqlite.prepare(`
      UPDATE task_runs
      SET status = 'completed', completedAt = datetime('now')
      WHERE id = ?
    `).run(runId);

    // Check if agent re-escalated during this run (task moved to input-required)
    const postRunTask = sqlite.prepare('SELECT state FROM tasks WHERE id = ?').get(taskId) as { state: string } | undefined;
    if (postRunTask?.state === 'input-required') {
      // Agent called escalate_to_ceo again -- task stays in input-required, don't complete
      runLog.info({ runId, taskId }, 'Agent re-escalated during run, task remains input-required');
      eventBus.emit('agent:escalated', { taskId, runId, agentId, costUsd: result.totalCostUsd });
    } else {
      // Normal completion path
      // Update deliverable primaryFile from manifest when run completes
      try {
        const manifestJson = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf-8')) : null;
        const primaryFile = manifestJson?.primaryFile ?? null;
        // Mark deliverable completed (or keep 'reviewed' if approve_deliverable already set it)
        sqlite.prepare(`
          UPDATE deliverables SET status = 'completed', primaryFile = COALESCE(?, primaryFile), updatedAt = datetime('now')
          WHERE taskId = ? AND status IN ('in-progress', 'reviewed')
        `).run(primaryFile, taskId);
      } catch {
        sqlite.prepare(`
          UPDATE deliverables SET status = 'completed', updatedAt = datetime('now')
          WHERE taskId = ? AND status IN ('in-progress', 'reviewed')
        `).run(taskId);
      }

      // Merge asset branch if this task targeted an asset
      if (taskMetadata.targetAssetId) {
        try {
          const assetRow = sqlite.prepare('SELECT directoryPath FROM assets WHERE id = ?').get(taskMetadata.targetAssetId) as { directoryPath: string } | undefined;
          if (assetRow?.directoryPath) {
            commitToAsset(assetRow.directoryPath, `Task ${taskId}: ${task.title}`);
            mergeAssetBranch(assetRow.directoryPath, taskId);
            runLog.info({ taskId, assetId: taskMetadata.targetAssetId }, 'Asset branch merged on task completion');
          }
        } catch (assetErr) {
          runLog.warn({ err: assetErr, taskId, assetId: taskMetadata.targetAssetId }, 'Asset branch merge failed (non-blocking)');
        }
      }

      // Transition parent task to completed (if not already -- approve_deliverable no longer does this)
      // Only for top-level runs (no parentRunId) -- subtask runs don't transition the task
      const isTopLevelRun = !(run.parent_run_id as string | null);
      if (isTopLevelRun) {
        const latestState = sqlite.prepare('SELECT state FROM tasks WHERE id = ?').get(taskId) as { state: string } | undefined;
        if (latestState?.state === 'working') {
          transitionTask(taskId, 'working', 'completed');
        }

        // Terminate temp employees hired for this task
        const tempEmployees = sqlite.prepare(`
          SELECT DISTINCT e.id, e.agentId FROM employees e
          JOIN hire_requests hr ON hr.employeeName = e.name AND hr.taskId = ?
          WHERE e.role = 'temp' AND e.status = 'active'
        `).all(taskId) as Array<{ id: string; agentId: string }>;

        for (const temp of tempEmployees) {
          sqlite.prepare("UPDATE employees SET status = 'terminated', updatedAt = datetime('now') WHERE id = ?").run(temp.id);
          orchestrator.unregisterAgent(temp.agentId);
          insertActivityLog({
            taskId,
            agentId: 'system',
            actionType: 'TEMP_TERMINATED',
            description: `Temp employee ${temp.agentId} terminated on task completion`,
            metadata: { employeeId: temp.id, agentId: temp.agentId },
          });
          runLog.info({ employeeId: temp.id, agentId: temp.agentId, taskId }, 'Temp employee terminated on task completion');
        }
      }

      // Notify Tamir inbox of completion (top-level only)
      if (isTopLevelRun) {
        try {
          const { mkdirSync: mkFs } = require('fs');
          const { dirname: dn } = require('path');
          const inboxPath = dataPath('agents', 'tamir', 'inbox.jsonl');
          mkFs(dn(inboxPath), { recursive: true });
          appendFileSync(inboxPath, JSON.stringify({
            type: 'task_completed',
            taskId,
            department: task.department,
            agentId,
            timestamp: new Date().toISOString(),
          }) + '\n', 'utf-8');
        } catch (inboxErr) {
          runLog.warn({ err: inboxErr }, 'Tamir inbox notification failed (non-blocking)');
        }
      }

      // Emit completion event
      eventBus.emit('agent:completed', { taskId, runId, agentId, costUsd: result.totalCostUsd });

      // D-20a: Trigger memory review on task completion -- but only if counter > 0
      // (If Tamir already saved during conversation or a recent interval review ran, skip)
      if (isTopLevelRun) {
        const chatPath = task.chatFilePath as string | null;
        if (chatPath) {
          const memState = readMemoryState(chatPath);
          if (memState.turnsSinceLastSave > 0) {
            triggerMemoryReview({ taskId, chatFilePath: chatPath });
          } else {
            log.debug({ taskId }, 'Memory review skipped: counter at 0 (already reviewed or Tamir saved proactively)');
          }
        }

        // Refresh company memory after any task completion (not just Tamir)
        refreshCompanyMemory().catch(err => {
          log.warn({ err, taskId }, 'Company memory refresh failed (non-blocking)');
        });
      }
    }

    runLog.info({ runId, taskId, costUsd: result.totalCostUsd }, 'Run completed');

    // Note: AGENT_SWITCH_END for reviews is now handled inline by submit_for_review MCP tool.
    // No separate review task_run is created -- the review happens synchronously within the executor's session.
  } catch (err) {
    runLog.error({ err, runId, taskId }, 'Run execution failed');

    // Mark run failed
    sqlite.prepare(`
      UPDATE task_runs
      SET status = 'failed', failedAt = datetime('now'), failureReason = ?
      WHERE id = ?
    `).run(err instanceof Error ? err.message : 'unknown_error', runId);

    // Note: AGENT_SWITCH_END for reviews is handled inline by submit_for_review MCP tool.
    // No cleanup needed here -- the tool handles both success and failure cases.

    // Check for budget exceeded -- transition to input-required instead of failed (INT-02, D-07)
    const errMsg = err instanceof Error ? err.message : '';
    if (errMsg.toLowerCase().includes('budget')) {
      const taskForBudget = sqlite.prepare('SELECT state, title, metadata, chatFilePath FROM tasks WHERE id = ?').get(taskId) as { state: string; title: string; metadata: string | null; chatFilePath: string | null } | undefined;
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

        // Classify kanban column (fire-and-forget -- don't block error handler)
        classifyColumn(taskId, { type: 'budget_increase', summary: `Budget limit exceeded for task: ${taskForBudget.title}` }).catch(() => {
          // logged internally, non-blocking
        });

        runLog.info({ taskId }, 'Budget exceeded -- task moved to input-required');
        return;  // Skip generic failure transition below
      }
    }

    // Discard asset branch if task targeted an asset (don't leave orphan branches)
    try {
      const failedTask = sqlite.prepare('SELECT metadata FROM tasks WHERE id = ?').get(taskId) as { metadata: string | null } | undefined;
      const failedMeta = failedTask?.metadata ? JSON.parse(failedTask.metadata) : {};
      if (failedMeta.targetAssetId) {
        const assetRow = sqlite.prepare('SELECT directoryPath FROM assets WHERE id = ?').get(failedMeta.targetAssetId) as { directoryPath: string } | undefined;
        if (assetRow?.directoryPath) {
          discardAssetBranch(assetRow.directoryPath, taskId);
          runLog.info({ taskId, assetId: failedMeta.targetAssetId }, 'Asset branch discarded on task failure');
        }
      }
    } catch (discardErr) {
      runLog.warn({ err: discardErr, taskId }, 'Asset branch discard failed (non-blocking)');
    }

    // For completed tasks (skill extraction runs per Pitfall 2), skip state transition
    const taskForFailure = sqlite.prepare('SELECT state FROM tasks WHERE id = ?').get(taskId) as { state: string } | undefined;
    if (taskForFailure && taskForFailure.state === 'working') {
      transitionTask(taskId, 'working', 'failed');
    }
  } finally {
    stopHeartbeat(runId);

    // onRunComplete: handle delegation resume (fires for both success and failure)
    const finalRun = sqlite.prepare('SELECT * FROM task_runs WHERE id = ?').get(runId) as Record<string, unknown>;
    if (finalRun) {
      try {
        await onRunComplete(finalRun);
      } catch (err) {
        log.error({ err, runId }, 'onRunComplete handler failed');
      }
    }
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
