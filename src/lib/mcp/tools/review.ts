/**
 * MCP tools: submit_for_review, approve_deliverable, request_changes — Per TOOL-07, TOOL-08, TOOL-09.
 * Review flow tools that manage currentActorId transitions between executor and supervisor.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import * as lockfile from 'proper-lockfile';
import { sqlite } from '@/lib/db';
import { transitionTask } from '@/lib/state-machine';
import { eventBus } from '@/lib/events';
import { generateId } from '@/lib/id';
import { insertActivityLog } from '@/lib/activity-log';
import type { ToolContext } from '../tool-context';

interface TaskRow {
  supervisorAgentId: string | null;
  executorAgentId: string | null;
  state: string;
  reviewRound: number;
}

const INBOX_PATH = resolve(process.cwd(), 'data', 'agents', 'tamir', 'inbox.jsonl');

/**
 * Append a notification to Tamir's inbox with proper-lockfile protection.
 */
async function appendToInbox(entry: Record<string, unknown>): Promise<void> {
  const dir = dirname(INBOX_PATH);
  mkdirSync(dir, { recursive: true });

  // Create file if it doesn't exist (lockfile needs an existing file or realpath: false)
  if (!existsSync(INBOX_PATH)) {
    appendFileSync(INBOX_PATH, '');
  }

  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(INBOX_PATH, { retries: 3, realpath: false });
    appendFileSync(INBOX_PATH, JSON.stringify(entry) + '\n', 'utf-8');
  } finally {
    if (release) await release();
  }
}

