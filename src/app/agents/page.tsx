import { prisma } from '@/lib/db';
import AgentsClient from './AgentsClient';

export default async function AgentsPage() {
  const employees = await prisma.employee.findMany({
    include: {
      taskRuns: {
        where: { status: 'executing' },
        take: 1,
        include: {
          task: { select: { title: true } },
        },
      },
      tasks: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        where: { state: 'working' },
        select: { title: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const serialized = employees.map((emp) => ({
    id: emp.id,
    name: emp.name,
    role: emp.role,
    department: emp.department,
    agentId: emp.agentId,
    status: emp.status,
    hasRunningTask: emp.taskRuns.length > 0,
    currentTaskTitle: emp.taskRuns[0]?.task?.title ?? emp.tasks[0]?.title ?? null,
  }));

  return <AgentsClient agents={serialized} />;
}
