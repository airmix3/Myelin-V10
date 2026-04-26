import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { z } from 'zod';

interface TaskRow {
  id: string;
  title: string;
  state: string;
}

const CreateSeedSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  suggestedDepartment: z.string().optional(),
  roughScope: z.string().optional(),
  dependencies: z.string().optional(),
  strategicContext: z.string().optional(),
}).passthrough();

/**
 * GET /api/strategy/directions/[directionId]/goals/[goalId]/seeds
 * List seeds for a goal. For activated seeds, include linked task info.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { directionId: string; goalId: string } },
) {
  try {
    const seeds = await prisma.taskSeed.findMany({
      where: { goalId: params.goalId },
      orderBy: { createdAt: 'asc' },
    });

    // For activated seeds with taskId, fetch task title and status
    const enriched = seeds.map((seed) => {
      if (seed.taskId) {
        const task = sqlite.prepare(
          'SELECT id, title, state FROM tasks WHERE id = ?',
        ).get(seed.taskId) as TaskRow | undefined;
        return { ...seed, task: task || null };
      }
      return { ...seed, task: null };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to list seeds', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/strategy/directions/[directionId]/goals/[goalId]/seeds
 * Create a new task seed under a goal.
 * Body: { title, description?, suggestedDepartment?, roughScope?, dependencies?, strategicContext? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { directionId: string; goalId: string } },
) {
  try {
    const body = await request.json();
    const parsed = CreateSeedSchema.parse(body);

    const id = generateId('seed');
    const now = new Date().toISOString();

    const seed = await prisma.taskSeed.create({
      data: {
        id,
        goalId: params.goalId,
        title: parsed.title,
        description: parsed.description || null,
        suggestedDepartment: parsed.suggestedDepartment || null,
        roughScope: parsed.roughScope || null,
        dependencies: parsed.dependencies || null,
        strategicContext: parsed.strategicContext || null,
        status: 'planned',
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json(seed, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create seed', detail: String(err) },
      { status: 500 },
    );
  }
}
