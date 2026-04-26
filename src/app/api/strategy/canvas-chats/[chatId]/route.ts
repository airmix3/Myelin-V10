import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';
import { readFileSync, existsSync } from 'fs';

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
  directionIds: string | null;
}

/**
 * GET /api/strategy/canvas-chats/[chatId]
 * Fetch a single canvas-chat with nested decisions.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { chatId: string } },
) {
  try {
    const chat = await prisma.canvasChat.findUnique({
      where: { id: params.chatId },
    });
    if (!chat) {
      return NextResponse.json({ error: 'Canvas chat not found' }, { status: 404 });
    }

    // Load decisions with their linked direction IDs
    const decisions = sqlite.prepare(`
      SELECT dr.*, GROUP_CONCAT(dd.directionId) as directionIds
      FROM decision_records dr
      LEFT JOIN decision_directions dd ON dr.id = dd.decisionId
      WHERE dr.canvasChatId = ?
      GROUP BY dr.id
      ORDER BY dr.createdAt DESC
    `).all(params.chatId) as DecisionRow[];

    const enrichedDecisions = decisions.map((d) => ({
      ...d,
      directionIds: d.directionIds ? d.directionIds.split(',') : [],
    }));

    // Load chat messages from JSONL file
    let messages: { role: string; content: string; timestamp?: string }[] = [];
    if (chat.chatFilePath && existsSync(chat.chatFilePath)) {
      try {
        const raw = readFileSync(chat.chatFilePath, 'utf-8').trim();
        if (raw) {
          messages = raw.split('\n').filter(Boolean).map(line => {
            const entry = JSON.parse(line) as { role: string; content?: string; timestamp?: string };
            return {
              role: entry.role === 'ceo' ? 'user' : 'assistant',
              content: entry.content || '',
              timestamp: entry.timestamp,
            };
          });
        }
      } catch { /* JSONL read failure — return empty messages */ }
    }

    return NextResponse.json({ ...chat, decisions: enrichedDecisions, messages });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch canvas chat', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/strategy/canvas-chats/[chatId]
 * Update canvas-chat title or lastOpenedAt.
 * Body: { title?: string, lastOpenedAt?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { chatId: string } },
) {
  try {
    const body = await request.json();
    const { title, lastOpenedAt } = body;

    const data: Record<string, string> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) data.title = title;
    if (lastOpenedAt !== undefined) data.lastOpenedAt = lastOpenedAt;

    const updated = await prisma.canvasChat.update({
      where: { id: params.chatId },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update canvas chat', detail: String(err) },
      { status: 500 },
    );
  }
}
