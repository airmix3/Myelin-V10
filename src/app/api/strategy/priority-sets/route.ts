import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { z } from 'zod';

interface PrioritySetRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  directionCount: number;
}

const CreatePrioritySetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
}).passthrough();

/**
 * GET /api/strategy/priority-sets
 * List all priority sets with direction count. Per D-05, these are named strategic themes.
 */
export async function GET() {
  try {
    const rows = sqlite.prepare(`
      SELECT ps.*,
        (SELECT COUNT(*) FROM direction_priority_sets dps WHERE dps.prioritySetId = ps.id) as directionCount
      FROM priority_sets ps
      ORDER BY ps.createdAt DESC
    `).all() as PrioritySetRow[];

    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to list priority sets', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/strategy/priority-sets
 * Create a new priority set (named strategic theme).
 * Body: { name: string, description?: string, color?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreatePrioritySetSchema.parse(body);

    const id = generateId('ps');
    const now = new Date().toISOString();

    const ps = await prisma.prioritySet.create({
      data: {
        id,
        name: parsed.name,
        description: parsed.description || null,
        color: parsed.color || null,
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json(ps, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create priority set', detail: String(err) },
      { status: 500 },
    );
  }
}
