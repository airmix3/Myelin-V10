import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { z } from 'zod';

interface DecisionRow {
  id: string;
  canvasChatId: string;
  summary: string;
  conversationRef: string | null;
  canvasSnapshotRef: string | null;
  constraints: string | null;
  alternatives: string | null;
  challengeHighlights: string | null;
  createdAt: string;
  directionTitles: string | null;
  directionIds: string | null;
}

const CreateDecisionSchema = z.object({
  canvasChatId: z.string().min(1),
  summary: z.string().min(1),
  conversationRef: z.string().optional(),
  canvasSnapshotRef: z.string().optional(),
  constraints: z.string().optional(),
  alternatives: z.string().optional(),
  challengeHighlights: z.string().optional(),
  directionIds: z.array(z.string()).optional(),
}).passthrough();

/**
 * GET /api/strategy/decisions
 * List all decision records with linked direction titles.
 */
export async function GET() {
  try {
    const rows = sqlite.prepare(`
      SELECT dr.*,
        GROUP_CONCAT(DISTINCT d.title) as directionTitles,
        GROUP_CONCAT(DISTINCT dd.directionId) as directionIds
      FROM decision_records dr
      LEFT JOIN decision_directions dd ON dr.id = dd.decisionId
      LEFT JOIN directions d ON dd.directionId = d.id
      GROUP BY dr.id
      ORDER BY dr.createdAt DESC
    `).all() as DecisionRow[];

    const decisions = rows.map((d) => ({
      ...d,
      directionTitles: d.directionTitles ? d.directionTitles.split(',') : [],
      directionIds: d.directionIds ? d.directionIds.split(',') : [],
    }));

    return NextResponse.json(decisions);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to list decisions', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/strategy/decisions
 * Create a new decision record.
 * Body: { canvasChatId, summary, conversationRef?, canvasSnapshotRef?, constraints?, alternatives?, challengeHighlights?, directionIds? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateDecisionSchema.parse(body);

    const id = generateId('dec');
    const now = new Date().toISOString();

    const decision = await prisma.decisionRecord.create({
      data: {
        id,
        canvasChatId: parsed.canvasChatId,
        summary: parsed.summary,
        conversationRef: parsed.conversationRef || null,
        canvasSnapshotRef: parsed.canvasSnapshotRef || null,
        constraints: parsed.constraints || null,
        alternatives: parsed.alternatives || null,
        challengeHighlights: parsed.challengeHighlights || null,
        createdAt: now,
      },
    });

    // Link to directions if provided
    if (parsed.directionIds?.length) {
      const insert = sqlite.prepare(
        'INSERT OR IGNORE INTO decision_directions (decisionId, directionId) VALUES (?, ?)',
      );
      for (const dirId of parsed.directionIds) {
        insert.run(id, dirId);
      }
    }

    return NextResponse.json(
      { ...decision, directionIds: parsed.directionIds || [] },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create decision', detail: String(err) },
      { status: 500 },
    );
  }
}
