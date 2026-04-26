import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';

interface DirectionRow {
  id: string;
  title: string;
  status: string;
  rationale: string | null;
}

/**
 * GET /api/strategy/priority-sets/[setId]
 * Fetch a priority set with its linked directions.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { setId: string } },
) {
  try {
    const ps = await prisma.prioritySet.findUnique({
      where: { id: params.setId },
    });
    if (!ps) {
      return NextResponse.json({ error: 'Priority set not found' }, { status: 404 });
    }

    // Linked directions
    const directions = sqlite.prepare(`
      SELECT d.id, d.title, d.status, d.rationale
      FROM directions d
      INNER JOIN direction_priority_sets dps ON d.id = dps.directionId
      WHERE dps.prioritySetId = ?
      ORDER BY d.updatedAt DESC
    `).all(params.setId) as DirectionRow[];

    return NextResponse.json({ ...ps, directions });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch priority set', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/strategy/priority-sets/[setId]
 * Update a priority set.
 * Body: { name?, description?, color? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { setId: string } },
) {
  try {
    const body = await request.json();
    const { name, description, color } = body;

    const data: Record<string, string | null> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (color !== undefined) data.color = color;

    const updated = await prisma.prioritySet.update({
      where: { id: params.setId },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update priority set', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/strategy/priority-sets/[setId]
 * Delete a priority set and its junction entries.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { setId: string } },
) {
  try {
    // Remove junction entries first
    sqlite.prepare('DELETE FROM direction_priority_sets WHERE prioritySetId = ?').run(params.setId);

    await prisma.prioritySet.delete({ where: { id: params.setId } });

    return new Response(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete priority set', detail: String(err) },
      { status: 500 },
    );
  }
}
