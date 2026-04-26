import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      linkedTaskId: true,
    },
  });

  return NextResponse.json({ conversations });
}

/**
 * PATCH /api/tamir/conversations — Link a conversation to a task
 */
export async function PATCH(request: NextRequest) {
  const { conversationId, linkedTaskId } = await request.json();
  if (!conversationId || !linkedTaskId) {
    return NextResponse.json({ error: 'conversationId and linkedTaskId required' }, { status: 400 });
  }

  try {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { linkedTaskId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }
}
