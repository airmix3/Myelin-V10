import { prisma } from '@/lib/db';
import EscalationsClient from './EscalationsClient';

export default async function EscalationsPage() {
  const escalations = await prisma.escalation.findMany({
    include: { task: { select: { title: true, department: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <EscalationsClient
      escalations={escalations.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        resolvedAt: e.resolvedAt?.toISOString() ?? null,
      }))}
    />
  );
}
