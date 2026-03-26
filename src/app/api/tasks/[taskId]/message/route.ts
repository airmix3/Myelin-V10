import { orchestrator } from '@/lib/orchestrator';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { transitionTask } from '@/lib/state-machine';
import { AGENT_TURN_SCHEMA } from '@/a2a/schemas';
import type { AgentTurnResult, TaskState } from '@/a2a/types';
import { NextRequest, NextResponse } from 'next/server';
import { appendFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';

export const maxDuration = 120;

const DATA_DIR = resolve(process.cwd(), 'data');

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const { message, agentId: chosenAgentId } = await request.json();
  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // Determine which agent to send the message to
  // First message after routing: chosenAgentId is provided (CEO picked from routing buttons per D-05)
  // Subsequent messages: use task.currentActorId
  const agentId = chosenAgentId || task.currentActorId;
  if (!agentId) return NextResponse.json({ error: 'No agent assigned' }, { status: 400 });

  // If this is the first planning message (choosing agent), update currentActorId and transition to working
  if (chosenAgentId && task.state === 'submitted') {
    transitionTask(params.taskId, task.state as TaskState, 'working');
    await prisma.task.update({
      where: { id: params.taskId },
      data: { currentActorId: chosenAgentId, planningAgentId: chosenAgentId },
    });
  }

  // Append CEO message to JSONL
  const chatPath = task.chatFilePath
    || join(DATA_DIR, 'departments', task.department, 'planning-desk', 'chat', `${params.taskId}.jsonl`);
  mkdirSync(dirname(chatPath), { recursive: true });
  appendFileSync(
    chatPath,
    JSON.stringify({ role: 'user', content: message, ts: new Date().toISOString() }) + '\n',
    'utf-8',
  );

  // Invoke agent with AGENT_TURN_SCHEMA (per D-06)
  const runId = generateId('run');
  const planningDeskDir = join(DATA_DIR, 'departments', task.department, 'planning-desk');
  const tmpDelivDir = join(DATA_DIR, 'tmp', params.taskId);
  mkdirSync(tmpDelivDir, { recursive: true });
  const tmpManifestPath = join(tmpDelivDir, 'manifest.json');
  writeFileSync(tmpManifestPath, '{}', 'utf-8');

  const result = await orchestrator.invoke({
    taskId: params.taskId,
    runId,
    agentId,
    prompt: message,
    deskDir: planningDeskDir,
    delivDir: tmpDelivDir,
    manifestPath: tmpManifestPath,
    outputFormat: AGENT_TURN_SCHEMA,
    maxBudgetUsd: 2,
  });

  const turn = result.structuredOutput as AgentTurnResult;
  if (!turn) {
    return NextResponse.json({ error: 'Agent failed to respond.' }, { status: 500 });
  }

  // Append agent response to JSONL
  appendFileSync(
    chatPath,
    JSON.stringify({
      role: 'agent',
      agentId,
      content: turn.message,
      ts: new Date().toISOString(),
      turnType: turn.turn_type,
      ...(turn.plan_markdown ? { planMarkdown: turn.plan_markdown } : {}),
    }) + '\n',
    'utf-8',
  );

  // If plan_ready, store plan markdown on task record
  if (turn.turn_type === 'plan_ready' && turn.plan_markdown) {
    await prisma.task.update({
      where: { id: params.taskId },
      data: { planMarkdown: turn.plan_markdown },
    });
  }

  return NextResponse.json({
    state: task.state,
    agent_id: agentId,
    turn: {
      turn_type: turn.turn_type,
      message: turn.message,
      plan_markdown: turn.plan_markdown || null,
    },
  });
}
