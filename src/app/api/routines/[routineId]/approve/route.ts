import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { scheduleRoutine } from '@/lib/routine-scheduler';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/routines/[routineId]/approve
 * Note: routineId param is actually the planning taskId.
 * Creates the Routine from the completed planning task's plan.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { routineId: string } },
) {
  try {
    const { routineId: taskId } = params;

    // Read the planning task
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: 'Planning task not found' }, { status: 404 });
    }

    // Parse routine metadata
    let meta: {
      routinePlanning?: boolean;
      routineName?: string;
      routineDescription?: string | null;
      routineCronExpr?: string;
      routineAgentId?: string;
      routineDepartment?: string;
    } = {};
    try {
      meta = task.metadata ? JSON.parse(task.metadata) : {};
    } catch {
      return NextResponse.json({ error: 'Invalid task metadata' }, { status: 400 });
    }

    if (!meta.routinePlanning) {
      return NextResponse.json({ error: 'Task is not a routine planning task' }, { status: 400 });
    }

    // Validate that the agent produced a plan
    if (!task.planMarkdown) {
      return NextResponse.json(
        { error: 'No plan generated yet. Continue the planning conversation until the agent produces a plan.' },
        { status: 400 },
      );
    }

    // Create the Routine record
    const routineId = generateId('routine');
    const routine = await prisma.routine.create({
      data: {
        id: routineId,
        name: meta.routineName || task.title,
        description: meta.routineDescription || null,
        cronExpr: meta.routineCronExpr!,
        agentId: meta.routineAgentId!,
        department: meta.routineDepartment!,
        taskPlan: task.planMarkdown,
      },
    });

    // Schedule the cron job
    scheduleRoutine({ id: routine.id, name: routine.name, cronExpr: routine.cronExpr });

    // Mark the planning task as completed
    await prisma.task.update({
      where: { id: taskId },
      data: { state: 'completed', completedAt: new Date() },
    });

    return NextResponse.json(
      { routineId: routine.id, name: routine.name },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json({ error: 'Failed to approve routine' }, { status: 500 });
  }
}
