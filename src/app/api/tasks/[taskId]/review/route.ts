import { sqlite } from '@/lib/db';
import { insertActivityLog } from '@/lib/activity-log';
import { eventBus } from '@/lib/events';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ACTIONS = ['approve', 'dismiss'] as const;
type ReviewAction = (typeof ALLOWED_ACTIONS)[number];

const REVIEWABLE_STATES = ['completed', 'canceled'];

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const { taskId } = params;

  // Parse and validate body
  let action: ReviewAction;
  try {
    const body = await request.json();
    if (!ALLOWED_ACTIONS.includes(body.action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${ALLOWED_ACTIONS.join(', ')}` },
        { status: 400 },
      );
    }
    action = body.action;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Check task exists
  const task = sqlite.prepare('SELECT id, state, metadata FROM tasks WHERE id = ?').get(taskId) as
    | { id: string; state: string; metadata: string | null }
    | undefined;

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Verify task is in a reviewable state
  if (!REVIEWABLE_STATES.includes(task.state)) {
    return NextResponse.json(
      { error: `Task is in state '${task.state}', not reviewable. Must be: ${REVIEWABLE_STATES.join(', ')}` },
      { status: 409 },
    );
  }

  // Update metadata with review flag
  const metadataField = action === 'approve' ? '$.ceoReviewed' : '$.ceoDismissed';
  sqlite
    .prepare(
      `UPDATE tasks SET metadata = json_set(COALESCE(metadata, '{}'), ?, json('true')), "updatedAt" = datetime('now') WHERE id = ?`,
    )
    .run(metadataField, taskId);

  // Log activity
  const description = action === 'approve' ? 'CEO approved task' : 'CEO dismissed task';
  await insertActivityLog({
    taskId,
    actionType: 'CEO_REVIEW',
    description,
    metadata: { action },
  });

  // Emit SSE event so the board updates in real-time
  eventBus.emit('task:reviewed', { taskId, action });

  return NextResponse.json({ success: true, action });
}
