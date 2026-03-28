import { prisma } from '@/lib/db';
import EscalationsClient from './EscalationsClient';

export default async function EscalationsPage() {
  const [pending, resolved] = await Promise.all([
    prisma.escalation.findMany({
      where: { status: 'pending' },
      include: { task: { select: { title: true, department: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.escalation.findMany({
      where: { status: { in: ['responded', 'dismissed'] } },
      include: { task: { select: { title: true, department: true } } },
      orderBy: { resolvedAt: 'desc' },
      take: 10,
    }),
  ]);

  return (
    <EscalationsClient
      pendingEscalations={pending.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        resolvedAt: e.resolvedAt?.toISOString() ?? null,
      }))}
      resolvedEscalations={resolved.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        resolvedAt: e.resolvedAt?.toISOString() ?? null,
      }))}
    />
  );
}
