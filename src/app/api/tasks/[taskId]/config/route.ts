import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const config = await request.json();
  // config shape: { autonomyLevel, maxBudgetUsd, constraints, selectedTools, selectedSkills, toolHints }

  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const existingMeta = task.metadata ? JSON.parse(task.metadata) : {};
  const updatedMeta = { ...existingMeta, config };

  await prisma.task.update({
    where: { id: params.taskId },
    data: { metadata: JSON.stringify(updatedMeta) },
  });

  return NextResponse.json({ success: true });
}
