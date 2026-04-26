import { prisma } from '@/lib/db';
import { scheduleRoutine, unscheduleRoutine } from '@/lib/routine-scheduler';
import { NextRequest, NextResponse } from 'next/server';
import cron from 'node-cron';

/**
 * PATCH /api/routines/[routineId] -- Update a routine (pause/resume, edit fields).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { routineId: string } },
) {
  try {
    const routine = await prisma.routine.findUnique({ where: { id: params.routineId } });
    if (!routine) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    }

    const body = await request.json();
    const { status, name, cronExpr, taskPlan, description } = body;

    // Validate cronExpr if provided
    if (cronExpr && !cron.validate(cronExpr)) {
      return NextResponse.json({ error: 'Invalid cron expression' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (name !== undefined) updateData.name = name;
    if (cronExpr !== undefined) updateData.cronExpr = cronExpr;
    if (taskPlan !== undefined) updateData.taskPlan = taskPlan;
    if (description !== undefined) updateData.description = description;

    const updated = await prisma.routine.update({
      where: { id: params.routineId },
      data: updateData,
    });

    // Handle scheduling changes
    if (status === 'paused') {
      unscheduleRoutine(params.routineId);
    } else if (status === 'active' || cronExpr) {
      // Re-schedule with new settings
      unscheduleRoutine(params.routineId);
      if (updated.status === 'active') {
        scheduleRoutine({ id: updated.id, name: updated.name, cronExpr: updated.cronExpr });
      }
    }

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      lastRunAt: updated.lastRunAt?.toISOString() ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update routine' }, { status: 500 });
  }
}

/**
 * DELETE /api/routines/[routineId] -- Delete a routine and stop its cron job.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { routineId: string } },
) {
  try {
    const routine = await prisma.routine.findUnique({ where: { id: params.routineId } });
    if (!routine) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    }

    unscheduleRoutine(params.routineId);
    await prisma.routine.delete({ where: { id: params.routineId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete routine' }, { status: 500 });
  }
}
