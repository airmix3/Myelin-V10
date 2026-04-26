import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { z } from 'zod';

interface GoalRow {
  id: string;
  title: string;
  definitionOfDone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface SeedRow {
  id: string;
  goalId: string;
  title: string;
  description: string | null;
  suggestedDepartment: string | null;
  roughScope: string | null;
  status: string;
  taskId: string | null;
}

interface AssetRow {
  id: string;
  title: string;
  category: string;
}

const CreateGoalSchema = z.object({
  title: z.string().min(1),
  definitionOfDone: z.string().optional(),
  status: z.string().optional(),
}).passthrough();

/**
 * GET /api/strategy/directions/[directionId]/goals
 * List goals linked to this direction, with seeds and assets.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { directionId: string } },
) {
  try {
    // Goals linked to this direction
    const goals = sqlite.prepare(`
      SELECT g.* FROM goals g
      INNER JOIN direction_goals dg ON g.id = dg.goalId
      WHERE dg.directionId = ?
      ORDER BY g.createdAt ASC
    `).all(params.directionId) as GoalRow[];

    // Enrich each goal with seeds and linked assets
    const enriched = goals.map((goal) => {
      const seeds = sqlite.prepare(`
        SELECT id, goalId, title, description, suggestedDepartment, roughScope, status, taskId
        FROM task_seeds WHERE goalId = ?
        ORDER BY createdAt ASC
      `).all(goal.id) as SeedRow[];

      const assets = sqlite.prepare(`
        SELECT a.id, a.title, a.category
        FROM assets a
        INNER JOIN goal_assets ga ON a.id = ga.assetId
        WHERE ga.goalId = ?
      `).all(goal.id) as AssetRow[];

      return { ...goal, seeds, assets };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to list goals', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/strategy/directions/[directionId]/goals
 * Create a goal and link it to this direction.
 * Body: { title: string, definitionOfDone?: string, status?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { directionId: string } },
) {
  try {
    const body = await request.json();
    const parsed = CreateGoalSchema.parse(body);

    const id = generateId('goal');
    const now = new Date().toISOString();

    const goal = await prisma.goal.create({
      data: {
        id,
        title: parsed.title,
        definitionOfDone: parsed.definitionOfDone || null,
        status: parsed.status || 'planned',
        createdAt: now,
        updatedAt: now,
      },
    });

    // Link to direction via junction
    sqlite.prepare(
      'INSERT OR IGNORE INTO direction_goals (directionId, goalId) VALUES (?, ?)',
    ).run(params.directionId, id);

    return NextResponse.json(goal, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create goal', detail: String(err) },
      { status: 500 },
    );
  }
}
