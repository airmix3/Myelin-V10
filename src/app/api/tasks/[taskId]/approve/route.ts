import { prisma } from '@/lib/db';
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

  const workspace = createTaskWorkspace(
    params.taskId,
    task.department as Department,
    plan + claudeMdExtra,
    constraints,
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

  // Enqueue task_run
  const runId = generateId('run');
  await prisma.taskRun.create({
    data: {
      id: runId,
      taskId: params.taskId,
      employeeId: task.executorAgentId || task.planningAgentId || 'cto',
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
