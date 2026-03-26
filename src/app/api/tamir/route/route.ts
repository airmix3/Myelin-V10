import { orchestrator } from '@/lib/orchestrator';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { ROUTING_SCHEMA } from '@/a2a/schemas';
import type { RoutingResult } from '@/a2a/types';
import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

export const maxDuration = 120; // 2 minutes for LLM call

const DATA_DIR = resolve(process.cwd(), 'data');
const DEPT_HEAD_MAP: Record<string, string> = { tech: 'cto', marketing: 'cmo', operations: 'coo' };

export async function POST(request: NextRequest) {
  const { message } = await request.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const taskId = generateId('task');
  const contextId = generateId('ctx');
  const runId = generateId('run');

  // For planning invocations, use a temporary desk context
  // Planning turns don't need a full workspace -- use the planning desk
  // and provide dummy delivDir/manifestPath since planning doesn't produce deliverables
  const tamirDeskDir = join(DATA_DIR, 'departments', 'global', 'planning-desk');
  const tmpDelivDir = join(DATA_DIR, 'tmp', taskId);
  mkdirSync(tmpDelivDir, { recursive: true });
  const tmpManifestPath = join(tmpDelivDir, 'manifest.json');
  writeFileSync(tmpManifestPath, '{}', 'utf-8');

  // Invoke Tamir with ROUTING_SCHEMA for immediate routing (per D-04)
  const result = await orchestrator.invoke({
    taskId,
    runId,
    agentId: 'tamir',
    prompt: `The CEO wants to get something done. Route this request to the correct department.\n\nCEO's request: "${message}"`,
    deskDir: tamirDeskDir,
    delivDir: tmpDelivDir,
    manifestPath: tmpManifestPath,
    outputFormat: ROUTING_SCHEMA,
    maxBudgetUsd: 1,
  });

  const routing = result.structuredOutput as RoutingResult;
  if (!routing?.department) {
    return NextResponse.json(
      { error: 'Tamir could not route this request. Try rephrasing your task description.' },
      { status: 500 },
    );
  }

  const deptHead = DEPT_HEAD_MAP[routing.department];
  const chatFilePath = join(
    DATA_DIR, 'departments', routing.department, 'planning-desk', 'chat', `${taskId}.jsonl`,
  );

  // Create task record
  await prisma.task.create({
    data: {
      id: taskId,
      title: routing.suggested_title,
      description: message,
      department: routing.department,
      state: 'submitted',
      planningAgentId: deptHead,
      executorAgentId: deptHead,
      supervisorAgentId: deptHead,
      currentActorId: deptHead,
      contextId,
      chatFilePath,
      metadata: JSON.stringify({ routingConfidence: routing.confidence }),
    },
  });

  // Write initial JSONL entries: CEO message + Tamir routing response
  const lines = [
    JSON.stringify({ role: 'user', content: message, ts: new Date().toISOString() }),
    JSON.stringify({
      role: 'agent',
      agentId: 'tamir',
      content: routing.reasoning,
      ts: new Date().toISOString(),
      turnType: 'routing',
    }),
  ];
  mkdirSync(
    join(DATA_DIR, 'departments', routing.department, 'planning-desk', 'chat'),
    { recursive: true },
  );
  writeFileSync(chatFilePath, lines.join('\n') + '\n', 'utf-8');

  // Get agent display info for routing buttons
  const deptHeadAgent = orchestrator.getAgent(deptHead);

  return NextResponse.json({
    taskId,
    contextId,
    department: routing.department,
    tamir_response: routing.reasoning,
    suggested_title: routing.suggested_title,
    confidence: routing.confidence,
    routing_buttons: [
      { agentId: deptHead, label: `Plan with ${deptHeadAgent?.name || deptHead}` },
      { agentId: 'tamir', label: 'Plan with Tamir' },
    ],
  });
}
