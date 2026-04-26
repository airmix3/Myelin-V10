import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, readdirSync, statSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import * as lockfile from 'proper-lockfile';
import { orchestrator } from '@/lib/orchestrator';
import { generateId } from '@/lib/id';
import { DATA_ROOT } from '@/lib/paths';
import { buildStrategicPrompt } from '@/lib/strategy/strategic-context';

export const maxDuration = 120;

/**
 * POST /api/strategy/canvas-chats/[chatId]/message
 * Send a message in the strategic canvas-chat.
 * Invokes Tamir with strategic soul prompt. Tamir responds with
 * conversational text only (no structured output or canvas actions).
 *
 * Body: { message: string }
 * Returns: { response: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } },
) {
  try {
    const body = await request.json();
    const { message } = body;
    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // 1. Load canvas-chat from DB, verify it exists
    const chat = await prisma.canvasChat.findUnique({
      where: { id: params.chatId },
    });
    if (!chat) {
      return NextResponse.json({ error: 'Canvas chat not found' }, { status: 404 });
    }

    const chatFilePath = chat.chatFilePath;
    if (!chatFilePath) {
      return NextResponse.json({ error: 'No chat file path configured' }, { status: 500 });
    }

    // Ensure directory exists
    mkdirSync(dirname(chatFilePath), { recursive: true });
    if (!existsSync(chatFilePath)) {
      appendFileSync(chatFilePath, '', 'utf-8');
    }

    // 2. Read chat history from JSONL file (last 20 messages for context window)
    let chatHistory = '';
    try {
      const raw = readFileSync(chatFilePath, 'utf-8').trim();
      if (raw) {
        const lines = raw.split('\n').filter(Boolean).slice(-20);
        chatHistory = lines
          .map((line) => {
            try {
              const entry = JSON.parse(line) as { role: string; content?: string };
              const speaker = entry.role === 'ceo' ? 'CEO' : 'Tamir';
              return `${speaker}: ${(entry.content || '').substring(0, 500)}`;
            } catch {
              return '';
            }
          })
          .filter(Boolean)
          .join('\n');
      }
    } catch {
      // No history yet -- fine
    }

    // 3. Build strategic prompt via buildStrategicPrompt
    const strategicPrompt = await buildStrategicPrompt(params.chatId);

    // 4. Append CEO message to JSONL file with lockfile protection
    const ceoEntry = JSON.stringify({
      role: 'ceo',
      content: message.trim(),
      timestamp: new Date().toISOString(),
    });

    let release: (() => Promise<void>) | undefined;
    try {
      release = await lockfile.lock(chatFilePath, { retries: 3, realpath: false });
      appendFileSync(chatFilePath, ceoEntry + '\n', 'utf-8');
    } finally {
      if (release) await release();
    }

    // 5. Invoke Tamir via the orchestrator (no structured output -- plain text response)
    const runId = generateId('run');
    const deskDir = join(DATA_ROOT, 'strategy', 'canvas-chats', params.chatId, 'desk');
    const skillsDir = join(deskDir, '.claude', 'skills');
    mkdirSync(skillsDir, { recursive: true });

    // Write settings.json at desk/.claude/ to anchor project boundary (same pattern as task workspaces)
    const settingsPath = join(deskDir, '.claude', 'settings.json');
    if (!existsSync(settingsPath)) {
      writeFileSync(settingsPath, JSON.stringify({
        permissions: {
          allow: ['Bash(*)', 'Read(*)', 'Write(*)', 'Edit(*)', 'mcp__cortex__*'],
          deny: [],
        },
      }, null, 2), 'utf-8');
    }

    // Symlink cos + global department skills into desk/.claude/skills/ for SDK auto-discovery
    const skillSources = [
      join(DATA_ROOT, 'departments', 'cos', 'skills'),
      join(DATA_ROOT, 'departments', 'global', 'skills'),
    ];
    for (const source of skillSources) {
      if (!existsSync(source)) continue;
      try {
        const entries = readdirSync(source, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const target = join(skillsDir, entry.name);
          if (existsSync(target)) continue; // cos skill takes precedence over global
          try { symlinkSync(join(source, entry.name), target, 'junction'); }
          catch { /* already exists or race */ }
        }
      } catch { /* source dir unreadable — non-blocking */ }
    }
    const tmpDelivDir = join(DATA_ROOT, 'tmp', `canvas-${params.chatId}`);
    mkdirSync(tmpDelivDir, { recursive: true });
    const tmpManifestPath = join(tmpDelivDir, 'manifest.json');
    if (!existsSync(tmpManifestPath)) {
      appendFileSync(tmpManifestPath, '{}', 'utf-8');
    }

    // Copy current canvas state to desk so Tamir can see and build on CEO's edits
    let hasCanvas = false;
    const canvasFilePath = chat.canvasFilePath;
    if (canvasFilePath && existsSync(canvasFilePath)) {
      try {
        const canvasContent = readFileSync(canvasFilePath, 'utf-8');
        const parsed = JSON.parse(canvasContent);
        if (parsed.elements && parsed.elements.length > 0) {
          copyFileSync(canvasFilePath, join(deskDir, 'current-canvas.excalidraw'));
          hasCanvas = true;
        }
      } catch { /* no valid canvas — fine */ }
    }

    // Build the prompt with conversation context
    const canvasNote = hasCanvas
      ? '## Current Canvas\nThe file `current-canvas.excalidraw` in your working directory contains the current canvas state. Read it to see what the CEO has drawn or what exists from previous turns. When generating or updating the canvas, build on this existing state rather than starting from scratch.\n'
      : '';

    const agentPrompt = [
      canvasNote,
      chatHistory ? `## Conversation History\n${chatHistory}` : '',
      `## CEO's Message\n${message.trim()}`,
      '\n## Instructions\nRespond to the CEO in strategic mode. Provide thoughtful strategic insight and challenge as appropriate.',
    ]
      .filter(Boolean)
      .join('\n\n');

    // Use a synthetic taskId for canvas-chat invocations
    const syntheticTaskId = `canvas-${params.chatId}`;

    let result;
    try {
      result = await orchestrator.invoke({
        taskId: syntheticTaskId,
        runId,
        agentId: 'tamir',
        prompt: agentPrompt,
        deskDir,
        delivDir: tmpDelivDir,
        manifestPath: tmpManifestPath,
        maxBudgetUsd: 2.0,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Strategic invocation failed: ${errMsg}` },
        { status: 500 },
      );
    }

    // 6. Extract response text (plain text, no structured output parsing)
    let responseText = '';

    if (result.structuredOutput) {
      // Defensive: if structured output exists, extract response field
      const output = result.structuredOutput as Record<string, unknown>;
      responseText = String(output.response ?? '');
    } else if (result.result) {
      responseText = result.result;
    }

    if (!responseText) {
      responseText = 'I received your message but could not generate a response. Please try again.';
    }

    // 6.5 Auto-push generated .excalidraw files to canvas snapshot
    try {
      const deskFiles = readdirSync(deskDir).filter(f => f.endsWith('.excalidraw') && f !== 'current-canvas.excalidraw');
      if (deskFiles.length > 0) {
        // Find newest by modification time
        const newest = deskFiles
          .map(f => ({ name: f, mtime: statSync(join(deskDir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime)[0];
        const excalidrawData = JSON.parse(readFileSync(join(deskDir, newest.name), 'utf-8'));
        const canvasFilePath = chat.canvasFilePath;
        if (canvasFilePath) {
          const jsonStr = JSON.stringify(excalidrawData, null, 2);
          mkdirSync(dirname(canvasFilePath), { recursive: true });
          writeFileSync(canvasFilePath, jsonStr, 'utf-8');
          // Timestamped snapshot
          const snapshotDir = join(dirname(canvasFilePath), 'snapshots');
          mkdirSync(snapshotDir, { recursive: true });
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          writeFileSync(join(snapshotDir, `${ts}.json`), jsonStr, 'utf-8');
        }
      }
    } catch { /* non-blocking — canvas still works without auto-push */ }

    // 7. Append Tamir response to JSONL
    const tamirEntry = JSON.stringify({
      role: 'tamir',
      agentId: 'tamir',
      content: responseText,
      timestamp: new Date().toISOString(),
    });

    let release2: (() => Promise<void>) | undefined;
    try {
      release2 = await lockfile.lock(chatFilePath, { retries: 3, realpath: false });
      appendFileSync(chatFilePath, tamirEntry + '\n', 'utf-8');
    } finally {
      if (release2) await release2();
    }

    // 8. Update canvas-chat updatedAt
    const now = new Date().toISOString();
    await prisma.canvasChat.update({
      where: { id: params.chatId },
      data: { lastOpenedAt: now, updatedAt: now },
    });

    return NextResponse.json({
      response: responseText,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to send message', detail: String(err) },
      { status: 500 },
    );
  }
}