export function createReviewTools(ctx: ToolContext) {
  // Helper: find employee record by agentId
  function findEmployeeByAgentId(agentId: string): { id: string } | undefined {
    return sqlite.prepare('SELECT id FROM employees WHERE agentId = ?').get(agentId) as { id: string } | undefined;
  }

  // Helper: find latest task_run for session/workspace resume
  function findLatestRun(taskId: string): { sessionId: string | null; workspaceCwd: string | null } | undefined {
    return sqlite.prepare('SELECT sessionId, workspaceCwd FROM task_runs WHERE taskId = ? ORDER BY createdAt DESC LIMIT 1').get(taskId) as { sessionId: string | null; workspaceCwd: string | null } | undefined;
  }

  const submitForReview = tool(
    'submit_for_review',
    'Submit your work for supervisor review.',
    {},
    async () => {
      const task = sqlite.prepare(
        'SELECT supervisorAgentId, state FROM tasks WHERE id = ?'
      ).get(ctx.taskId) as TaskRow | undefined;

      if (!task) {
        return { content: [{ type: 'text' as const, text: `Error: Task ${ctx.taskId} not found.` }] };
      }
      if (task.state !== 'working') {
        return { content: [{ type: 'text' as const, text: `Error: Task must be in 'working' state to submit for review (current: ${task.state}).` }] };
      }
      if (!task.supervisorAgentId) {
        return { content: [{ type: 'text' as const, text: 'Error: No supervisor assigned to this task.' }] };
      }

      sqlite.prepare(
        "UPDATE tasks SET currentActorId = ?, updatedAt = datetime('now') WHERE id = ?"
      ).run(task.supervisorAgentId, ctx.taskId);

      eventBus.emit('task:review', {
        taskId: ctx.taskId,
        action: 'submitted',
        reviewerAgentId: task.supervisorAgentId,
      });

      // Emit agent switch for build log bounding box
      insertActivityLog({
        taskId: ctx.taskId,
        agentId: ctx.agentId,
        actionType: 'AGENT_SWITCH_START',
        description: `Submitting for review by ${task.supervisorAgentId}`,
        metadata: { fromAgent: ctx.agentId, toAgent: task.supervisorAgentId, reason: 'submit_for_review' },
      });

      // Enqueue supervisor task_run so worker picks up the review
      const supervisorEmployee = findEmployeeByAgentId(task.supervisorAgentId);
      if (supervisorEmployee) {
        const prevRun = findLatestRun(ctx.taskId);
        sqlite.prepare(`
          INSERT INTO task_runs (id, taskId, employeeId, status, sessionId, workspaceCwd, createdAt)
          VALUES (?, ?, ?, 'queued', NULL, ?, datetime('now'))
        `).run(generateId('run'), ctx.taskId, supervisorEmployee.id, prevRun?.workspaceCwd ?? null);
      }

      return { content: [{ type: 'text' as const, text: `Work submitted for review by ${task.supervisorAgentId}.` }] };
    },
  );

  const approveDeliverable = tool(
    'approve_deliverable',
    'Approve the deliverable and mark the task as completed.',
    {},
    async () => {
      const task = sqlite.prepare(
        'SELECT state FROM tasks WHERE id = ?'
      ).get(ctx.taskId) as { state: string } | undefined;

      if (!task) {
        return { content: [{ type: 'text' as const, text: `Error: Task ${ctx.taskId} not found.` }] };
      }
      if (task.state !== 'working') {
        return { content: [{ type: 'text' as const, text: `Error: Task must be in 'working' state to approve (current: ${task.state}).` }] };
      }

      // Set completedAt before transition
      sqlite.prepare(
        "UPDATE tasks SET completedAt = datetime('now') WHERE id = ?"
      ).run(ctx.taskId);

      const result = transitionTask(ctx.taskId, 'working', 'completed');
      if (!result.success) {
        return { content: [{ type: 'text' as const, text: `Error: Failed to transition task: ${result.error}` }] };
      }

      // Enqueue skill extraction task_run for supervisor (DELIV-08)
      const taskForExtraction = sqlite.prepare(
        'SELECT supervisorAgentId FROM tasks WHERE id = ?'
      ).get(ctx.taskId) as { supervisorAgentId: string | null } | undefined;

      if (taskForExtraction?.supervisorAgentId) {
        // Emit agent switch for build log bounding box
        insertActivityLog({
          taskId: ctx.taskId,
          agentId: ctx.agentId,
          actionType: 'AGENT_SWITCH_START',
          description: `Skill extraction by ${taskForExtraction.supervisorAgentId}`,
          metadata: { fromAgent: ctx.agentId, toAgent: taskForExtraction.supervisorAgentId, reason: 'skill_extraction' },
        });

        const supervisorEmployee = findEmployeeByAgentId(taskForExtraction.supervisorAgentId);
        if (supervisorEmployee) {
          const prevRun = findLatestRun(ctx.taskId);
          sqlite.prepare(`
            INSERT INTO task_runs (id, taskId, employeeId, status, sessionId, workspaceCwd, createdAt)
            VALUES (?, ?, ?, 'queued', NULL, ?, datetime('now'))
          `).run(generateId('run'), ctx.taskId, supervisorEmployee.id, prevRun?.workspaceCwd ?? null);
        }
      }

      // Notify Tamir inbox
      await appendToInbox({
        type: 'task_completed',
        taskId: ctx.taskId,
        department: ctx.department,
        agentId: ctx.agentId,
        timestamp: new Date().toISOString(),
      });

      return { content: [{ type: 'text' as const, text: 'Deliverable approved. Task marked as completed.' }] };
    },
  );

  const requestChanges = tool(
    'request_changes',
    'Request changes to the deliverable with specific feedback.',
    { feedback: z.string().describe('Specific feedback on what needs to change') },
    async (args) => {
      const task = sqlite.prepare(
        'SELECT executorAgentId, reviewRound FROM tasks WHERE id = ?'
      ).get(ctx.taskId) as TaskRow | undefined;

      if (!task) {
        return { content: [{ type: 'text' as const, text: `Error: Task ${ctx.taskId} not found.` }] };
      }
      if (!task.executorAgentId) {
        return { content: [{ type: 'text' as const, text: 'Error: No executor assigned to this task.' }] };
      }

      sqlite.prepare(
        "UPDATE tasks SET reviewFeedback = ?, reviewRound = reviewRound + 1, currentActorId = ?, updatedAt = datetime('now') WHERE id = ?"
      ).run(args.feedback, task.executorAgentId, ctx.taskId);

      eventBus.emit('task:review', {
        taskId: ctx.taskId,
        action: 'changes_requested',
        feedback: args.feedback,
      });

      // Emit agent switch for build log bounding box
      insertActivityLog({
        taskId: ctx.taskId,
        agentId: ctx.agentId,
        actionType: 'AGENT_SWITCH_START',
        description: `Requesting changes from ${task.executorAgentId}`,
        metadata: { fromAgent: ctx.agentId, toAgent: task.executorAgentId, reason: 'request_changes' },
      });

      // Enqueue executor task_run with session resume (D-02)
      const executorEmployee = findEmployeeByAgentId(task.executorAgentId!);
      if (executorEmployee) {
        const prevExecutorRun = sqlite.prepare(
          'SELECT sessionId, workspaceCwd FROM task_runs WHERE taskId = ? AND employeeId = ? ORDER BY createdAt DESC LIMIT 1'
        ).get(ctx.taskId, executorEmployee.id) as { sessionId: string | null; workspaceCwd: string | null } | undefined;
        sqlite.prepare(`
          INSERT INTO task_runs (id, taskId, employeeId, status, sessionId, workspaceCwd, createdAt)
          VALUES (?, ?, ?, 'queued', ?, ?, datetime('now'))
        `).run(generateId('run'), ctx.taskId, executorEmployee.id, prevExecutorRun?.sessionId ?? null, prevExecutorRun?.workspaceCwd ?? null);
      }

      return {
        content: [{
          type: 'text' as const,
          text: `Changes requested (round ${task.reviewRound + 1}). Feedback sent to executor.`,
        }],
      };
    },
  );

  return [submitForReview, approveDeliverable, requestChanges];
}
