import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { getNextRun } from '@/lib/routine-scheduler';
import { NextRequest, NextResponse } from 'next/server';
import cron from 'node-cron';

/**
 * GET /api/routines -- List all routines with computed nextRun.
 */
export async function GET() {
  try {
    const routines = await prisma.routine.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const enriched = routines.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      lastRunAt: r.lastRunAt?.toISOString() ?? null,
      nextRun: r.status === 'active' ? getNextRun(r.cronExpr) : null,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch routines' }, { status: 500 });
  }
}

/**
 * POST /api/routines -- Create a planning Task for routine creation.
 * The agent will generate the routine plan through multi-turn conversation.
 * On approval, the routine is created from the plan via /api/routines/[routineId]/approve.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, cronExpr, agentId, department } = body;

    if (!name || !cronExpr || !agentId || !department) {
      return NextResponse.json(
        { error: 'Missing required fields: name, cronExpr, agentId, department' },
        { status: 400 },
      );
    }

    if (!cron.validate(cronExpr)) {
      return NextResponse.json({ error: 'Invalid cron expression' }, { status: 400 });
    }

    // Create a planning Task (not a Routine) -- the agent will generate the plan
    const taskId = generateId('task');
    await prisma.task.create({
      data: {
        id: taskId,
        title: `[Routine Planning] ${name}`,
        description: `Planning routine: ${name}. ${description || ''}. Schedule: ${cronExpr}`,
        department,
        state: 'submitted',
        metadata: JSON.stringify({
          routinePlanning: true,
          routineName: name,
          routineDescription: description || null,
          routineCronExpr: cronExpr,
          routineAgentId: agentId,
          routineDepartment: department,
        }),
      },
    });

    return NextResponse.json(
      { taskId, routineMeta: { name, cronExpr, agentId, department } },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create routine planning task' }, { status: 500 });
  }
}
