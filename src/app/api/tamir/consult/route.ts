import { orchestrator } from '@/lib/orchestrator';
import { warmSessions } from '@/lib/warm-session';
import { tamirStandby } from '@/lib/tamir-standby';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { buildDynamicConsultationSchema } from '@/a2a/schemas';
import type { ConsultationTurnResult } from '@/a2a/types';
import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DATA_ROOT as DATA_DIR } from '@/lib/paths';
import { triggerMemoryReview, readMemoryState, writeMemoryState, checkMemoryToolUsed, MEMORY_REVIEW_TURN_THRESHOLD } from '@/lib/memory-review';

export const maxDuration = 120;

import { getDepartmentHead } from '@/lib/departments';

export async function POST(request: NextRequest) {
  const { message } = await request.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const conversationId = generateId('conv');

  // Use cos desk for Tamir consultation
  const tamirDeskDir = join(DATA_DIR, 'departments', 'cos');
  const chatDir = join(tamirDeskDir, 'chat');
  mkdirSync(chatDir, { recursive: true });
  const chatFilePath = join(chatDir, `${conversationId}.jsonl`);

  const tmpDelivDir = join(DATA_DIR, 'tmp', conversationId);
  mkdirSync(tmpDelivDir, { recursive: true });
  const tmpManifestPath = join(tmpDelivDir, 'manifest.json');
  writeFileSync(tmpManifestPath, '{}', 'utf-8');

  // Load Tamir's soulMd (with memory snapshots) for the warm session
  const consultPrompt = 'You are Tamir, Chief of Staff. The CEO is consulting with you. Respond naturally and thoughtfully.\n\nClassification rules:\n- Default to "chat". Most turns are consultation.\n- Only classify as "task_detected" when the CEO explicitly delegates work \u2014 look for phrases like "let\'s have X do", "assign", "get the CTO to", "I want [agent] to build/create/fix". Discussing a topic, asking for advice, or mentioning problems is NOT a task. The CEO must signal intent to hand off work to an agent.';

  let consultation: ConsultationTurnResult;
  try {
    const soulMd = await orchestrator.getSoulMd('tamir');
    const agent = orchestrator.getAgent('tamir');
    if (!agent) throw new Error('Tamir agent not registered');

    const standby = tamirStandby.acquire('consult');
    if (standby) {
      // Use pre-warmed session -- adopt into warm session manager
      consultation = await warmSessions.adoptStandby(conversationId, {
        queue: standby.queue,
        query: standby.query,
        runId: standby.runId,
        sessionIdPromise: standby.sessionIdPromise,
        initialPrompt: consultPrompt,
        initialMessage: message,
      });
    } else {
      // Cold fallback -- existing path
      consultation = await warmSessions.createSession(conversationId, {
        agentId: 'tamir',
        department: agent.department,
        soulMd,
        deskDir: tamirDeskDir,
        delivDir: tmpDelivDir,
        manifestPath: tmpManifestPath,
        outputFormat: await buildDynamicConsultationSchema(),
        maxBudgetUsd: 1,
        initialPrompt: consultPrompt,
        initialMessage: message,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[tamir/consult] warm session create failed:', msg);
    return NextResponse.json({ error: `Tamir consultation failed: ${msg}` }, { status: 500 });
  }

  if (!consultation?.response) {
    console.error('[tamir/consult] No structured output returned.');
    return NextResponse.json(
      { error: 'Tamir could not respond. Try rephrasing.' },
      { status: 500 },
    );
  }

  // Write initial JSONL entries
  const lines = [
    JSON.stringify({ role: 'user', content: message, ts: new Date().toISOString() }),
    JSON.stringify({
      role: 'agent',
      agentId: 'tamir',
      content: consultation.response,
      ts: new Date().toISOString(),
      turnType: consultation.classification,
    }),
  ];
  writeFileSync(chatFilePath, lines.join('\n') + '\n', 'utf-8');

  // Auto-generate title from first sentence of Tamir's response, truncated to 60 chars
  const firstSentence = consultation.response.split(/[.!?]/)[0]?.trim() || 'New conversation';
  const title = firstSentence.length > 60 ? firstSentence.slice(0, 57) + '...' : firstSentence;

  // Create conversation DB record
  await prisma.conversation.create({
    data: {
      id: conversationId,
      title,
      chatFilePath,
    },
  });

  // Memory review: increment CEO turn counter
  try {
    const memState = readMemoryState(chatFilePath);
    memState.turnsSinceLastSave += 1;

    // Use conversationId as both taskId and a placeholder runId for memory check
    const session = warmSessions.getSession(conversationId);
    const runId = session?.runId ?? conversationId;

    if (checkMemoryToolUsed(conversationId, runId)) {
      memState.turnsSinceLastSave = 0;
      memState.lastReviewAt = new Date().toISOString();
    }

    if (memState.turnsSinceLastSave >= MEMORY_REVIEW_TURN_THRESHOLD) {
      triggerMemoryReview({ taskId: conversationId, chatFilePath });
      memState.turnsSinceLastSave = 0;
      memState.lastReviewAt = new Date().toISOString();
    }

    writeMemoryState(chatFilePath, memState);
  } catch (memErr) {
    console.warn('[tamir/consult] Memory counter update failed:', memErr);
  }

  // Build response
  const response: Record<string, unknown> = {
    conversationId,
    response: consultation.response,
    classification: consultation.classification,
    title,
  };

  // If task detected, include routing info for inline buttons
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
