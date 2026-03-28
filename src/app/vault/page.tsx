import { prisma } from '@/lib/db';
import VaultClient from './VaultClient';

export default async function VaultPage() {
  const documents = await prisma.document.findMany({
    where: { source: { in: ['vault', 'knowledge'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      content: true,
      source: true,
      department: true,
      filedBy: true,
      createdAt: true,
    },
  });

  return (
    <VaultClient
      initialDocuments={documents.map((d) => ({
        id: d.id,
        title: d.title,
        content: d.content,
        source: d.source,
        department: d.department,
        filedBy: d.filedBy,
        createdAt: d.createdAt.toISOString(),
      }))}
    />
  );
}
