/**
 * GET /api/tasks/[taskId]/employees
 * Returns department employees for the approval UI executor dropdown.
 * Per doc 17 Phase 1: Mode 1 full task delegation.
 */
import { prisma, sqlite } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const metadata = task.metadata ? JSON.parse(task.metadata) : {};
  const recommendedExecutor = metadata.recommendedExecutor || null;

  // Fetch department employees (non-executive, active)
  const employees = sqlite.prepare(`
    SELECT id, name, role, department, agentId, capabilities
    FROM employees
    WHERE department = ? AND role != 'executive' AND status = 'active'
    ORDER BY name ASC
  `).all(task.department) as Array<Record<string, unknown>>;

  // Also include the department head as an option
  const head = sqlite.prepare(`
    SELECT id, name, role, department, agentId
    FROM employees
    WHERE department = ? AND role = 'executive'
    LIMIT 1
  `).get(task.department) as Record<string, unknown> | undefined;

  const options = [];
  if (head) {
    options.push({
      agentId: head.agentId,
      name: `${head.name} (Department Head)`,
      isHead: true,
    });
  }
  for (const emp of employees) {
    const caps = emp.capabilities ? JSON.parse(emp.capabilities as string) : {};
    options.push({
      agentId: emp.agentId,
      name: emp.name,
      specialty: caps.specialty || emp.role,
      isHead: false,
    });
  }

  return NextResponse.json({
    employees: options,
    recommendedExecutor: recommendedExecutor || (head?.agentId ?? null),
    department: task.department,
  });
}
