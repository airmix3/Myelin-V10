/**
 * MCP tool: list_my_employees -- Per doc 17 Phase 1.
 * Returns department employee roster with capabilities for delegation decisions.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { sqlite } from '@/lib/db';
import type { ToolContext } from '../tool-context';

export function createEmployeeTools(ctx: ToolContext) {
  const listMyEmployees = tool(
    'list_my_employees',
    'List employees in your department with their capabilities, type, and status. Use to decide delegation.',
    { department: z.string().optional().describe('Filter by department (defaults to your department)') },
    async (args) => {
      const dept = args.department || ctx.department;

      // Query employees for this department (exclude executives, include active + pending)
      const employees = sqlite.prepare(`
        SELECT id, name, role, department, agentId, status, capabilities, tool_whitelist as toolWhitelist
        FROM employees
        WHERE department = ? AND role != 'executive' AND status IN ('active', 'pending')
        ORDER BY name ASC
      `).all(dept) as Array<Record<string, unknown>>;

      if (employees.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `No employees found in ${dept} department. Use hire_employee to request new hires.` }],
        };
      }

      const roster = employees.map(emp => {
        const caps = emp.capabilities ? JSON.parse(emp.capabilities as string) : {};
        return {
          agentId: emp.agentId,
          name: emp.name,
          role: emp.role,
          status: emp.status,
          specialty: caps.specialty || 'general',
          outputTypes: caps.outputTypes || [],
          description: caps.description || emp.role,
        };
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(roster, null, 2) }],
      };
    },
  );

  return [listMyEmployees];
}
