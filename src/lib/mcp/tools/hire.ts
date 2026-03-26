/**
 * MCP tool: hire_employee — Per TOOL-14.
 * Creates a HireRequest and transitions the task to input-required for CEO approval.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { sqlite } from '@/lib/db';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { transitionTask } from '@/lib/state-machine';
import { eventBus } from '@/lib/events';
import type { ToolContext } from '../tool-context';

export function createHireTools(ctx: ToolContext) {
  const hireEmployee = tool(
    'hire_employee',
    'Request to hire a temporary employee for a specialized task. Task will be paused pending CEO approval.',
    {
      employee_name: z.string().describe('Name/title for the temp employee'),
      employee_role: z.string().describe('Role description (e.g., "Data Scientist", "Video Editor")'),
      justification: z.string().describe('Why this hire is needed for the current task'),
    },
    async (args) => {
      // Create HireRequest
      const hireRequest = await prisma.hireRequest.create({
        data: {
          id: generateId('hire'),
          taskId: ctx.taskId,
          requestedBy: ctx.agentId,
          employeeName: args.employee_name,
          employeeRole: args.employee_role,
          justification: args.justification,
          status: 'pending',
        },
      });

      // Transition task to input-required
      const result = transitionTask(ctx.taskId, 'working', 'input-required', {
        inputType: 'hire_approval',
        hireRequestId: hireRequest.id,
      });

      if (!result.success) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: Failed to transition task: ${result.error}`,
          }],
        };
      }

      // Also update task metadata field
      sqlite.prepare(
        'UPDATE tasks SET metadata = ? WHERE id = ?'
      ).run(
        JSON.stringify({ inputType: 'hire_approval', hireRequestId: hireRequest.id }),
        ctx.taskId
      );

      // Emit event
      eventBus.emit('hire:requested', {
        taskId: ctx.taskId,
        hireRequestId: hireRequest.id,
        employeeName: args.employee_name,
        employeeRole: args.employee_role,
        requestedBy: ctx.agentId,
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Hire request submitted for ${args.employee_name} (${args.employee_role}). Task paused pending CEO approval.`,
        }],
      };
    },
  );

  return [hireEmployee];
}
