import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { createTaskWorkspace } from '@/lib/workspace';
import { eventBus } from '@/lib/events';
import { NextRequest, NextResponse } from 'next/server';
import type { Department } from '@/lib/workspace';

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // Parse optional executor override from request body
  const body = await request.json().catch(() => ({}));
  const executorOverride = body.executorAgentId as string | undefined;

  const metadata = task.metadata ? JSON.parse(task.metadata) : {};
  const config = metadata.config || {};

  // Create NEW execution desk (separate from planning desk per TAMIR-06)
  const plan = task.planMarkdown || '';
  const constraints = config.constraints || '';

  // Build CLAUDE.md additions for selected tools/skills hints (per TAMIR-06)
  let claudeMdExtra = '';
  if (config.selectedTools?.length || config.selectedSkills?.length) {
    claudeMdExtra += '\n\n## CEO Hints\n';
    if (config.selectedTools?.length) {
      claudeMdExtra += '\n### Selected Tools\n';
      for (const tool of config.selectedTools) {
        const hint = config.toolHints?.[tool] || '';
        claudeMdExtra += `- ${tool}${hint ? `: ${hint}` : ''}\n`;
      }
    }
    if (config.selectedSkills?.length) {
      claudeMdExtra += '\n### Selected Skills\n';
      for (const skill of config.selectedSkills) {
        claudeMdExtra += `- ${skill}\n`;
      }
    }
  }

  const targetAssetId = metadata.targetAssetId as string | undefined;

  const fullPlan = plan + (claudeMdExtra || '');
  const ceoHints = (config.selectedTools?.length || config.selectedSkills?.length)
    ? {
        selectedTools: config.selectedTools as string[] | undefined,
        selectedSkills: config.selectedSkills as string[] | undefined,
        toolHints: config.toolHints as Record<string, string> | undefined,
      }
    : undefined;
  const workspace = createTaskWorkspace(
    params.taskId,
    task.department as Department,
    fullPlan,
    constraints,
    ceoHints,
    targetAssetId,
  );

  // Create Deliverable record
  const delivId = generateId('deliv');
  await prisma.deliverable.create({
    data: {
      id: delivId,
      taskId: params.taskId,
      title: task.title,
      type: null, // will be set during execution
      department: task.department,
      creatorId: task.executorAgentId,
      workspacePath: workspace.baseDir,
      manifestPath: workspace.manifestPath,
    },
  });

  // Mode 1 delegation: If CEO selected an employee executor, set executor=employee, supervisor=head
  let effectiveExecutorAgentId = task.executorAgentId || task.planningAgentId || 'cto';
  if (executorOverride) {
    const planningHead = task.planningAgentId || effectiveExecutorAgentId;
    // Check if the override is a non-head employee
    const overrideEmp = sqlite.prepare(
      "SELECT id, role FROM employees WHERE agentId = ?"
    ).get(executorOverride) as { id: string; role: string } | undefined;

    if (overrideEmp && overrideEmp.role !== 'executive') {
      // Employee executor: set supervisor to head, executor to employee
      await prisma.task.update({
        where: { id: params.taskId },
        data: {
          executorAgentId: executorOverride,
          supervisorAgentId: planningHead,
          currentActorId: executorOverride,
        },
      });
      effectiveExecutorAgentId = executorOverride;
    } else {
      // Head selected (or not found) -- use as executor directly
      effectiveExecutorAgentId = executorOverride;
    }
  }

  // Look up employee DB id from agentId (task.executorAgentId is an agentId string like 'cto')
  const agentId = effectiveExecutorAgentId;
  const employeeRow = sqlite.prepare('SELECT id FROM employees WHERE agentId = ?').get(agentId) as { id: string } | undefined;
  if (!employeeRow) {
    return NextResponse.json({ error: `No employee found for agentId: ${agentId}` }, { status: 500 });
  }

  // Enqueue task_run
  const runId = generateId('run');
  await prisma.taskRun.create({
    data: {
      id: runId,
      taskId: params.taskId,
      employeeId: employeeRow.id,
      status: 'queued',
      workspaceCwd: workspace.deskDir,
    },
  });

  // Update task metadata with approvedAt and deliverableId
  const updatedMeta = {
    ...metadata,
    approvedAt: new Date().toISOString(),
    deliverableId: delivId,
  };
  await prisma.task.update({
    where: { id: params.taskId },
    data: { metadata: JSON.stringify(updatedMeta) },
  });

  // Notify via SSE
  eventBus.emit('task:transition', {
    taskId: params.taskId,
    event: 'approved',
    deliverableId: delivId,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ deliverableId: delivId, redirect: `/deliverables/${delivId}` });
}
