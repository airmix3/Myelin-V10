import { orchestrator } from '@/lib/orchestrator';
import { warmSessions } from '@/lib/warm-session';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { buildDynamicConsultationSchema } from '@/a2a/schemas';
import type { ConsultationTurnResult } from '@/a2a/types';
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DATA_ROOT as DATA_DIR } from '@/lib/paths';
import { triggerMemoryReview, readMemoryState, writeMemoryState, checkMemoryToolUsed, MEMORY_REVIEW_TURN_THRESHOLD } from '@/lib/memory-review';

export const maxDuration = 120;

import { getDepartmentHead } from '@/lib/departments';

/**
 * GET /api/tamir/consult/[conversationId] -- Load conversation history
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { conversationId: string } },
) {
  const { conversationId } = params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Read JSONL file and parse messages
  let messages: unknown[] = [];
  try {
    const raw = readFileSync(conversation.chatFilePath, 'utf-8');
    messages = raw
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch {
    // File may not exist yet or be empty
  }

  return NextResponse.json({ messages, title: conversation.title, linkedTaskId: conversation.linkedTaskId });
}

/**
 * POST /api/tamir/consult/[conversationId] -- Follow-up consultation turn
 *
 * Warm path: pushes into existing warm SDK session (no subprocess spawn).
 * Cold path: falls back to orchestrator.invoke() if warm session expired.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } },
) {
  const { conversationId } = params;
  const { message } = await request.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  let consultation: ConsultationTurnResult;
  let runId: string;

  const warmSession = warmSessions.getSession(conversationId);

  if (warmSession) {
    // ----- WARM PATH: Push into existing session -----
    runId = warmSession.runId;
    try {
      consultation = await warmSessions.pushMessage(conversationId, message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[tamir/consult] warm session push failed:', msg);
      return NextResponse.json({ error: `Tamir consultation failed: ${msg}` }, { status: 500 });
    }
  } else {
    // ----- COLD PATH: No warm session, fall back to orchestrator.invoke() -----
    runId = generateId('run');

    // Read existing conversation history for prompt context
    let historyLines: string[] = [];
    try {
      const raw = readFileSync(conversation.chatFilePath, 'utf-8');
      historyLines = raw.split('\n').filter((line) => line.trim());
    } catch {
      // Empty conversation
    }

    // Format conversation history for prompt
    const historyEntries = historyLines.map((line) => {
      try {
        const entry = JSON.parse(line);
        if (entry.role === 'user') return `CEO: "${entry.content}"`;
        if (entry.role === 'agent') return `Tamir: "${entry.content}"`;
        return '';
      } catch {
        return '';
      }
    }).filter(Boolean);

    const conversationContext = historyEntries.join('\n');
    const prompt = `You are Tamir, Chief of Staff. You are in a consultation conversation with the CEO. Respond naturally and thoughtfully.

Classification rules:
- Default to "chat". Most turns are consultation.
- Only classify as "task_detected" when the CEO explicitly delegates work — look for phrases like "let's have X do", "assign", "get the CTO to", "I want [agent] to build/create/fix". Discussing a topic, asking for advice, or mentioning problems is NOT a task. The CEO must signal intent to hand off work to an agent.

Previous conversation:
${conversationContext}

CEO: "${message}"`;

    // Use cos desk for Tamir
    const tamirDeskDir = join(DATA_DIR, 'departments', 'cos');
    mkdirSync(tamirDeskDir, { recursive: true });
    const tmpDelivDir = join(DATA_DIR, 'tmp', conversationId);
    mkdirSync(tmpDelivDir, { recursive: true });
    const tmpManifestPath = join(tmpDelivDir, 'manifest.json');

    let result;
    try {
      result = await orchestrator.invoke({
        taskId: conversationId,
        runId,
        agentId: 'tamir',
        prompt,
        deskDir: tamirDeskDir,
        delivDir: tmpDelivDir,
        manifestPath: tmpManifestPath,
        outputFormat: await buildDynamicConsultationSchema(),
        maxBudgetUsd: 1,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[tamir/consult] orchestrator.invoke failed:', msg);
      return NextResponse.json({ error: `Tamir consultation failed: ${msg}` }, { status: 500 });
    }

    consultation = result.structuredOutput as ConsultationTurnResult;
  }

  if (!consultation?.response) {
    console.error('[tamir/consult] No structured output.');
    return NextResponse.json({ error: 'Tamir could not respond.' }, { status: 500 });
  }

  // Append CEO message + Tamir response to JSONL
  const newLines = [
    JSON.stringify({ role: 'user', content: message, ts: new Date().toISOString() }),
    JSON.stringify({
      role: 'agent',
      agentId: 'tamir',
      content: consultation.response,
      ts: new Date().toISOString(),
      turnType: consultation.classification,
    }),
  ];
  appendFileSync(conversation.chatFilePath, newLines.join('\n') + '\n', 'utf-8');

  // Update conversation updatedAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Memory review: increment counter
  try {
    const memState = readMemoryState(conversation.chatFilePath);
    memState.turnsSinceLastSave += 1;

    if (checkMemoryToolUsed(conversationId, runId)) {
      memState.turnsSinceLastSave = 0;
      memState.lastReviewAt = new Date().toISOString();
    }

    if (memState.turnsSinceLastSave >= MEMORY_REVIEW_TURN_THRESHOLD) {
      triggerMemoryReview({ taskId: conversationId, chatFilePath: conversation.chatFilePath });
      memState.turnsSinceLastSave = 0;
      memState.lastReviewAt = new Date().toISOString();
    }

    writeMemoryState(conversation.chatFilePath, memState);
  } catch (memErr) {
    console.warn('[tamir/consult] Memory counter update failed:', memErr);
  }

  // Build response
  const response: Record<string, unknown> = {
    response: consultation.response,
    classification: consultation.classification,
  };

  if (consultation.classification === 'task_detected' && consultation.detected_task) {
    const deptHead = await getDepartmentHead(consultation.detected_task.department);
    response.detected_task = consultation.detected_task;
    response.routing_buttons = [
      { agentId: deptHead || 'tamir', label: `Plan: ${consultation.detected_task.title}` },
      { agentId: 'tamir', label: 'Plan with Tamir' },
      { agentId: '__cancel__', label: 'Cancel' },
    ];
  }

  return NextResponse.json(response);
}
