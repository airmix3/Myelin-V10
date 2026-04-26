import { prisma } from '@/lib/db';
import { transitionTask } from '@/lib/state-machine';
import { cancelTaskRuns } from '@/lib/worker';
import type { TaskState } from '@/a2a/types';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const result = transitionTask(params.taskId, task.state as TaskState, 'canceled');
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Per doc 17: cascade cancellation to all task_runs (queued, executing, paused)
  const canceledRuns = cancelTaskRuns(params.taskId);

  return NextResponse.json({ success: true, canceledRuns });
}
