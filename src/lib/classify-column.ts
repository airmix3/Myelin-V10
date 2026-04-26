/**
 * classify-column.ts -- Lightweight Tamir mini invocation to classify kanban column.
 * Uses Claude Agent SDK query() directly (no invokeAgent) to avoid activity log pollution.
 * Classifies input-required tasks as act_now or approve_decide for the Attention Center.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultSuccess, SDKResultError } from '@anthropic-ai/claude-agent-sdk';
import { sqlite } from '@/lib/db';
import { eventBus } from '@/lib/events';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'classify-column' });

export type KanbanColumn = 'act_now' | 'approve_decide';

const SYSTEM_PROMPT = `You classify CEO attention items into exactly one of two categories:

act_now — CEO must leave the Cortex to do something external: get an API key, sign up for a service, fix infrastructure, install something, configure an external dashboard.

approve_decide — CEO responds INSIDE the Cortex: approve a plan, approve a hire, answer a question, increase a budget, make a judgment call.

Respond with ONLY the classification: act_now or approve_decide`;

/**
 * Heuristic fallback for when LLM classification is unavailable or returns garbage.
 */
function heuristicColumn(type: string): KanbanColumn {
  if (type === 'external_dependency') return 'act_now';
  return 'approve_decide';
}

/**
 * Classify a task's kanban column using a lightweight Tamir mini invocation.
 * Persists the result in task metadata and emits an SSE event.
 *
 * Callers should fire-and-forget (.catch()) if they don't want to block.
 * The function itself is fast (~1-2s) and never throws -- errors fall back to heuristic.
 */
export async function classifyColumn(
  taskId: string,
  context: { type: string; summary: string; reason?: string },
): Promise<KanbanColumn> {
  try {
    const prompt = `Classify this CEO attention item:

Type: ${context.type}
Summary: ${context.summary}${context.reason ? `\nReason: ${context.reason}` : ''}

Respond with ONLY: act_now or approve_decide`;

    const q = query({
      prompt,
      options: {
        pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH ?? '/home/omersh/.npm-global/bin/claude',
        systemPrompt: SYSTEM_PROMPT,
        cwd: process.cwd(),
        tools: [],
        maxBudgetUsd: 0.02,
        permissionMode: 'acceptEdits',
        settingSources: [],
      },
    });

    let resultText = '';
    for await (const msg of q) {
      if (msg.type === 'result') {
        const res = msg as SDKResultSuccess | SDKResultError;
        if ('result' in res && typeof res.result === 'string') {
          resultText = res.result;
        }
      }
    }

    const trimmed = resultText.trim().toLowerCase();
    let column: KanbanColumn;

    if (trimmed === 'act_now' || trimmed === 'approve_decide') {
      column = trimmed;
    } else {
      log.warn({ taskId, raw: trimmed }, 'Unexpected LLM classification -- falling back to heuristic');
      column = heuristicColumn(context.type);
    }

    // Persist to task metadata
    persistColumn(taskId, column);

    return column;
  } catch (err) {
    log.error({ err, taskId }, 'Column classification failed -- using heuristic fallback');
    const column = heuristicColumn(context.type);
    persistColumn(taskId, column);
    return column;
  }
}

/**
 * Persist kanbanColumn to task metadata and emit SSE event.
 */
function persistColumn(taskId: string, column: KanbanColumn): void {
  try {
    const row = sqlite.prepare('SELECT metadata FROM tasks WHERE id = ?').get(taskId) as { metadata: string | null } | undefined;
    const existing = row?.metadata ? JSON.parse(row.metadata) : {};
    const updated = { ...existing, kanbanColumn: column };
    sqlite.prepare('UPDATE tasks SET metadata = ? WHERE id = ?').run(JSON.stringify(updated), taskId);

    // Emit SSE event so the UI can update in real-time
    eventBus.emit('task:column-classified', { taskId, kanbanColumn: column });

    log.info({ taskId, column }, 'Kanban column classified and persisted');
  } catch (err) {
    log.error({ err, taskId, column }, 'Failed to persist kanban column');
  }
}
