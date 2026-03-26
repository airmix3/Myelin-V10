import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const task = await prisma.task.findUnique({
    where: { id: params.taskId },
    select: { chatFilePath: true },
  });
  if (!task?.chatFilePath) return NextResponse.json({ messages: [] });

  if (!existsSync(task.chatFilePath)) return NextResponse.json({ messages: [] });

  const raw = readFileSync(task.chatFilePath, 'utf-8').trim();
  if (!raw) return NextResponse.json({ messages: [] });

  const messages = raw
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return NextResponse.json({ messages });
}
