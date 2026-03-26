import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { transitionTask } from '@/lib/state-machine';
import { eventBus } from '@/lib/events';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'hire-reject' });

/**
 * POST /api/hire_requests/[id]/reject
 * Per D-12: Reject a hire request.
 * Updates task metadata with rejection context, enqueues new task_run
 * for dept head to continue without the hire, and transitions task back to working.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await request.json().catch(() => ({}));
  const reason = (body as { reason?: string }).reason ?? 'No reason provided';

  // Find hire request
  const hireRequest = await prisma.hireRequest.findUnique({ where: { id } });
  if (!hireRequest) {
    return NextResponse.json({ error: 'Hire request not found' }, { status: 404 });
  }
  if (hireRequest.status !== 'pending') {
    return NextResponse.json(
      { error: `Hire request already ${hireRequest.status}` },
      { status: 400 }
    );
  }

  // Update hire request
  await prisma.hireRequest.update({
    where: { id },
    data: { status: 'rejected', resolvedAt: new Date() },
  });

  // Update task metadata with rejection context
  const task = await prisma.task.findUnique({ where: { id: hireRequest.taskId } });
  const existingMetadata = task?.metadata ? JSON.parse(task.metadata as string) : {};
  const updatedMetadata = {
    ...existingMetadata,
    inputType: undefined,  // clear the hire_approval input type
    hireRejected: true,
    hireRequestId: id,
    rejectionReason: reason,
  };
  sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
    .run(JSON.stringify(updatedMetadata), hireRequest.taskId);

  // Transition back to working -- dept head continues without the hire
  transitionTask(hireRequest.taskId, 'input-required', 'working', {
    hireRejected: true,
    rejectionReason: reason,
  });

  // Enqueue a new task_run for the dept head to resume without the hire.
  // The dept head needs to continue the task and find an alternative approach.
  const deptHeadEmployee = await prisma.employee.findFirst({
    where: { agentId: hireRequest.requestedBy },
  });

  if (deptHeadEmployee) {
    const previousRun = await prisma.taskRun.findFirst({
      where: { taskId: hireRequest.taskId, employeeId: deptHeadEmployee.id },
      orderBy: { createdAt: 'desc' },
    });

    await prisma.taskRun.create({
      data: {
        id: generateId('run'),
        taskId: hireRequest.taskId,
        employeeId: deptHeadEmployee.id,
        status: 'queued',
        sessionId: previousRun?.sessionId ?? null,
        workspaceCwd: previousRun?.workspaceCwd ?? null,
        agents: null,  // No subagent on rejection
        createdAt: new Date(),
      },
    });

    log.info(
      { taskId: hireRequest.taskId, deptHead: hireRequest.requestedBy },
      'Enqueued task_run for dept head continuation without hire'
    );
  }

  // Emit event
  eventBus.emit('hire:rejected', {
    taskId: hireRequest.taskId,
    hireRequestId: id,
    reason,
  });

  log.info({ hireRequestId: id, reason }, 'Hire request rejected');

  return NextResponse.json({
    success: true,
    message: `Hire request for ${hireRequest.employeeName} rejected: ${reason}`,
  });
}
