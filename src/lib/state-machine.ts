import { sqlite } from '@/lib/db';
import { eventBus } from '@/lib/events';
import { logger } from '@/lib/logger';
import { insertActivityLog } from '@/lib/activity-log';

export type TaskState = 'submitted' | 'working' | 'input-required' | 'completed' | 'failed' | 'canceled';

// Valid transitions: from -> [allowed to states]
// Per FOUND-04: 6 standard A2A states only, no custom states
export const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  'submitted':      ['working', 'canceled'],
  'working':        ['input-required', 'completed', 'failed', 'canceled'],
  'input-required': ['working', 'canceled', 'failed'],
  'completed':      [],  // terminal
  'failed':         [],  // terminal
  'canceled':       [],  // terminal
};

export function isValidTransition(from: TaskState, to: TaskState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface TransitionResult {
  success: boolean;
  taskId: string;
  from: TaskState;
  to: TaskState;
  error?: string;
}

/**
 * Atomically transition a task's state using WHERE-on-current-state SQL.
 * If the task's current state doesn't match `fromState`, the transition fails
 * (0 rows affected) -- this prevents race conditions.
 *
 * Also logs the transition to activity_log and emits SSE event.
 */
export function transitionTask(
  taskId: string,
  fromState: TaskState,
  toState: TaskState,
  metadata?: Record<string, unknown>
): TransitionResult {
  const log = logger.child({ module: 'state-machine', taskId });

  // Validate transition
  if (!isValidTransition(fromState, toState)) {
    log.warn({ from: fromState, to: toState }, 'Invalid state transition attempted');
    return {
      success: false,
      taskId,
      from: fromState,
      to: toState,
      error: `Invalid transition: ${fromState} -> ${toState}`,
    };
  }

  // Atomic update with WHERE on current state
  const result = sqlite.prepare(`
    UPDATE tasks
    SET state = ?, updatedAt = datetime('now')
    WHERE id = ? AND state = ?
  `).run(toState, taskId, fromState);

  if (result.changes === 0) {
    log.warn({ from: fromState, to: toState }, 'State transition failed -- state mismatch (concurrent modification)');
    return {
      success: false,
      taskId,
      from: fromState,
      to: toState,
      error: `State mismatch: task ${taskId} is no longer in state ${fromState}`,
    };
  }

  insertActivityLog({
    taskId,
    actionType: 'TASK_TRANSITION',
    description: `${fromState} -> ${toState}`,
    metadata,
  });

  // Emit SSE event
  eventBus.emit('task:transition', {
    taskId,
    from: fromState,
    to: toState,
    timestamp: new Date().toISOString(),
    ...(metadata || {}),
  });

  log.info({ from: fromState, to: toState }, 'Task state transitioned');

  return { success: true, taskId, from: fromState, to: toState };
}
