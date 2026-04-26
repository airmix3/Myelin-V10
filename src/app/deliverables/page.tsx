import { prisma } from '@/lib/db';
import DeliverablesClient from './DeliverablesClient';

export default async function DeliverablesPage() {
  const deliverables = await prisma.deliverable.findMany({
    orderBy: { createdAt: 'desc' },
    include: { task: { select: { title: true, state: true } } },
  });

  // Derive display status from task state when they disagree
  function deriveStatus(delivStatus: string, taskState: string | null | undefined): string {
    if (!taskState) return delivStatus;
    // Task is active but deliverable says completed → show as in-progress
    if (taskState === 'working' || taskState === 'submitted' || taskState === 'input-required') return 'in-progress';
    // Task failed but deliverable still says in-progress → show as failed
    if (taskState === 'failed') return 'failed';
    return delivStatus;
  }

  return (
    <DeliverablesClient
      deliverables={deliverables.map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        status: deriveStatus(d.status, d.task?.state),
        department: d.department,
        creatorId: d.creatorId,
        createdAt: d.createdAt.toISOString(),
        taskTitle: d.task?.title || null,
        taskState: d.task?.state || null,
      }))}
    />
  );
}
