import { prisma } from '@/lib/db';
import DeliverablesClient from './DeliverablesClient';

export default async function DeliverablesPage() {
  const deliverables = await prisma.deliverable.findMany({
    orderBy: { createdAt: 'desc' },
    include: { task: { select: { title: true, state: true } } },
  });

  return (
    <DeliverablesClient
      deliverables={deliverables.map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        status: d.status,
        department: d.department,
        creatorId: d.creatorId,
        createdAt: d.createdAt.toISOString(),
        taskTitle: d.task?.title || null,
        taskState: d.task?.state || null,
      }))}
    />
  );
}
