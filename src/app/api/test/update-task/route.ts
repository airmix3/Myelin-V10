/**
 * POST /api/test/update-task
 * Test-only endpoint: updates task fields without LLM invocation.
 * Used by acceptance tests to set up task state for downstream testing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sqlite } from '@/lib/db';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const { taskId, planMarkdown, state, planningAgentId, executorAgentId, metadata } = await request.json();
  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  }

  // Build dynamic SET clause
  const sets: string[] = [];
  const params: unknown[] = [];

  if (planMarkdown !== undefined) { sets.push('planMarkdown = ?'); params.push(planMarkdown); }
  if (state !== undefined) { sets.push('state = ?'); params.push(state); }
  if (planningAgentId !== undefined) { sets.push('planningAgentId = ?'); params.push(planningAgentId); }
  if (executorAgentId !== undefined) { sets.push('executorAgentId = ?'); params.push(executorAgentId); }
  if (metadata !== undefined) { sets.push('metadata = ?'); params.push(typeof metadata === 'string' ? metadata : JSON.stringify(metadata)); }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  sets.push("updatedAt = datetime('now')");
  params.push(taskId);

  const result = sqlite.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  if (result.changes === 0) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, taskId });
}
