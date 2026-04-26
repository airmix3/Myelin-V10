import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';

interface GoalRow {
  id: string;
  title: string;
  definitionOfDone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  seedCount: number;
  completedSeedCount: number;
}

interface DecisionRow {
  id: string;
  summary: string;
  createdAt: string;
  canvasChatId: string;
}

interface PrioritySetRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
}

/**
 * GET /api/strategy/directions/[directionId]
 * Fetch a direction with goals (including seed progress), decisions, and priority sets.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { directionId: string } },
) {
  try {
    const direction = await prisma.direction.findUnique({
      where: { id: params.directionId },
    });
    if (!direction) {
      return NextResponse.json({ error: 'Direction not found' }, { status: 404 });
    }

    // Goals with seed counts for progress
    const goals = sqlite.prepare(`
      SELECT g.*,
        (SELECT COUNT(*) FROM task_seeds ts WHERE ts.goalId = g.id) as seedCount,
        (SELECT COUNT(*) FROM task_seeds ts WHERE ts.goalId = g.id AND ts.status = 'activated') as completedSeedCount
      FROM goals g
      INNER JOIN direction_goals dg ON g.id = dg.goalId
      WHERE dg.directionId = ?
      ORDER BY g.createdAt ASC
    `).all(params.directionId) as GoalRow[];

    // Linked decisions
    const decisions = sqlite.prepare(`
      SELECT dr.id, dr.summary, dr.createdAt, dr.canvasChatId
      FROM decision_records dr
      INNER JOIN decision_directions dd ON dr.id = dd.decisionId
      WHERE dd.directionId = ?
      ORDER BY dr.createdAt DESC
    `).all(params.directionId) as DecisionRow[];

    // Linked priority sets
    const prioritySets = sqlite.prepare(`
      SELECT ps.*
      FROM priority_sets ps
      INNER JOIN direction_priority_sets dps ON ps.id = dps.prioritySetId
      WHERE dps.directionId = ?
    `).all(params.directionId) as PrioritySetRow[];

    return NextResponse.json({
      ...direction,
      goals,
      decisions,
      prioritySets,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch direction', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/strategy/directions/[directionId]
 * Update direction fields and/or priority set links.
 * Body: { title?, rationale?, status?, prioritySetIds? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { directionId: string } },
) {
  try {
    const body = await request.json();
    const { title, rationale, status, priority, prioritySetIds } = body;

    const data: Record<string, string> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) data.title = title;
    if (rationale !== undefined) data.rationale = rationale;
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;

    const updated = await prisma.direction.update({
      where: { id: params.directionId },
      data,
    });

    // Replace priority set links if provided
    if (prioritySetIds !== undefined) {
      sqlite.prepare('DELETE FROM direction_priority_sets WHERE directionId = ?').run(params.directionId);
      if (prioritySetIds.length) {
        const insert = sqlite.prepare(
          'INSERT OR IGNORE INTO direction_priority_sets (directionId, prioritySetId) VALUES (?, ?)',
        );
        for (const psId of prioritySetIds) {
          insert.run(params.directionId, psId);
        }
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update direction', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/strategy/directions/[directionId]
 * Delete a direction and all junction table entries.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { directionId: string } },
) {
  try {
    // Delete junction entries first
    sqlite.prepare('DELETE FROM direction_goals WHERE directionId = ?').run(params.directionId);
    sqlite.prepare('DELETE FROM direction_priority_sets WHERE directionId = ?').run(params.directionId);
    sqlite.prepare('DELETE FROM decision_directions WHERE directionId = ?').run(params.directionId);

    await prisma.direction.delete({ where: { id: params.directionId } });

    return new Response(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete direction', detail: String(err) },
      { status: 500 },
    );
  }
}
