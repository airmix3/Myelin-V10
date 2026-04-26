import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { transitionTask } from '@/lib/state-machine';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'budget-increase' });

/**
 * POST /api/tasks/[id]/budget
 * Per INT-02: Approve a budget increase for a task in input-required state.
 * Updates budget, transitions back to working, re-enqueues task_run with session resume.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;
  const body = await request.json();
  const newBudget = Number(body.maxBudgetUsd);

  if (!newBudget || newBudget <= 0) {
    return NextResponse.json({ error: 'Invalid budget amount' }, { status: 400 });
  }

  // Verify task exists and is in input-required state with budget_increase inputType
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.state !== 'input-required') {
    return NextResponse.json({ error: 'Task is not awaiting budget increase' }, { status: 400 });
  }

  const metadata = task.metadata ? JSON.parse(task.metadata as string) : {};
  if (metadata.inputType !== 'budget_increase') {
    return NextResponse.json({ error: 'Task is not awaiting budget increase' }, { status: 400 });
  }

  // Update task config with new budget -- clear inputType
  const updatedMeta = { ...metadata, inputType: undefined, maxBudgetUsd: newBudget };
  sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?').run(JSON.stringify(updatedMeta), taskId);

  // Transition back to working
  transitionTask(taskId, 'input-required', 'working', { budgetIncreased: true, newBudget });

  // Update employee budget limit
  const currentActor = task.currentActorId;
  if (currentActor) {
    sqlite.prepare('UPDATE employees SET budgetLimit = ? WHERE agentId = ?').run(newBudget, currentActor);
  }

  // Enqueue new task_run with session resume (Pitfall 5)
  const employee = await prisma.employee.findFirst({ where: { agentId: currentActor ?? '' } });
  if (employee) {
    const prevRun = await prisma.taskRun.findFirst({
      where: { taskId, employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
    });
    await prisma.taskRun.create({
      data: {
        id: generateId('run'),
        taskId,
        employeeId: employee.id,
        status: 'queued',
        sessionId: prevRun?.sessionId ?? null,
        workspaceCwd: prevRun?.workspaceCwd ?? null,
        createdAt: new Date(),
      },
    });
  }

  log.info({ taskId, newBudget }, 'Budget increased and task_run re-enqueued');
  return NextResponse.json({ success: true, newBudget });
}
