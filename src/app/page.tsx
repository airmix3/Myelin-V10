import { prisma } from '@/lib/db';
import DashboardClient from './DashboardClient';

export default async function Dashboard() {
  const [activeAgents, activeTasks, pendingApprovals, deliverableCount, agents, activities] = await Promise.all([
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
  ]);

  return (
    <DashboardClient
      stats={{ activeAgents, activeTasks, pendingApprovals, deliverableCount }}
      agents={agents}
      initialActivities={activities.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      }))}
    />
  );
}
