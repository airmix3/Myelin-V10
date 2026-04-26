/**
 * POST /api/test/seed-task
 * Test-only endpoint: creates a task record without LLM invocation.
 * Used by acceptance tests to set up test data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const { title, department, description } = await request.json();
  if (!title || !department) {
    return NextResponse.json({ error: 'title and department required' }, { status: 400 });
  }

  const taskId = generateId('task');

  await prisma.task.create({
    data: {
      id: taskId,
      title,
      description: description || null,
      department,
      state: 'submitted',
    },
  });

  return NextResponse.json({ taskId, title, department });
}
