import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { transitionTask } from '@/lib/state-machine';
import { eventBus } from '@/lib/events';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'escalation-respond' });

/**
 * POST /api/escalations/[id]/respond
 * Body: { response: string, resolution?: 'approved' | 'declined' | 'answered' }
 * Updates escalation, transitions task back to working, re-queues agent run.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await request.json();
  const { response, resolution = 'answered' } = body;

  if (!response) {
    return NextResponse.json({ error: 'Response text is required' }, { status: 400 });
  }

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

  // Update escalation
  await prisma.escalation.update({
    where: { id },
    data: {
      response,
      resolution,
      status: 'responded',
      resolvedAt: new Date(),
    },
  });

  // Update task metadata: clear inputType, add escalation response
  const task = await prisma.task.findUnique({ where: { id: escalation.taskId } });
  const existingMetadata = task?.metadata ? JSON.parse(task.metadata as string) : {};
  const updatedMetadata = {
    ...existingMetadata,
    inputType: undefined,
    escalationResolved: true,
    escalationId: id,
    escalationResponse: response,
    escalationResolution: resolution,
  };
  sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
    .run(JSON.stringify(updatedMetadata), escalation.taskId);

  // Transition task back to working
  transitionTask(escalation.taskId, 'input-required', 'working', {
    escalationResolved: true,
    escalationId: id,
  });

  // Re-queue a task_run for the original agent (same pattern as hire approve)
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
      'Enqueued task_run for agent re-invocation after escalation response'
    );
  }

  // Emit event
  eventBus.emit('escalation:responded', {
    escalationId: id,
    taskId: escalation.taskId,
    resolution,
  });

  log.info({ escalationId: id, resolution }, 'Escalation responded');

  return NextResponse.json({
    success: true,
    message: `Escalation ${resolution}`,
  });
}
