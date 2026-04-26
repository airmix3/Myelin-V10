import { prisma } from '@/lib/db';
import WorkspaceClient from './WorkspaceClient';

export const dynamic = 'force-dynamic';

interface TaskWithRelations {
  id: string;
  title: string;
  description: string | null;
  department: string;
  state: string;
  metadata: string | null;
  currentActorId: string | null;
  planMarkdown: string | null;
  createdAt: string;
  updatedAt: string;
  taskRuns: Array<{
    id: string;
    status: string;
    employeeId: string;
    createdAt: string;
    claimedAt: string | null;
  }>;
  deliverables: Array<{
    id: string;
    title: string;
    type: string | null;
    status: string;
    primaryFile: string | null;
    createdAt: string;
  }>;
  escalations: Array<{
    id: string;
    agentId: string;
    type: string;
    urgency: string;
    status: string;
    summary: string;
    createdAt: string;
  }>;
  hireRequests: Array<{
    id: string;
    requestedBy: string;
    employeeName: string;
    employeeRole: string;
    justification: string | null;
    status: string;
    createdAt: string;
  }>;
  budgetUsed: number;
  budgetLimit: number;
  executor: {
    id: string;
    name: string;
    role: string;
    department: string;
    agentId: string | null;
  } | null;
}

export default async function WorkspacePage() {
  // Find all task_runs that are currently executing
  const activeRuns = await prisma.taskRun.findMany({
    where: { status: 'executing' },
    include: {
      task: {
        include: {
          deliverables: true,
          escalations: {
            where: { status: 'pending' },
          },
          hireRequests: {
            where: { status: 'pending' },
          },
        },
      },
      employee: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Aggregate budget for each task
  const taskIds = activeRuns.map((r) => r.taskId);
  const budgetAggregates: Record<string, number> = {};

  if (taskIds.length > 0) {
    // Use Prisma groupBy for cost aggregation
    const costs = await prisma.costEvent.groupBy({
      by: ['taskId'],
      where: { taskId: { in: taskIds } },
      _sum: { costUsd: true },
    });
    for (const c of costs) {
      budgetAggregates[c.taskId] = c._sum.costUsd ?? 0;
    }
  }

  // Serialize into client-friendly format
  const activeTasks: TaskWithRelations[] = activeRuns.map((run) => {
    const task = run.task;
    const meta = task.metadata ? JSON.parse(task.metadata) : {};
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      department: task.department,
      state: task.state,
      metadata: task.metadata,
      currentActorId: task.currentActorId,
      planMarkdown: task.planMarkdown,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      taskRuns: [{
        id: run.id,
        status: run.status,
        employeeId: run.employeeId,
        createdAt: run.createdAt.toISOString(),
        claimedAt: run.claimedAt?.toISOString() ?? null,
      }],
      deliverables: task.deliverables.map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        status: d.status,
        primaryFile: d.primaryFile,
        createdAt: d.createdAt.toISOString(),
      })),
      escalations: task.escalations.map((e) => ({
        id: e.id,
        agentId: e.agentId,
        type: e.type,
        urgency: e.urgency,
        status: e.status,
        summary: e.summary,
        createdAt: e.createdAt.toISOString(),
      })),
      hireRequests: task.hireRequests.map((h) => ({
        id: h.id,
        requestedBy: h.requestedBy,
        employeeName: h.employeeName,
        employeeRole: h.employeeRole,
        justification: h.justification,
        status: h.status,
        createdAt: h.createdAt.toISOString(),
      })),
      budgetUsed: budgetAggregates[task.id] ?? 0,
      budgetLimit: meta.maxBudgetUsd ?? run.employee.budgetLimit ?? 10,
      executor: {
        id: run.employee.id,
        name: run.employee.name,
        role: run.employee.role,
        department: run.employee.department,
        agentId: run.employee.agentId,
      },
    };
  });

  return <WorkspaceClient activeTasks={activeTasks} />;
}
