import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';

interface SeedRow {
  id: string;
  goalId: string;
  title: string;
  description: string | null;
  suggestedDepartment: string | null;
  roughScope: string | null;
  dependencies: string | null;
  strategicContext: string | null;
  status: string;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssetRow {
  id: string;
  title: string;
  category: string;
}

interface TaskRow {
  id: string;
  title: string;
  state: string;
  department: string;
}

/**
 * GET /api/strategy/directions/[directionId]/goals/[goalId]
 * Fetch a goal with seeds, linked assets, and linked tasks.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { directionId: string; goalId: string } },
) {
  try {
    const goal = await prisma.goal.findUnique({
      where: { id: params.goalId },
    });
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Seeds
    const seeds = await prisma.taskSeed.findMany({
      where: { goalId: params.goalId },
      orderBy: { createdAt: 'asc' },
    });

    // Linked assets via goal_assets junction
    const assets = sqlite.prepare(`
      SELECT a.id, a.title, a.category
      FROM assets a
      INNER JOIN goal_assets ga ON a.id = ga.assetId
      WHERE ga.goalId = ?
    `).all(params.goalId) as AssetRow[];

    // Tasks linked to this goal
    const tasks = sqlite.prepare(`
      SELECT id, title, state, department
      FROM tasks WHERE goalId = ?
      ORDER BY createdAt DESC
    `).all(params.goalId) as TaskRow[];

    return NextResponse.json({ ...goal, seeds, assets, tasks });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch goal', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/strategy/directions/[directionId]/goals/[goalId]
 * Update goal fields.
 * Body: { title?, definitionOfDone?, status? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { directionId: string; goalId: string } },
) {
  try {
    const body = await request.json();
    const { title, definitionOfDone, status } = body;

    const data: Record<string, string> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) data.title = title;
    if (definitionOfDone !== undefined) data.definitionOfDone = definitionOfDone;
    if (status !== undefined) data.status = status;

    const updated = await prisma.goal.update({
      where: { id: params.goalId },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update goal', detail: String(err) },
      { status: 500 },
    );
  }
}
