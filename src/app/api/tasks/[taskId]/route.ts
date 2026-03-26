import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const task = await prisma.task.findUnique({
    where: { id: params.taskId },
    include: { deliverables: true, hireRequests: { where: { status: 'pending' } } },
  });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // Parse metadata JSON for config and derived fields
  const metadata = task.metadata ? JSON.parse(task.metadata) : {};

  return NextResponse.json({
    ...task,
    metadata,
    // Derived lifecycle: submitted -> routing -> planning -> plan_ready -> approved -> executing -> completed
    lifecycle: deriveLifecycle(task),
  });
}

function deriveLifecycle(task: {
  state: string;
  planMarkdown: string | null;
  metadata: string | null;
}): string {
  const meta = task.metadata ? JSON.parse(task.metadata) : {};
  if (task.state === 'completed') return 'completed';
  if (task.state === 'failed') return 'failed';
  if (task.state === 'canceled') return 'canceled';
  if (meta.approvedAt) return 'executing';
  if (task.planMarkdown) return 'plan_ready';
  if (task.state === 'working') return 'planning';
  if (task.state === 'input-required') return 'input_required';
  return 'submitted';
}
