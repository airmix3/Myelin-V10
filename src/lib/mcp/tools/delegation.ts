/**
 * MCP tools: delegate_subtask, submit_deliverable, request_input
 * Per doc 17 Phase 2: Sub-task delegation (Mode 2).
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { mkdirSync, writeFileSync, symlinkSync, existsSync, appendFileSync } from 'fs';
import { join, basename } from 'path';
import { sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/events';
import { insertActivityLog } from '@/lib/activity-log';
import type { ToolContext } from '../tool-context';

export function createDelegationTools(ctx: ToolContext) {
  // -----------------------------------------------------------------------
  // delegate_subtask -- dept heads only
  // -----------------------------------------------------------------------
  const delegateSubtask = tool(
    'delegate_subtask',
    'Delegate a sub-task to an employee. Creates an isolated workspace, queues the employee run, and saves your session for resume. You will be re-invoked with results when the employee completes.',
    {
      employee_agent_id: z.string().describe('agentId of the employee to delegate to'),
      description: z.string().describe('What the employee should do — clear, actionable instructions'),
      shared_files: z.array(z.string()).optional().describe('Relative paths in your desk to share with the employee (symlinked)'),
      budget_cents: z.number().optional().default(500).describe('Budget for this sub-task in cents (default 500 = $5)'),
    },
    async (args) => {
      const { employee_agent_id, description, shared_files } = args;
      // SDK tool handler does not apply zod defaults — apply manually
      const budget_cents = args.budget_cents ?? 500;

      // Generate subtask ID
      const subtaskId = 'st_' + generateId('st').slice(3);

      // Create subtask workspace
      const subtasksDir = join(ctx.deskDir, 'subtasks');
      const subtaskDir = join(subtasksDir, subtaskId);
      const sharedDir = join(subtaskDir, 'shared');
      const outputDir = join(subtaskDir, 'output');
      mkdirSync(sharedDir, { recursive: true });
      mkdirSync(outputDir, { recursive: true });

      // Write settings.json for project boundary in subtask workspace
      const claudeDir = join(subtaskDir, '.claude');
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify({
        permissions: {
          allow: ['Bash(*)', 'Read(*)', 'Write(*)', 'Edit(*)', 'mcp__cortex__*'],
          deny: [],
        },
      }, null, 2), 'utf-8');

      // Write CLAUDE.md for employee
      writeFileSync(join(subtaskDir, 'CLAUDE.md'), `# Sub-Task: ${subtaskId}

## Instructions

${description}

## Output

Place your output files in the \`output/\` directory.
When done, call \`submit_deliverable\` with a summary and the primary output file path.
If you need clarification, call \`request_input\` with your question.

## Shared Files

Check the \`shared/\` directory for any resources shared by your supervisor.

## Important

- Stay within this directory. Do not access files outside your workspace.
- Use \`submit_deliverable\` when your work is complete.
- Use \`request_input\` only when truly stuck — try to make reasonable assumptions first.
`, 'utf-8');

      // Symlink shared files
      if (shared_files && shared_files.length > 0) {
        for (const file of shared_files) {
          const sourcePath = join(ctx.deskDir, file);
          const targetPath = join(sharedDir, basename(file));
          if (existsSync(sourcePath) && !existsSync(targetPath)) {
            try {
              symlinkSync(sourcePath, targetPath, 'junction');
            } catch {
              // Copy fallback could go here; for now just skip
            }
          }
        }
      }

      // Look up employee DB id
      const empRow = sqlite.prepare('SELECT id FROM employees WHERE agentId = ?').get(employee_agent_id) as { id: string } | undefined;
      if (!empRow) {
        return {
          content: [{ type: 'text' as const, text: `Error: Employee ${employee_agent_id} not found in database.` }],
        };
      }

      // Look up current run's sessionId for parent resume
      const currentRun = sqlite.prepare('SELECT sessionId FROM task_runs WHERE id = ?').get(ctx.runId) as { sessionId: string | null } | undefined;

      // Create employee TaskRun
      const employeeRunId = generateId('run');
      sqlite.prepare(`
        INSERT INTO task_runs (id, taskId, employeeId, status, subtask_id, subtask_description, workspaceCwd, parent_run_id, on_complete, createdAt)
        VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        employeeRunId,
        ctx.taskId,
        empRow.id,
        subtaskId,
        description,
        subtaskDir,
        ctx.runId,
        JSON.stringify({ action: 'resume_parent', parentRunId: ctx.runId, subtaskId }),
      );

      // Write delegation_log.jsonl entry
      const logPath = join(subtasksDir, 'delegation_log.jsonl');
      const logEntry = {
        subtaskId,
        employee: employee_agent_id,
        description,
        iteration: 1,
        status: 'delegated',
        budgetCents: budget_cents,
        timestamp: new Date().toISOString(),
      };
      appendFileSync(logPath, JSON.stringify(logEntry) + '\n', 'utf-8');

      // Activity log
      insertActivityLog({
        taskId: ctx.taskId,
        agentId: ctx.agentId,
        actionType: 'DELEGATION_CREATED',
        description: `Delegated "${description}" to ${employee_agent_id}`,
        metadata: { subtaskId, employeeAgentId: employee_agent_id, budgetCents: budget_cents },
      });

      // Emit event
      eventBus.emit('delegation:created', {
        taskId: ctx.taskId,
        subtaskId,
        employeeAgentId: employee_agent_id,
        parentRunId: ctx.runId,
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Sub-task ${subtaskId} delegated to ${employee_agent_id}. You will be re-invoked with results when the employee completes. Your session will be saved and resumed.`,
        }],
      };
    },
  );

  // -----------------------------------------------------------------------
  // submit_deliverable -- employees only
  // -----------------------------------------------------------------------
  const submitDeliverable = tool(
    'submit_deliverable',
    'Submit your completed work. Writes a deliverable manifest and signals completion to your supervisor.',
    {
      summary: z.string().describe('Brief summary of what was produced'),
      primary_file: z.string().describe('Relative path to the primary output file (in output/)'),
      status: z.enum(['completed', 'needs_revision']).optional().default('completed').describe('Deliverable status'),
    },
    async (args) => {
      const { summary, primary_file } = args;
      // SDK tool handler does not apply zod defaults — apply manually
      const status = args.status ?? 'completed';

      // Read current run for subtask info
      const run = sqlite.prepare('SELECT subtask_id, subtask_description FROM task_runs WHERE id = ?').get(ctx.runId) as {
        subtask_id: string | null;
        subtask_description: string | null;
      } | undefined;

      // Write deliverable.json to the subtask workspace (ctx.deskDir is the subtask dir)
      const deliverable = {
        subtaskId: run?.subtask_id ?? null,
        parentTaskId: ctx.taskId,
        assignedTo: ctx.agentId,
        description: run?.subtask_description ?? '',
        status,
        summary,
        primaryFile: primary_file,
        iteration: 1,
        completedAt: new Date().toISOString(),
      };

      writeFileSync(join(ctx.deskDir, 'deliverable.json'), JSON.stringify(deliverable, null, 2), 'utf-8');

      // Activity log
      insertActivityLog({
        taskId: ctx.taskId,
        agentId: ctx.agentId,
        actionType: 'SUBTASK_DELIVERED',
        description: `Submitted deliverable: ${summary}`,
        metadata: { subtaskId: run?.subtask_id, primaryFile: primary_file },
      });

      return {
        content: [{ type: 'text' as const, text: `Deliverable submitted. Summary: ${summary}` }],
      };
    },
  );

  // -----------------------------------------------------------------------
  // request_input -- employees only
  // -----------------------------------------------------------------------
  const requestInput = tool(
    'request_input',
    'Request clarification from your supervisor. Your session will end and the supervisor will be re-invoked with your question.',
    {
      question: z.string().describe('The question you need answered to proceed'),
    },
    async (args) => {
      const { question } = args;

      // Read current run for subtask info
      const run = sqlite.prepare('SELECT subtask_id, subtask_description FROM task_runs WHERE id = ?').get(ctx.runId) as {
        subtask_id: string | null;
        subtask_description: string | null;
      } | undefined;

      // Write/update deliverable.json with needs_input status
      const deliverable = {
        subtaskId: run?.subtask_id ?? null,
        parentTaskId: ctx.taskId,
        assignedTo: ctx.agentId,
        description: run?.subtask_description ?? '',
        status: 'needs_input',
        question,
        summary: null,
        primaryFile: null,
        iteration: 1,
        completedAt: null,
      };

      writeFileSync(join(ctx.deskDir, 'deliverable.json'), JSON.stringify(deliverable, null, 2), 'utf-8');

      // Activity log
      insertActivityLog({
        taskId: ctx.taskId,
        agentId: ctx.agentId,
        actionType: 'SUBTASK_INPUT_REQUESTED',
        description: `Input requested: "${question}"`,
        metadata: { subtaskId: run?.subtask_id, question },
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Input requested from department head: '${question}'. Your session will end and the head will be re-invoked with your question.`,
        }],
      };
    },
  );

  return [delegateSubtask, submitDeliverable, requestInput];
}
