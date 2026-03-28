import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { transitionTask } from '@/lib/state-machine';
import { eventBus } from '@/lib/events';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'hire-approve' });

/**
 * POST /api/hire_requests/[id]/approve
 * Per D-11, AGENT-06: Approve a hire request.
 * Creates temp employee, stores subagent definition, enqueues new task_run
 * for dept head re-invocation, and transitions task back to working.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

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

  // Look up task for department and context
  const task = await prisma.task.findUnique({ where: { id: hireRequest.taskId } });

  // Create temp employee record
  const employeeId = generateId('emp');
  const agentId = `temp_${hireRequest.employeeName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
  await prisma.employee.create({
    data: {
      id: employeeId,
      name: hireRequest.employeeName,
      role: 'temp',
      department: task?.department ?? 'cos',
      agentId,
      status: 'active',
      budgetLimit: 5.0,  // Lower budget for temps per AGENT-06
      budgetSpent: 0.0,
    },
  });

  // Update hire request status
  await prisma.hireRequest.update({
    where: { id },
    data: { status: 'approved', resolvedAt: new Date() },
  });

  // Build the subagent definition -- per AGENT-06: restricted tool access
  const subagentDef = {
    [agentId]: {
      description: hireRequest.employeeRole,
      prompt: [
        `You are ${hireRequest.employeeName}, a ${hireRequest.employeeRole}`,
        `working under the ${task?.department ?? 'unknown'} department.`,
        task?.title ? `\nTask: ${task.title}` : '',
        task?.description ? `\n${task.description}` : '',
        '\nYou have limited tool access. Focus on producing deliverables.',
      ].join(' '),
      tools: [
        'Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep',
        'mcp__cortex__read_memory', 'mcp__cortex__write_memory',
        'mcp__cortex__read_knowledge', 'mcp__cortex__search_knowledge',
        'mcp__cortex__promote_to_deliverable', 'mcp__cortex__propose_skill',
        'mcp__cortex__submit_for_review',
      ],
    },
  };

  // Store subagent definition in task metadata for the dept head's next invocation
  const existingMetadata = task?.metadata ? JSON.parse(task.metadata as string) : {};
  const updatedMetadata = {
    ...existingMetadata,
    inputType: undefined,  // clear the hire_approval input type
    hireApproved: true,
    hireRequestId: id,
    employeeId,
    employeeAgentId: agentId,
    subagentDefinition: subagentDef,
  };
  sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
    .run(JSON.stringify(updatedMetadata), hireRequest.taskId);

  // Transition task back to working
  transitionTask(hireRequest.taskId, 'input-required', 'working', {
    hireApproved: true,
    employeeId,
    employeeName: hireRequest.employeeName,
  });

  // Enqueue a new task_run for the dept head to resume execution.
  // The worker loop only processes queued runs. Without this, the dept head
  // never gets re-invoked after hire approval. The worker's executeRun() reads
  // the agents field and passes it to orchestrator.invoke() which passes it
  // to invokeAgent() as the SDK AgentDefinition subagents parameter.
  const deptHeadEmployee = await prisma.employee.findFirst({
    where: { agentId: hireRequest.requestedBy },
  });

  if (!deptHeadEmployee) {
    log.error(
      { requestedBy: hireRequest.requestedBy },
      'Dept head employee not found for re-invocation'
    );
  } else {
    // Find the previous run's sessionId for session resume
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
        agents: JSON.stringify(subagentDef),
        createdAt: new Date(),
      },
    });

    log.info(
      { taskId: hireRequest.taskId, deptHead: hireRequest.requestedBy },
      'Enqueued task_run for dept head re-invocation with subagent'
    );
  }

  // Emit event
  eventBus.emit('hire:approved', {
    taskId: hireRequest.taskId,
    hireRequestId: id,
    employeeId,
    employeeName: hireRequest.employeeName,
    employeeRole: hireRequest.employeeRole,
  });

  log.info({ hireRequestId: id, employeeId, agentId }, 'Hire request approved');

  return NextResponse.json({
    success: true,
    employeeId,
    agentId,
    message: `${hireRequest.employeeName} hired as ${hireRequest.employeeRole}`,
  });
}
