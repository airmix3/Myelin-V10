import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { isOnboardingActive } from '@/lib/onboarding/detection';
import DashboardClient from './DashboardClient';

export default async function Dashboard() {
  // Server-side onboarding check — catches stale cookies
  if (isOnboardingActive()) {
    redirect('/onboarding');
  }
  // Fetch active tasks for kanban columns
  const tasks = await prisma.task.findMany({
    where: { state: { in: ['working', 'input-required', 'completed', 'failed'] } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Fetch recently canceled tasks for review column (last 24h)
  const recentCanceled = await prisma.task.findMany({
    where: {
      state: 'canceled',
      updatedAt: { gte: new Date(Date.now() - 86400000) },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter out tasks that CEO has already reviewed or dismissed
  const isNotReviewed = (t: { metadata: string | null }) => {
    if (!t.metadata) return true;
    try {
      const m = JSON.parse(t.metadata);
      return !m.ceoReviewed && !m.ceoDismissed;
    } catch { return true; }
  };

  const filteredTasks = tasks.filter(isNotReviewed);
  const filteredCanceled = recentCanceled.filter(isNotReviewed);

  // Serialize Date fields to ISO strings for client component
  const serializeTask = (t: typeof tasks[number]) => ({
    id: t.id,
    title: t.title,
    state: t.state,
    department: t.department,
    metadata: t.metadata,
    createdAt: t.createdAt.toISOString(),
    planMarkdown: t.planMarkdown,
    description: t.description,
    creatorId: t.createdById,
  });

  const serializedTasks = filteredTasks.map(serializeTask);
  const serializedCanceled = filteredCanceled.map(serializeTask);

  return (
    <DashboardClient initialTasks={[...serializedTasks, ...serializedCanceled]} />
  );
}
