/**
 * POST /api/test/create-hire-request
 * Test-only endpoint: creates a HireRequest and sets task metadata
 * to simulate what the hire_employee tool does.
 * Used by acceptance tests to set up hire approval testing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const { taskId, requestedBy, employeeName, employeeRole, justification, pendingHire } = await request.json();
  if (!taskId || !requestedBy || !employeeName || !employeeRole) {
    return NextResponse.json(
      { error: 'taskId, requestedBy, employeeName, and employeeRole required' },
      { status: 400 },
    );
  }

  // Create HireRequest
  const hireRequestId = generateId('hire');
  await prisma.hireRequest.create({
    data: {
      id: hireRequestId,
      taskId,
      requestedBy,
      employeeName,
      employeeRole,
      justification: justification || null,
      status: 'pending',
    },
  });

  // Set task metadata with pendingHire (same as hire_employee tool does)
  const task = sqlite.prepare('SELECT metadata FROM tasks WHERE id = ?').get(taskId) as { metadata: string | null } | undefined;
  const taskMeta = task?.metadata ? JSON.parse(task.metadata) : {};
  taskMeta.pendingHire = pendingHire || {
    type: 'temp',
    soulDraft: '',
    specialty: '',
    outputTypes: [],
  };
  taskMeta.inputType = 'hire_approval';
  taskMeta.hireRequestId = hireRequestId;
  sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?')
    .run(JSON.stringify(taskMeta), taskId);

  // Transition task to input-required (matching what hire_employee does)
  sqlite.prepare("UPDATE tasks SET state = 'input-required' WHERE id = ?").run(taskId);

  return NextResponse.json({ hireRequestId, taskId });
}
