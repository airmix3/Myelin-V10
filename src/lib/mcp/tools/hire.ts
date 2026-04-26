/**
 * MCP tool: hire_employee -- Per doc 17 Phase 3.
 * Enhanced with type (temp/permanent), soul_draft, specialty, output_types.
 * Creates a HireRequest and transitions the task to input-required for CEO approval.
 * Supports auto-approve for temps when configured.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { sqlite } from '@/lib/db';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { transitionTask } from '@/lib/state-machine';
import { eventBus } from '@/lib/events';
import { insertActivityLog } from '@/lib/activity-log';
import { orchestrator } from '@/lib/orchestrator';
import { HIRING_TEMP_AUTO_APPROVE, HIRING_AUTO_APPROVE } from '@/lib/config';
import { classifyColumn } from '@/lib/classify-column';
import type { ToolContext } from '../tool-context';

export function createHireTools(ctx: ToolContext) {
  const hireEmployee = tool(
    'hire_employee',
    'Request to hire an employee for a specialized task. For permanent hires and temps (when auto-approve is off), the task will be paused pending CEO approval.',
    {
      employee_name: z.string().describe('Name/title for the employee'),
      employee_role: z.string().describe('Role description (e.g., "Data Scientist", "Video Editor")'),
      justification: z.string().describe('Why this hire is needed for the current task'),
      type: z.enum(['temp', 'permanent']).optional().default('temp').describe('Employee type: temp (disposed after task) or permanent'),
      soul_draft: z.string().optional().describe('Draft soul.md content defining the employee personality and approach'),
      specialty: z.string().optional().describe('Employee specialty (e.g., "competitive analysis, market sizing")'),
      output_types: z.array(z.string()).optional().describe('Types of output this employee produces (e.g., ["report", "analysis"])'),
    },
    async (args) => {
      // SDK tool handler does not apply zod defaults — apply manually
      const type = args.type ?? 'temp';
      const shouldAutoApprove = (type === 'temp' && HIRING_TEMP_AUTO_APPROVE) || HIRING_AUTO_APPROVE;

      // Create HireRequest
      const hireRequest = await prisma.hireRequest.create({
        data: {
          id: generateId('hire'),
          taskId: ctx.taskId,
          requestedBy: ctx.agentId,
          employeeName: args.employee_name,
          employeeRole: args.employee_role,
          justification: args.justification,
          status: shouldAutoApprove ? 'approved' : 'pending',
        },
      });

      // Store extended hire config in task metadata
      const task = sqlite.prepare('SELECT metadata FROM tasks WHERE id = ?').get(ctx.taskId) as { metadata: string | null } | undefined;
      const taskMeta = task?.metadata ? JSON.parse(task.metadata) : {};
      taskMeta.pendingHire = {
        type,
        soulDraft: args.soul_draft,
        specialty: args.specialty,
        outputTypes: args.output_types || [],
      };
      sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
        .run(JSON.stringify(taskMeta), ctx.taskId);

      if (shouldAutoApprove) {
        // Auto-approve: create employee immediately, register, and return
        const employeeId = generateId('emp');
        const agentId = `${type}_${args.employee_name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

        await prisma.employee.create({
          data: {
            id: employeeId,
            name: args.employee_name,
            role: type,
            department: ctx.department,
            agentId,
            status: 'active',
            budgetLimit: 5.0,
            budgetSpent: 0.0,
            capabilities: JSON.stringify({
              specialty: args.specialty,
              outputTypes: args.output_types || [],
              description: args.employee_role,
            }),
            toolWhitelist: JSON.stringify(['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch']),
          },
        });

        // Register in orchestrator
        orchestrator.register({
          agentId,
          name: args.employee_name,
          department: ctx.department,
          role: type,
          soulMd: args.soul_draft ?? '',
          avatarColor: '#6B7280',
          isEmployee: true,
          parentAgentId: ctx.agentId,
          capabilities: JSON.stringify({ specialty: args.specialty, outputTypes: args.output_types || [] }),
        });

        insertActivityLog({
          taskId: ctx.taskId,
          agentId: ctx.agentId,
          actionType: 'HIRE_AUTO_APPROVED',
          description: `Auto-approved hire: ${args.employee_name} as ${args.employee_role} (${type})`,
          metadata: { hireRequestId: hireRequest.id, employeeId, agentId, type },
        });

        // Clean pendingHire from metadata
        delete taskMeta.pendingHire;
        sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
          .run(JSON.stringify(taskMeta), ctx.taskId);

        return {
          content: [{
            type: 'text' as const,
            text: `Employee ${args.employee_name} (${args.employee_role}) hired and registered as ${agentId}. Ready for delegation.`,
          }],
        };
      }

      // Non-auto: transition task to input-required for CEO approval
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

      // Update task metadata with inputType
      taskMeta.inputType = 'hire_approval';
      taskMeta.hireRequestId = hireRequest.id;
      sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
        .run(JSON.stringify(taskMeta), ctx.taskId);

      // Classify kanban column (fire-and-forget -- don't block tool response)
      classifyColumn(ctx.taskId, { type: 'hire_approval', summary: `Hire ${args.employee_name} as ${args.employee_role}`, reason: args.justification }).catch(() => {
        // logged internally, non-blocking
      });

      // Emit event
      eventBus.emit('hire:requested', {
        taskId: ctx.taskId,
        hireRequestId: hireRequest.id,
        employeeName: args.employee_name,
        employeeRole: args.employee_role,
        requestedBy: ctx.agentId,
        type,
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Hire request submitted for ${args.employee_name} (${args.employee_role}, ${type}). Task paused pending CEO approval.`,
        }],
      };
    },
  );

  return [hireEmployee];
}
