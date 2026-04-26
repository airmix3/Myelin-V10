/**
 * Routine Scheduler -- manages cron jobs for recurring CEO-defined routines.
 *
 * On startup, loads all active routines from DB and schedules them with node-cron.
 * Each routine tick creates a real A2A task using the same pattern as the approve flow.
 */

import cron, { type ScheduledTask } from 'node-cron';
import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { createTaskWorkspace } from '@/lib/workspace';
import { eventBus } from '@/lib/events';
import { logger } from '@/lib/logger';
import type { Department } from '@/lib/workspace';

const log = logger.child({ module: 'routine-scheduler' });

/** Map of routineId -> active cron ScheduledTask */
const scheduledJobs = new Map<string, ScheduledTask>();

/**
 * Start the routine scheduler -- loads all active routines from DB and schedules them.
 * Called once from instrumentation.ts on server startup.
 */
export async function startRoutineScheduler(): Promise<void> {
  // prisma.routine may be undefined if Prisma client was generated before the Routine model
  const routineModel = (prisma as unknown as Record<string, unknown>).routine as
    | { findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>> }
    | undefined;

  if (!routineModel) {
    log.warn('Routine model not available in Prisma client — run npx prisma generate');
    return;
  }

  const routines = await routineModel.findMany({
    where: { status: 'active' },
  }) as Array<{ id: string; name: string; cronExpr: string }>;

  log.info({ count: routines.length }, 'Loading active routines');

  for (const routine of routines) {
    try {
      scheduleRoutine(routine);
    } catch (err) {
      log.error({ err, routineId: routine.id }, 'Failed to schedule routine');
    }
  }
}

/**
 * Schedule a routine's cron job. If already scheduled, unschedules first.
 */
export function scheduleRoutine(routine: { id: string; name: string; cronExpr: string }): void {
  // Unschedule if already running
  if (scheduledJobs.has(routine.id)) {
    unscheduleRoutine(routine.id);
  }

  if (!cron.validate(routine.cronExpr)) {
    log.warn({ routineId: routine.id, cronExpr: routine.cronExpr }, 'Invalid cron expression, skipping');
    return;
  }

  const task = cron.schedule(routine.cronExpr, () => {
    executeRoutineRun(routine.id).catch((err) => {
      log.error({ err, routineId: routine.id }, 'Routine execution failed');
    });
  });

  scheduledJobs.set(routine.id, task);
  log.info({ routineId: routine.id, name: routine.name, cronExpr: routine.cronExpr }, 'Routine scheduled');
}

/**
 * Unschedule (stop and remove) a routine's cron job.
 */
export function unscheduleRoutine(routineId: string): void {
  const job = scheduledJobs.get(routineId);
  if (job) {
    job.stop();
    scheduledJobs.delete(routineId);
    log.info({ routineId }, 'Routine unscheduled');
  }
}

/**
 * Execute a single routine run -- creates a real A2A task with workspace and task_run.
 * Mirrors the approve flow pattern from src/app/api/tasks/[taskId]/approve/route.ts.
 */
export async function executeRoutineRun(routineId: string): Promise<string | null> {
  const routine = await prisma.routine.findUnique({ where: { id: routineId } });
  if (!routine || routine.status === 'paused') {
    log.info({ routineId }, 'Routine not found or paused, skipping execution');
    return null;
  }

  const taskId = generateId('task');
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const title = `${routine.name} - ${dateStr}`;

  log.info({ routineId, taskId, title }, 'Executing routine run');

  // 1. Create task record
  await prisma.task.create({
    data: {
      id: taskId,
      title,
      description: routine.description,
      department: routine.department,
      state: 'submitted',
      executorAgentId: routine.agentId,
      planMarkdown: routine.taskPlan,
    },
  });

  // 2. Create workspace (mirrors approve flow)
  const workspace = createTaskWorkspace(
    taskId,
    routine.department as Department,
    routine.taskPlan,
    '',
  );

  // 3. Create deliverable record
  const delivId = generateId('deliv');
  await prisma.deliverable.create({
    data: {
      id: delivId,
      taskId,
      title,
      type: null,
      department: routine.department,
      creatorId: routine.agentId,
      workspacePath: workspace.baseDir,
      manifestPath: workspace.manifestPath,
    },
  });

  // 4. Look up employee by agentId
  const employeeRow = sqlite.prepare('SELECT id FROM employees WHERE agentId = ?').get(routine.agentId) as { id: string } | undefined;
  if (!employeeRow) {
    log.error({ routineId, agentId: routine.agentId }, 'No employee found for agentId');
    return null;
  }

  // 5. Create task_run (worker will pick it up)
  const runId = generateId('run');
  await prisma.taskRun.create({
    data: {
      id: runId,
      taskId,
      employeeId: employeeRow.id,
      status: 'queued',
      workspaceCwd: workspace.deskDir,
    },
  });

  // 6. Update routine with last run info
  await prisma.routine.update({
    where: { id: routineId },
    data: {
      lastRunAt: new Date(),
      lastTaskId: taskId,
    },
  });

  // 7. Emit SSE event
  eventBus.emit('routine:executed', {
    routineId,
    taskId,
    title,
    timestamp: new Date().toISOString(),
  });

  log.info({ routineId, taskId, delivId, runId }, 'Routine run created successfully');
  return taskId;
}

/**
 * Compute the next run time for a cron expression.
 * Returns ISO string of next execution, or null if invalid.
 */
export function getNextRun(cronExpr: string): string | null {
  if (!cron.validate(cronExpr)) return null;

  try {
    // node-cron doesn't have a built-in "next run" calculator,
    // so we parse the cron expression manually for display purposes.
    // For a simple approach, we use a basic interpretation.
    return describeCron(cronExpr);
  } catch {
    return null;
  }
}

/**
 * Describe a cron expression in human-readable form.
 */
function describeCron(cronExpr: string): string {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) return cronExpr;

  const [min, hour, dom, mon, dow] = parts;

  // Common patterns
  if (min === '*' && hour === '*') return 'Every minute';
  if (hour === '*') return `Every hour at :${min.padStart(2, '0')}`;
  if (dom === '*' && mon === '*' && dow === '*') return `Daily at ${hour}:${min.padStart(2, '0')}`;
  if (dom === '*' && mon === '*' && dow !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[parseInt(dow)] || dow;
    return `${dayName} at ${hour}:${min.padStart(2, '0')}`;
  }
  if (dom !== '*' && mon === '*' && dow === '*') return `Day ${dom} of each month at ${hour}:${min.padStart(2, '0')}`;

  return cronExpr;
}
