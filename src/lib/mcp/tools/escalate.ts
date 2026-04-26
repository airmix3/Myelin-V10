/**
 * MCP tool: escalate_to_ceo — General-purpose escalation pipeline.
 * Creates an Escalation record and transitions the task to input-required for CEO response.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { sqlite } from '@/lib/db';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { transitionTask } from '@/lib/state-machine';
import { eventBus } from '@/lib/events';
import { classifyColumn } from '@/lib/classify-column';
import type { ToolContext } from '../tool-context';

export function createEscalateTools(ctx: ToolContext) {
  const escalateToCeo = tool(
    'escalate_to_ceo',
    'Escalate an issue, question, or approval request to the CEO. Task will be paused pending CEO response.',
    {
      type: z.enum(['clarification', 'hire_approval', 'budget_increase', 'external_dependency', 'custom']).describe('Type of escalation. Use external_dependency when you need an API key, paid service account, or access credentials to proceed.'),
      summary: z.string().describe('Brief summary of what is needed from the CEO'),
      reason: z.string().optional().describe('Detailed explanation of why this escalation is needed'),
      urgency: z.enum(['low', 'normal', 'high', 'critical']).optional().default('normal').describe('Urgency level'),
      context_json: z.string().optional().describe('JSON string with type-specific data (costEstimate, candidateRole, questionText, etc.)'),
    },
    async (args) => {
      const escalationId = generateId('esc');

      // Fetch task info for enrichment
      const task = await prisma.task.findUnique({
        where: { id: ctx.taskId },
        select: { title: true, department: true },
      });

      // Build enriched context
      const contextData = args.context_json ? JSON.parse(args.context_json) : {};
      contextData.taskTitle = task?.title;
      contextData.taskDepartment = task?.department;

      // Create Escalation record
      await prisma.escalation.create({
        data: {
          id: escalationId,
          taskId: ctx.taskId,
          agentId: ctx.agentId,
          type: args.type,
          urgency: args.urgency ?? 'normal',
          status: 'pending',
          summary: args.summary,
          reason: args.reason ?? null,
          context: JSON.stringify(contextData),
        },
      });

      // Transition task to input-required
      const result = transitionTask(ctx.taskId, 'working', 'input-required', {
        inputType: 'escalation',
        escalationId,
      });

      if (!result.success) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: Failed to transition task: ${result.error}`,
          }],
        };
      }

      // Update task metadata
      sqlite.prepare(
        'UPDATE tasks SET metadata = ? WHERE id = ?'
      ).run(
        JSON.stringify({ inputType: 'escalation', escalationId }),
        ctx.taskId
      );

      // Classify kanban column (fire-and-forget -- don't block tool response)
      classifyColumn(ctx.taskId, { type: args.type, summary: args.summary, reason: args.reason }).catch(() => {
        // logged internally, non-blocking
      });

      // Emit event
      eventBus.emit('escalation:created', {
        taskId: ctx.taskId,
        escalationId,
        type: args.type,
        urgency: args.urgency ?? 'normal',
        agentId: ctx.agentId,
        summary: args.summary,
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Escalation submitted to CEO. Task paused pending response. (ID: ${escalationId})`,
        }],
      };
    },
  );

  return [escalateToCeo];
}
