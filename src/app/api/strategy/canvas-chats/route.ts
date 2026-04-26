import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DATA_ROOT } from '@/lib/paths';

/**
 * GET /api/strategy/canvas-chats
 * List all canvas-chats sorted by most recent.
 */
export async function GET() {
  try {
    const chats = await prisma.canvasChat.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(chats);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to list canvas chats', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/strategy/canvas-chats
 * Create a new canvas-chat session.
 * Body: { title: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title } = body;
    if (!title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const id = generateId('cc');
    const chatDir = join(DATA_ROOT, 'strategy', 'canvas-chats', id);
    mkdirSync(chatDir, { recursive: true });

    const chatFilePath = join(chatDir, 'chat.jsonl');
    const canvasFilePath = join(chatDir, 'canvas.json');

    // Create empty chat file
    writeFileSync(chatFilePath, '', 'utf-8');

    const chat = await prisma.canvasChat.create({
      data: {
        id,
        title: title.trim(),
        chatFilePath,
        canvasFilePath,
        lastOpenedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json(chat, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create canvas chat', detail: String(err) },
      { status: 500 },
    );
  }
}
