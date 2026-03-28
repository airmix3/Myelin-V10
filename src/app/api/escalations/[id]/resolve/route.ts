import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { transitionTask } from '@/lib/state-machine';
import { eventBus } from '@/lib/events';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'escalation-resolve' });

/**
 * POST /api/escalations/[id]/resolve
 * Dismiss an escalation without response (CEO decides not relevant).
 * Transitions task back to working and re-queues agent run.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Find escalation
  const escalation = await prisma.escalation.findUnique({ where: { id } });
  if (!escalation) {
    return NextResponse.json({ error: 'Escalation not found' }, { status: 404 });
  }
  if (escalation.status !== 'pending') {
    return NextResponse.json(
      { error: `Escalation already ${escalation.status}` },
      { status: 400 }
    );
  }

  // Update escalation to dismissed
  await prisma.escalation.update({
    where: { id },
    data: {
      status: 'dismissed',
      resolvedAt: new Date(),
    },
  });

  // Clear task metadata
  const task = await prisma.task.findUnique({ where: { id: escalation.taskId } });
  const existingMetadata = task?.metadata ? JSON.parse(task.metadata as string) : {};
  const updatedMetadata = {
    ...existingMetadata,
    inputType: undefined,
    escalationDismissed: true,
    escalationId: id,
  };
  sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
    .run(JSON.stringify(updatedMetadata), escalation.taskId);

  // Transition task back to working
  transitionTask(escalation.taskId, 'input-required', 'working', {
    escalationDismissed: true,
    escalationId: id,
  });

  // Re-queue task_run
  const agentEmployee = await prisma.employee.findFirst({
    where: { agentId: escalation.agentId },
  });

  if (!agentEmployee) {
    log.error(
      { agentId: escalation.agentId },
      'Agent employee not found for re-invocation'
    );
  } else {
    const previousRun = await prisma.taskRun.findFirst({
      where: { taskId: escalation.taskId, employeeId: agentEmployee.id },
      orderBy: { createdAt: 'desc' },
    });

    await prisma.taskRun.create({
      data: {
        id: generateId('run'),
        taskId: escalation.taskId,
        employeeId: agentEmployee.id,
        status: 'queued',
        sessionId: previousRun?.sessionId ?? null,
        workspaceCwd: previousRun?.workspaceCwd ?? null,
        agents: previousRun?.agents ?? null,
        createdAt: new Date(),
      },
    });

    log.info(
      { taskId: escalation.taskId, agentId: escalation.agentId },
      'Enqueued task_run for agent re-invocation after escalation dismiss'
    );
  }

  // Emit event
  eventBus.emit('escalation:resolved', {
    escalationId: id,
    taskId: escalation.taskId,
  });

  log.info({ escalationId: id }, 'Escalation dismissed');

  return NextResponse.json({
    success: true,
    message: 'Escalation dismissed',
  });
}
