import { orchestrator } from '@/lib/orchestrator';
import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { transitionTask } from '@/lib/state-machine';
import { AGENT_TURN_SCHEMA } from '@/a2a/schemas';
import type { AgentTurnResult, TaskState } from '@/a2a/types';
import { NextRequest, NextResponse } from 'next/server';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { DATA_ROOT as DATA_DIR } from '@/lib/paths';
import { triggerMemoryReview, readMemoryState, writeMemoryState, checkMemoryToolUsed, MEMORY_REVIEW_TURN_THRESHOLD } from '@/lib/memory-review';

// --- Strategic context types for 3-party planning ---
interface StrategicTaskContext {
  goalTitle: string;
  directionTitle: string;
}

export const maxDuration = 120;


export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const { message, agentId: chosenAgentId, assetTarget } = await request.json();
  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // --- 3-party planning: load strategic context if task has goalId ---
  let strategicContext: StrategicTaskContext | null = null;
  if (task.goalId) {
    try {
      const row = sqlite.prepare(`
        SELECT g.title as goalTitle, d.title as directionTitle
        FROM goals g
        JOIN direction_goals dg ON g.id = dg.goalId
        JOIN directions d ON d.id = dg.directionId
        WHERE g.id = ?
        LIMIT 1
      `).get(task.goalId) as { goalTitle: string; directionTitle: string } | undefined;
      if (row) {
        strategicContext = { goalTitle: row.goalTitle, directionTitle: row.directionTitle };
      }
    } catch {
      // Strategic context loading is non-blocking
    }
  }

  // If assetTarget is provided, persist it to task metadata
  if (assetTarget && assetTarget.mode) {
    const existingMeta = task.metadata ? JSON.parse(task.metadata as string) : {};
    const updatedMeta = {
      ...existingMeta,
      targetAssetMode: assetTarget.mode,
      ...(assetTarget.mode === 'specific' && assetTarget.assetId
        ? { targetAssetId: assetTarget.assetId, targetAssetTitle: assetTarget.assetTitle }
        : {}),
    };
    await prisma.task.update({
      where: { id: params.taskId },
      data: { metadata: JSON.stringify(updatedMeta) },
    });
  }

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
  // For strategic tasks (goalId set), append strategic context to prompt
  const strategicPromptBlock = strategicContext
    ? `\n## Strategic Context\nThis task serves the direction "${strategicContext.directionTitle}" under goal "${strategicContext.goalTitle}". Consider how this fits with existing work in that strategic area.\n`
    : '';

  let agentPrompt = message;
  if (chosenAgentId) {
    // First planning turn: inject full task context so agent knows what to plan
    agentPrompt = [
      `## Task to Plan\n**Title:** ${task.title}\n**Description:** ${task.description || task.title}`,
      strategicPromptBlock,
      `\n## CEO's message\n${message}`,
      `\n## Instructions\nYou are in PLANNING MODE. Do NOT execute the task. Your goal is to produce a plan the CEO can review and approve.\n\nIf you need clarification before planning, respond with turn_type "question" to ask one focused question. Otherwise, respond with turn_type "plan_ready" and the full plan in plan_markdown.`,
    ].filter(Boolean).join('\n');
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

  // --- 3-party planning: append Tamir strategic comment for tasks with goalId ---
  if (strategicContext && task.goalId) {
    const deptHeadName = orchestrator.getAgent(agentId)?.name || agentId;
    let tamirComment: string;

    if (chosenAgentId) {
      // First planning turn: Tamir introduces the strategic connection
      tamirComment = `[Tamir] This task connects to the '${strategicContext.directionTitle}' direction under goal '${strategicContext.goalTitle}'. ${deptHeadName} -- consider how this fits with existing work in that strategic area.`;
    } else if (turn.turn_type === 'plan_ready') {
      // Plan ready turn: Tamir notes the strategic advancement
      tamirComment = `[Tamir] Strategic note: completing this advances the '${strategicContext.goalTitle}' goal. I'll track progress automatically.`;
    } else {
      // Intermediate turns: skip Tamir comment to avoid noise
      tamirComment = '';
    }

    if (tamirComment) {
      appendFileSync(
        chatPath,
        JSON.stringify({
          role: 'tamir-strategic',
          agentId: 'tamir',
          content: tamirComment,
          ts: new Date().toISOString(),
        }) + '\n',
        'utf-8',
      );
    }
  }

  // Memory review: increment CEO turn counter and check threshold
  try {
    const memState = readMemoryState(chatPath);
    // This planning turn had 1 CEO turn
    memState.turnsSinceLastSave += 1;

    // Check if agent proactively used memory tool during this turn
    if (checkMemoryToolUsed(params.taskId, runId)) {
      memState.turnsSinceLastSave = 0;
      memState.lastReviewAt = new Date().toISOString();
    }

    // Trigger review if threshold reached
    if (memState.turnsSinceLastSave >= MEMORY_REVIEW_TURN_THRESHOLD) {
      triggerMemoryReview({ taskId: params.taskId, chatFilePath: chatPath });
      memState.turnsSinceLastSave = 0;
      memState.lastReviewAt = new Date().toISOString();
    }

    writeMemoryState(chatPath, memState);
  } catch (memErr) {
    // Non-blocking
    console.warn('[message] Memory counter update failed:', memErr);
  }

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
