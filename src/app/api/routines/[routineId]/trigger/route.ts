import { executeRoutineRun } from '@/lib/routine-scheduler';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/routines/[routineId]/trigger -- Manually trigger a routine run.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { routineId: string } },
) {
  try {
    const routine = await prisma.routine.findUnique({ where: { id: params.routineId } });
    if (!routine) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    }

    const taskId = await executeRoutineRun(params.routineId);
    if (!taskId) {
      return NextResponse.json({ error: 'Routine execution skipped (paused or missing)' }, { status: 409 });
    }

    return NextResponse.json({ taskId });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to trigger routine' }, { status: 500 });
  }
}
