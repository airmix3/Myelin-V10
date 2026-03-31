import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      state: true,
      department: true,
      updatedAt: true,
      currentActorId: true,
      metadata: true,
    },
  });

  // Filter out steward operation tasks
  const chats = tasks
    .filter((t) => {
      if (!t.metadata) return true;
      try {
        const meta = JSON.parse(t.metadata);
        return !meta.stewardOperation;
      } catch {
        return true;
      }
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      state: t.state,
      department: t.department,
      updatedAt: t.updatedAt,
      agentId: t.currentActorId,
    }));

  return NextResponse.json({ chats });
}
