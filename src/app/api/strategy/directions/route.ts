import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { z } from 'zod';

interface DirectionRow {
  id: string;
  title: string;
  rationale: string | null;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  prioritySetIds: string | null;
  goalCount: number;
}

const CreateDirectionSchema = z.object({
  title: z.string().min(1),
  rationale: z.string().optional(),
  priority: z.enum(['focus', 'active', 'background']).optional(),
  prioritySetIds: z.array(z.string()).optional(),
}).passthrough();

/**
 * GET /api/strategy/directions
 * List all directions with priority set IDs and goal counts.
 */
export async function GET() {
  try {
    const rows = sqlite.prepare(`
      SELECT d.*, GROUP_CONCAT(DISTINCT dps.prioritySetId) as prioritySetIds,
        (SELECT COUNT(*) FROM direction_goals dg WHERE dg.directionId = d.id) as goalCount
      FROM directions d
      LEFT JOIN direction_priority_sets dps ON d.id = dps.directionId
      GROUP BY d.id ORDER BY d.updatedAt DESC
    `).all() as DirectionRow[];

    const directions = rows.map((d) => ({
      ...d,
      prioritySetIds: d.prioritySetIds ? d.prioritySetIds.split(',') : [],
    }));

    return NextResponse.json(directions);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to list directions', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/strategy/directions
 * Create a new strategic direction.
 * Body: { title: string, rationale?: string, prioritySetIds?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateDirectionSchema.parse(body);

    const id = generateId('dir');
    const now = new Date().toISOString();

    const direction = await prisma.direction.create({
      data: {
        id,
        title: parsed.title,
        rationale: parsed.rationale || null,
        status: 'active',
        priority: parsed.priority || 'active',
        createdAt: now,
        updatedAt: now,
      },
    });

    // Link to priority sets if provided
    if (parsed.prioritySetIds?.length) {
      const insert = sqlite.prepare(
        'INSERT OR IGNORE INTO direction_priority_sets (directionId, prioritySetId) VALUES (?, ?)',
      );
      for (const psId of parsed.prioritySetIds) {
        insert.run(id, psId);
      }
    }

    return NextResponse.json({ ...direction, prioritySetIds: parsed.prioritySetIds || [] }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create direction', detail: String(err) },
      { status: 500 },
    );
  }
}
