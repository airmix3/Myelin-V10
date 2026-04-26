import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const { plan_markdown } = await request.json();

  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  await prisma.task.update({
    where: { id: params.taskId },
    data: { planMarkdown: plan_markdown },
  });

  return NextResponse.json({ success: true });
}
