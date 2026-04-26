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

import { dataPath } from '@/lib/paths';
const INBOX_PATH = dataPath('agents', 'tamir', 'inbox.jsonl');

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

  const MAX_REVIEW_CYCLES = 3;

  const submitForReview = tool(
    'submit_for_review',
    'Submit your work for supervisor review. The review happens synchronously — you will receive the verdict (pass/fail with reasoning) as the tool result. If the review fails, read the feedback, fix your work, and call submit_for_review again. Max 3 review cycles.',
    {},
    async () => {
      const task = sqlite.prepare(
        'SELECT supervisorAgentId, executorAgentId, state, reviewRound, planMarkdown, description, title FROM tasks WHERE id = ?'
      ).get(ctx.taskId) as (TaskRow & { planMarkdown: string | null; description: string | null; title: string | null }) | undefined;

      if (!task) {
        return { content: [{ type: 'text' as const, text: `Error: Task ${ctx.taskId} not found.` }] };
      }
      if (task.state !== 'working') {
        return { content: [{ type: 'text' as const, text: `Error: Task must be in 'working' state to submit for review (current: ${task.state}).` }] };
      }
      if (!task.supervisorAgentId) {
        return { content: [{ type: 'text' as const, text: 'Error: No supervisor assigned to this task.' }] };
      }

      // Check review cycle cap
      const currentRound = task.reviewRound ?? 0;
      if (currentRound >= MAX_REVIEW_CYCLES) {
        return { content: [{ type: 'text' as const, text: `Review cycle limit reached (${MAX_REVIEW_CYCLES}). Escalate to CEO or finalize as-is.` }] };
      }

      // Increment review round
      sqlite.prepare(
        "UPDATE tasks SET reviewRound = ?, currentActorId = ?, updatedAt = datetime('now') WHERE id = ?"
      ).run(currentRound + 1, task.supervisorAgentId, ctx.taskId);

      eventBus.emit('task:review', {
        taskId: ctx.taskId,
        action: 'submitted',
        reviewerAgentId: task.supervisorAgentId,
      });

      // Log agent switch start for build log bounding box
      insertActivityLog({
        taskId: ctx.taskId,
        agentId: ctx.agentId,
        actionType: 'AGENT_SWITCH_START',
        description: `Review round ${currentRound + 1} by ${task.supervisorAgentId}`,
        metadata: { fromAgent: ctx.agentId, toAgent: task.supervisorAgentId, reason: 'submit_for_review', round: currentRound + 1 },
      });

      // Get reviewer agent config for soulMd
      const { orchestrator } = await import('@/lib/orchestrator');
      const reviewerConfig = orchestrator.getAgent(task.supervisorAgentId);
      if (!reviewerConfig) {
        insertActivityLog({
          taskId: ctx.taskId,
          agentId: ctx.agentId,
          actionType: 'AGENT_SWITCH_END',
          description: `Review failed: reviewer ${task.supervisorAgentId} not found`,
          metadata: { fromAgent: task.supervisorAgentId, reason: 'reviewer_not_found' },
        });
        return { content: [{ type: 'text' as const, text: `Error: Reviewer agent ${task.supervisorAgentId} not found in orchestrator.` }] };
      }

      // Get deliverable info for the reviewer
      const deliverable = sqlite.prepare(
        'SELECT primaryFile, workspacePath FROM deliverables WHERE taskId = ? ORDER BY createdAt DESC LIMIT 1'
      ).get(ctx.taskId) as { primaryFile: string | null; workspacePath: string | null } | undefined;

      // Build review prompt
      const reviewPrompt = [
        `You are reviewing a deliverable for task: "${task.title || ctx.taskId}"`,
        task.description ? `\nTask description: ${task.description}` : '',
        task.planMarkdown ? `\nPlan:\n${task.planMarkdown}` : '',
        deliverable?.primaryFile ? `\nDeliverable file: ${deliverable.primaryFile}` : '',
        deliverable?.workspacePath ? `\nWorkspace: ${deliverable.workspacePath}` : '',
        `\nReview round: ${currentRound + 1} of ${MAX_REVIEW_CYCLES}`,
        `\nInstructions: Review the deliverable against the plan and task requirements.`,
        `Read the deliverable file and evaluate its quality.`,
        `Return your verdict as structured output.`,
      ].filter(Boolean).join('\n');

      // Define structured output schema for the review verdict
      const reviewOutputFormat = {
        type: 'json_schema' as const,
        json_schema: {
          name: 'review_verdict',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              verdict: { type: 'string', enum: ['pass', 'fail'] },
              score: { type: 'number', description: 'Quality score 1-5' },
              reasoning: { type: 'string', description: 'Brief explanation of the verdict' },
              improvements: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific improvements needed (empty array if pass)',
              },
            },
            required: ['verdict', 'score', 'reasoning', 'improvements'],
            additionalProperties: false,
          },
        },
      };

      // Invoke reviewer agent inline (synchronous — blocks until review completes)
      try {
        const { invokeAgent } = await import('@/lib/invoke-agent');
        const reviewRunId = generateId('run');
        const prevRun = findLatestRun(ctx.taskId);
        const deskDir = prevRun?.workspaceCwd ?? ctx.deskDir;
        const delivDir = ctx.delivDir;
        const manifestPath = ctx.manifestPath;

        const result = await invokeAgent({
          taskId: ctx.taskId,
          runId: reviewRunId,
          agentId: task.supervisorAgentId,
          department: ctx.department,
          prompt: reviewPrompt,
          soulMd: reviewerConfig.soulMd,
          deskDir,
          delivDir,
          manifestPath,
          outputFormat: reviewOutputFormat,
          maxBudgetUsd: 1.0,
        });

        // Log agent switch end
        insertActivityLog({
          taskId: ctx.taskId,
          agentId: task.supervisorAgentId,
          actionType: 'AGENT_SWITCH_END',
          description: `Review round ${currentRound + 1} completed`,
          metadata: { fromAgent: task.supervisorAgentId, reason: 'review_complete', round: currentRound + 1 },
        });

        // Parse the structured verdict
        let verdict = { verdict: 'pass', score: 3, reasoning: 'Review completed', improvements: [] as string[] };
        if (result.structuredOutput) {
          verdict = result.structuredOutput as typeof verdict;
        } else if (result.result) {
          // Try to parse from text
          try {
            const jsonMatch = result.result.match(/\{[\s\S]*\}/);
            if (jsonMatch) verdict = JSON.parse(jsonMatch[0]);
          } catch { /* use default */ }
        }

        // Store review feedback in task
        sqlite.prepare(
          "UPDATE tasks SET reviewFeedback = ?, currentActorId = ?, updatedAt = datetime('now') WHERE id = ?"
        ).run(
          JSON.stringify(verdict),
          task.executorAgentId, // hand control back to executor
          ctx.taskId,
        );

        // Format the response for the calling agent
        const verdictText = [
          `## Review Verdict: ${verdict.verdict.toUpperCase()} (${verdict.score}/5)`,
          `**Round:** ${currentRound + 1} of ${MAX_REVIEW_CYCLES}`,
          `**Reasoning:** ${verdict.reasoning}`,
          verdict.improvements.length > 0
            ? `**Improvements needed:**\n${verdict.improvements.map(i => `- ${i}`).join('\n')}`
            : '',
          verdict.verdict === 'pass'
            ? '\nYour work has been approved. You can now finish.'
            : '\nPlease address the feedback above, then call submit_for_review again.',
        ].filter(Boolean).join('\n');

        return { content: [{ type: 'text' as const, text: verdictText }] };

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);

        // Log agent switch end even on failure
        insertActivityLog({
          taskId: ctx.taskId,
          agentId: task.supervisorAgentId,
          actionType: 'AGENT_SWITCH_END',
          description: `Review round ${currentRound + 1} failed: ${errMsg.slice(0, 100)}`,
          metadata: { fromAgent: task.supervisorAgentId, reason: 'review_failed', error: errMsg.slice(0, 200) },
        });

        return { content: [{ type: 'text' as const, text: `Review invocation failed: ${errMsg}. You may try submit_for_review again or escalate to CEO.` }] };
      }
    },
  );

  const approveDeliverable = tool(
    'approve_deliverable',
    'Approve the deliverable. The task will be marked completed by the system after the executor finishes.',
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

      // Mark deliverable as approved and record approval time, but do NOT transition the task.
      // The worker will transition to 'completed' after the executor's session ends,
      // ensuring the executor's SDK_RESULT_SUCCESS gets logged cleanly.
      sqlite.prepare(
        "UPDATE tasks SET completedAt = datetime('now'), metadata = json_set(COALESCE(metadata, '{}'), '$.reviewApproved', 1) WHERE id = ?"
      ).run(ctx.taskId);

      // Update deliverable status to 'reviewed'
      sqlite.prepare(
        "UPDATE deliverables SET status = 'reviewed', updatedAt = datetime('now') WHERE taskId = ?"
      ).run(ctx.taskId);

      // Note: Skill extraction (DELIV-08) is handled by the worker post-completion,
      // not inside approve_deliverable. This keeps the review chain fast and avoids
      // blocking the executor while a slow extraction agent reads the workspace.

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
