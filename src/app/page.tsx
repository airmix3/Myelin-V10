import { prisma } from '@/lib/db';
import DashboardClient from './DashboardClient';

function isUsefulActivityLogEntry(entry: { actionType: string; description: string | null }): boolean {
  if (entry.actionType !== 'SDK_ASSISTANT') return true;
  const description = entry.description?.trim();
  return Boolean(description && description !== 'Assistant message');
}

export default async function Dashboard() {
  const [activeAgents, activeTasks, pendingApprovals, deliverableCount, agents, activities, inProgressDeliverables] = await Promise.all([
    prisma.employee.count({ where: { status: 'active' } }),
    prisma.task.count({ where: { state: { in: ['submitted', 'working', 'input-required'] } } }),
    prisma.hireRequest.count({ where: { status: 'pending' } }),
    prisma.deliverable.count(),
    prisma.employee.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, agentId: true, department: true },
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, taskId: true, agentId: true, actionType: true, description: true, createdAt: true },
    }),
    prisma.deliverable.findMany({
      where: { status: 'in-progress' },
      select: { id: true, title: true, department: true, taskId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);
  const filteredActivities = activities.filter(isUsefulActivityLogEntry);

  return (
    <DashboardClient
      stats={{ activeAgents, activeTasks, pendingApprovals, deliverableCount }}
      agents={agents}
      initialActivities={filteredActivities.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      }))}
      inProgressDeliverables={inProgressDeliverables.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
      }))}
    />
  );
}
