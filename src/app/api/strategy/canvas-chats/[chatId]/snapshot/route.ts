import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

/**
 * POST /api/strategy/canvas-chats/[chatId]/snapshot
 * Save canvas document state (Excalidraw JSON).
 * Body: { document: object }
 * Writes to the canvas file path and a timestamped snapshot.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } },
) {
  try {
    const body = await request.json();
    const { document } = body;
    if (!document) {
      return NextResponse.json({ error: 'document is required' }, { status: 400 });
    }

    const chat = await prisma.canvasChat.findUnique({
      where: { id: params.chatId },
    });
    if (!chat) {
      return NextResponse.json({ error: 'Canvas chat not found' }, { status: 404 });
    }

    const canvasFilePath = chat.canvasFilePath;
    if (!canvasFilePath) {
      return NextResponse.json({ error: 'No canvas file path configured' }, { status: 500 });
    }

    const jsonStr = JSON.stringify(document, null, 2);

    // Write current canvas state
    mkdirSync(dirname(canvasFilePath), { recursive: true });
    writeFileSync(canvasFilePath, jsonStr, 'utf-8');

    // Write timestamped snapshot
    const snapshotDir = join(dirname(canvasFilePath), 'snapshots');
    mkdirSync(snapshotDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(snapshotDir, `${timestamp}.json`), jsonStr, 'utf-8');

    // Update canvas-chat timestamp
    await prisma.canvasChat.update({
      where: { id: params.chatId },
      data: { updatedAt: new Date().toISOString() },
    });

    return NextResponse.json({ saved: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to save snapshot', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * GET /api/strategy/canvas-chats/[chatId]/snapshot
 * Load the current canvas document state.
 * Returns { document: object | null }
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

    const canvasFilePath = chat.canvasFilePath;
    if (!canvasFilePath || !existsSync(canvasFilePath)) {
      return NextResponse.json({ document: null });
    }

    const content = readFileSync(canvasFilePath, 'utf-8');
    const document = JSON.parse(content);
    return NextResponse.json({ document });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load snapshot', detail: String(err) },
      { status: 500 },
    );
  }
}
