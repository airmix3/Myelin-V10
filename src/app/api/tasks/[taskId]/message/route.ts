import { orchestrator } from '@/lib/orchestrator';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { transitionTask } from '@/lib/state-machine';
import { AGENT_TURN_SCHEMA } from '@/a2a/schemas';
import type { AgentTurnResult, TaskState } from '@/a2a/types';
import { NextRequest, NextResponse } from 'next/server';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
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

  // If task was completed, transition to working so it shows as active in org graph during follow-up
  const wasCompleted = task.state === 'completed';
  if (wasCompleted) {
    await prisma.task.update({ where: { id: params.taskId }, data: { state: 'working' } });
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
  // Tamir lives flat in cos/ -- no planning-desk subdirectory
  const planningDeskDir = agentId === 'tamir'
    ? join(DATA_DIR, 'departments', 'cos')
    : join(DATA_DIR, 'departments', task.department, 'planning-desk');
  mkdirSync(join(planningDeskDir, 'chat'), { recursive: true });
  const tmpDelivDir = join(DATA_DIR, 'tmp', params.taskId);
  mkdirSync(tmpDelivDir, { recursive: true });
  const tmpManifestPath = join(tmpDelivDir, 'manifest.json');
  writeFileSync(tmpManifestPath, '{}', 'utf-8');

  // Parse task metadata for session continuity
  const taskMetadata = task.metadata ? JSON.parse(task.metadata as string) : {};
  const planningSessionId = taskMetadata.planningSessionId as string | undefined;

  // Build context-rich prompt for planning turns
  // Include task title + description + chat history so the agent knows what it's planning
  let agentPrompt = message;
  if (chosenAgentId) {
    // First planning turn: inject full task context so agent knows what to plan
    agentPrompt = [
      `## Task to Plan\n**Title:** ${task.title}\n**Description:** ${task.description || task.title}`,
      `\n## CEO's message\n${message}`,
      `\n## Instructions\nYou are in PLANNING MODE. Do NOT execute the task. Produce a plan the CEO can review and approve. Respond with turn_type "plan_ready" and the full plan in plan_markdown once you have enough information.`,
    ].join('\n');
  } else if (planningSessionId) {
    // Resuming existing session — agent already has full context, just send the new message
    agentPrompt = [
      `## CEO Message\n${message}`,
      `\nThis is a continuation of our planning conversation. The CEO's message above is the current request — treat it as ground truth. Continue planning accordingly.`,
    ].join('\n');
  } else {
    // No session to resume — include minimal context for a fresh follow-up
    const chatHistory = existsSync(chatPath)
      ? readFileSync(chatPath, 'utf-8').trim().split('\n').filter(Boolean).slice(-10).map(l => {
          try {
            const e = JSON.parse(l) as { role: string; content?: string; planMarkdown?: string };
            const text = e.planMarkdown ? `[plan_ready — plan attached]` : (e.content || '').substring(0, 400);
            return `${e.role === 'user' ? 'CEO' : 'You'}: ${text}`;
          } catch { return ''; }
        }).filter(Boolean).join('\n')
      : '';
    agentPrompt = [
      chatHistory ? `## Conversation so far\n${chatHistory}` : '',
      `## CEO's latest message\n${message}`,
      `\n## Instructions\nYou are in PLANNING MODE. Continue the planning conversation. Respond with turn_type "question" to ask another clarifying question, or "plan_ready" with a full plan_markdown if you have enough information to proceed.`,
    ].filter(Boolean).join('\n\n');
  }

  let result;
  try {
    result = await orchestrator.invoke({
      taskId: params.taskId,
      runId,
      agentId,
      prompt: agentPrompt,
      deskDir: planningDeskDir,
      delivDir: tmpDelivDir,
      manifestPath: tmpManifestPath,
      outputFormat: AGENT_TURN_SCHEMA,
      maxBudgetUsd: 2,
      sessionId: planningSessionId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Agent invocation failed: ${msg}` }, { status: 500 });
  }

  // Store sessionId for conversation continuity on next planning turn
  if (result.sessionId) {
    const updatedMeta = { ...taskMetadata, planningSessionId: result.sessionId };
    await prisma.task.update({
      where: { id: params.taskId },
      data: { metadata: JSON.stringify(updatedMeta) },
    });
  }

  // Prefer structured_output; fall back to parsing result.result as JSON
  let turn = result.structuredOutput as AgentTurnResult | undefined;
  if (!turn && result.result) {
    try {
      const parsed = JSON.parse(result.result.trim());
      if (parsed.turn_type && parsed.message) turn = parsed as AgentTurnResult;
    } catch { /* not JSON */ }
  }
  if (!turn) {
    // Last resort: wrap plain text response as a question turn
    if (result.result?.trim()) {
      turn = { turn_type: 'question', message: result.result.trim() };
    } else {
      return NextResponse.json({ error: 'Agent failed to respond.' }, { status: 500 });
    }
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

  // Restore completed state after follow-up finishes
  if (wasCompleted) {
    await prisma.task.update({ where: { id: params.taskId }, data: { state: 'completed' } });
  }

  return NextResponse.json({
    state: wasCompleted ? 'completed' : task.state,
    agent_id: agentId,
    turn: {
      turn_type: turn.turn_type,
      message: turn.message,
      plan_markdown: turn.plan_markdown || null,
    },
  });
}
