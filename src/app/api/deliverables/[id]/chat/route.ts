import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';
import { appendFileSync, existsSync, readFileSync } from 'fs';
import { orchestrator } from '@/lib/orchestrator';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'deliverable-chat' });

export const maxDuration = 120;

/**
 * POST /api/deliverables/[id]/chat
 * Per DELIV-02: Send a message in the deliverable workspace chat.
 * Routes to the task's currentActorId (executor or supervisor depending on review state).
 * Free-form chat -- no structured output (Research Open Question 3).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: deliverableId } = params;
  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }

  // Look up deliverable and its task
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    include: { task: true },
  });
  if (!deliverable) return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });

  const task = deliverable.task;
  if (!task.currentActorId) {
    return NextResponse.json({ error: 'No active agent for this task' }, { status: 400 });
  }

  // Append user message to JSONL chat file
  const chatEntry = { role: 'user', content: message, ts: new Date().toISOString() };
  if (task.chatFilePath) {
    appendFileSync(task.chatFilePath, JSON.stringify(chatEntry) + '\n', 'utf-8');
  }

  // If task was completed, transition to working so it shows as active in org graph
  const wasCompleted = task.state === 'completed';
  if (wasCompleted) {
    await prisma.task.update({ where: { id: task.id }, data: { state: 'working' } });
  }

  // Route message to currentActorId via orchestrator (free-form, no outputFormat)
  try {
    const agent = orchestrator.getAgent(task.currentActorId);
    if (!agent) {
      if (wasCompleted) {
        await prisma.task.update({ where: { id: task.id }, data: { state: 'completed' } });
      }
      return NextResponse.json({ error: `Agent ${task.currentActorId} not found` }, { status: 404 });
    }

    // Get workspace paths and sessionId from latest task_run for conversation continuity
    const latestRun = sqlite.prepare(
      'SELECT workspaceCwd, sessionId FROM task_runs WHERE taskId = ? ORDER BY createdAt DESC LIMIT 1'
    ).get(task.id) as { workspaceCwd: string | null; sessionId: string | null } | undefined;

    // Build context-rich prompt for follow-up chat
    const chatHistory = task.chatFilePath && existsSync(task.chatFilePath)
      ? readFileSync(task.chatFilePath, 'utf-8').trim().split('\n').filter(Boolean).slice(-20).map(l => {
          try {
            const e = JSON.parse(l) as { role: string; content?: string; planMarkdown?: string; turnType?: string };
            if (e.planMarkdown) return `${e.role === 'user' ? 'CEO' : 'Agent'}: [plan attached]`;
            return `${e.role === 'user' ? 'CEO' : 'Agent'}: ${(e.content || '').substring(0, 500)}`;
          } catch { return ''; }
        }).filter(Boolean).join('\n')
      : '';

    const enrichedPrompt = [
      `## Task Context\n**Title:** ${task.title}\n**Description:** ${task.description || task.title}`,
      task.planMarkdown ? `## Approved Plan\n${task.planMarkdown.substring(0, 2000)}` : '',
      chatHistory ? `## Conversation History\n${chatHistory}` : '',
      `## CEO's Latest Message\n${message}`,
      `\n## Instructions\nYou are in FOLLOW-UP MODE. The task has been planned and executed. The CEO is asking a follow-up question about the deliverable or requesting changes. Answer based on the task context, plan, and conversation history above. Be specific and actionable.`,
    ].filter(Boolean).join('\n\n');

    const deskDir = latestRun?.workspaceCwd ?? '';
    const result = await orchestrator.invoke({
      taskId: task.id,
      runId: `chat_${Date.now()}`,
      agentId: task.currentActorId,
      prompt: enrichedPrompt,
      deskDir,
      delivDir: deliverable.workspacePath ? `${deliverable.workspacePath}/../deliverables` : '',
      manifestPath: deliverable.manifestPath ?? '',
      sessionId: latestRun?.sessionId ?? undefined,
    });

    // Store sessionId on latest task_run for conversation continuity
    if (result.sessionId) {
      sqlite.prepare(
        'UPDATE task_runs SET sessionId = ? WHERE id = (SELECT id FROM task_runs WHERE taskId = ? ORDER BY createdAt DESC LIMIT 1)'
      ).run(result.sessionId, task.id);
    }

    // Append agent response to JSONL
    const agentEntry = {
      role: 'agent',
      content: result.result ?? 'No response',
      ts: new Date().toISOString(),
      agentId: task.currentActorId,
    };
    if (task.chatFilePath) {
      appendFileSync(task.chatFilePath, JSON.stringify(agentEntry) + '\n', 'utf-8');
    }

    // Restore completed state after follow-up
    if (wasCompleted) {
      await prisma.task.update({ where: { id: task.id }, data: { state: 'completed' } });
    }

    return NextResponse.json({ success: true, response: agentEntry });
  } catch (err) {
    // Restore completed state even on error
    if (wasCompleted) {
      await prisma.task.update({ where: { id: task.id }, data: { state: 'completed' } }).catch(() => {});
    }
    log.error({ err, deliverableId, taskId: task.id }, 'Chat invocation failed');
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
