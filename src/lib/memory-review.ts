/**
 * Memory Review — Background agent that consolidates Tamir's learning after sessions.
 *
 * After Tamir completes a session with 3+ CEO turns, a background review agent
 * reads the conversation transcript and extracts CEO preferences, company conventions,
 * and important context into persistent memory via the bounded memory MCP tool.
 *
 * Fire-and-forget: never blocks the CEO response.
 * No recursive reviews: if the current run is itself a review, skip.
 */

import { readFileSync, writeFileSync } from 'fs';
import { logger } from '@/lib/logger';
import { dataPath } from '@/lib/paths';
import { generateId } from '@/lib/id';
import { orchestrator } from '@/lib/orchestrator';
import { invokeAgent } from '@/lib/invoke-agent';
import { sqlite } from '@/lib/db';

const log = logger.child({ module: 'memory-review' });

// Track active review taskIds to prevent any concurrent duplicate reviews
const activeReviews = new Set<string>();

// ---------------------------------------------------------------------------
// Sidecar state management (persists turn counter across per-request model)
// ---------------------------------------------------------------------------

/** CEO turn counter threshold — trigger memory review every N CEO turns. Override via MEMORY_REVIEW_TURN_THRESHOLD env var for testing. */
export const MEMORY_REVIEW_TURN_THRESHOLD = parseInt(process.env.MEMORY_REVIEW_TURN_THRESHOLD || '10', 10);

export interface MemoryState {
  turnsSinceLastSave: number;
  lastReviewAt: string | null;  // ISO timestamp
}

/** Compute the sidecar path from a chat JSONL path. */
export function sidecarPath(chatFilePath: string): string {
  if (chatFilePath.endsWith('.jsonl')) {
    return chatFilePath.replace(/\.jsonl$/, '.memory-state.json');
  }
  return chatFilePath + '.memory-state.json';
}

/**
 * Read memory state from the sidecar file next to the chat JSONL.
 * Returns default state if file doesn't exist or is invalid.
 */
export function readMemoryState(chatFilePath: string): MemoryState {
  try {
    const raw = readFileSync(sidecarPath(chatFilePath), 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      turnsSinceLastSave: typeof parsed.turnsSinceLastSave === 'number' ? parsed.turnsSinceLastSave : 0,
      lastReviewAt: typeof parsed.lastReviewAt === 'string' ? parsed.lastReviewAt : null,
    };
  } catch {
    return { turnsSinceLastSave: 0, lastReviewAt: null };
  }
}

/**
 * Write memory state to the sidecar file. Non-throwing.
 */
export function writeMemoryState(chatFilePath: string, state: MemoryState): void {
  try {
    writeFileSync(sidecarPath(chatFilePath), JSON.stringify(state), 'utf-8');
  } catch (err) {
    log.warn({ err, chatFilePath }, 'Failed to write memory state sidecar');
  }
}

/**
 * Check if an agent used the memory MCP tool during a specific run.
 * Queries activity_log for SDK_TOOL_CALL entries matching the cortex memory tool.
 */
export function checkMemoryToolUsed(taskId: string, runId: string): boolean {
  try {
    const row = sqlite.prepare(
      "SELECT COUNT(*) as cnt FROM activity_log WHERE taskId = ? AND metadata LIKE '%mcp__cortex__memory%' AND metadata LIKE ?"
    ).get(taskId, `%${runId}%`) as { cnt: number } | undefined;
    return (row?.cnt ?? 0) > 0;
  } catch (err) {
    log.debug({ err, taskId, runId }, 'Memory tool usage check failed (non-blocking)');
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MemoryReviewOptions {
  taskId: string;
  chatFilePath: string;    // Path to JSONL chat history
  minCeoTurns?: number;    // Default 1 (counter already ensures sufficient turns)
  isReviewRun?: boolean;   // Prevent recursive reviews per D-21
}

/**
 * Trigger a background memory review after a Tamir session.
 * Fire-and-forget (D-21) -- returns void, never throws to caller.
 */
export function triggerMemoryReview(opts: MemoryReviewOptions): void {
  // D-21: No recursive reviews
  if (opts.isReviewRun) return;

  // Prevent duplicate concurrent reviews for the same task
  if (activeReviews.has(opts.taskId)) {
    log.debug({ taskId: opts.taskId }, 'Review already active for task, skipping');
    return;
  }

  // Fire-and-forget (D-21) -- don't await
  _runReview(opts).catch(err => {
    log.warn({ err, taskId: opts.taskId }, 'Memory review failed (non-blocking)');
  });
}

// ---------------------------------------------------------------------------
// Private implementation
// ---------------------------------------------------------------------------

interface ChatEntry {
  role: string;
  content?: string;
  ts?: string;
  agentId?: string;
  turnType?: string;
  planMarkdown?: string;
}

async function _runReview(opts: MemoryReviewOptions): Promise<void> {
  const { taskId, chatFilePath, minCeoTurns = 1 } = opts;

  // 1. Read chat JSONL
  let raw: string;
  try {
    raw = readFileSync(chatFilePath, 'utf-8');
  } catch (err) {
    log.debug({ err, taskId, chatFilePath }, 'Chat file not readable, skipping review');
    return;
  }

  // 2. Parse lines into entries
  const entries: ChatEntry[] = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line) as ChatEntry; }
      catch { return null; }
    })
    .filter((e): e is ChatEntry => e !== null);

  if (entries.length === 0) {
    log.debug({ taskId }, 'No chat entries found, skipping review');
    return;
  }

  // 3. Count CEO turns (role === 'user')
  const ceoTurns = entries.filter(e => e.role === 'user').length;

  // 4. Check threshold
  if (ceoTurns < minCeoTurns) {
    log.debug({ taskId, ceoTurns, minCeoTurns }, 'Below CEO turn threshold, skipping review');
    return;
  }

  // 5. Format transcript
  const transcript = entries.map(e => {
    const label = e.role === 'user' ? 'CEO'
      : e.role === 'agent' ? (e.agentId === 'tamir' ? 'Tamir' : e.agentId ?? 'Agent')
      : 'System';
    const text = e.planMarkdown
      ? '[plan attached]'
      : (e.content || '').substring(0, 2000);
    return `[${label}]: ${text}`;
  }).join('\n');

  // 6. Build review prompt (adapted from Hermes _MEMORY_REVIEW_PROMPT for CoS)
  //    Includes dedup-aware instructions to prevent redundant memory entries.
  const reviewPrompt = [
    'You are reviewing a conversation between Tamir (Chief of Staff) and the CEO.',
    '',
    'Your job: Extract CEO preferences, company conventions, and important context that Tamir should remember for future sessions.',
    '',
    '## Conversation Transcript',
    transcript,
    '',
    '## Deduplication Rules (CRITICAL)',
    '',
    'Before adding ANY entry, you MUST check existing memory for semantic overlap:',
    '',
    '1. **Read first**: Your system prompt contains a frozen snapshot of current USER.md and MEMORY.md entries. Review them carefully.',
    '',
    '2. **Merge, don\'t duplicate**: If you find an existing entry that covers similar ground, use `replace` (not `add`) to merge the new insight with the existing one.',
    '   - Example: Existing "CEO prefers concise responses" + new learning "Omer likes brief answers" = use `replace` to update the existing entry, don\'t `add` a near-duplicate.',
    '   - Example: Existing "CTO prefers detailed code plans" + new "CTO wants step-by-step execution plans" = `replace` to consolidate.',
    '',
    '3. **Contradiction handling**: If new information contradicts an existing entry, use `replace` to update with the corrected version. The most recent conversation is ground truth.',
    '',
    '4. **Capacity awareness**: If memory is above 70% capacity (visible in the memory tool status), consolidate related entries before adding new ones. Use `replace` to merge 2-3 related entries into one comprehensive entry, then `add` only if truly new.',
    '',
    '5. **Skip threshold**: If the conversation contains no genuinely new insights beyond what\'s already in memory, do nothing. Most conversations don\'t warrant memory updates.',
    '',
    '## Instructions',
    'Review the transcript and update Tamir\'s persistent memory:',
    '',
    '1. **USER.md** -- CEO preferences, communication style, pet peeves, decision patterns',
    '   - Only add/update if you learned something NEW about the CEO',
    '   - Examples: preferred response length, topics they care about, decision-making style',
    '',
    '2. **MEMORY.md** -- Company conventions, active priorities, routing patterns, tool quirks, lessons learned',
    '   - Only add if this is reusable knowledge (not task-specific ephemera)',
    '   - Examples: "CTO prefers detailed code plans", "Marketing tasks always need brand guidelines first"',
    '',
    'Use the `memory` tool with appropriate target (memory/user) and action (add/replace/remove).',
    'If there is nothing worth remembering from this conversation, do nothing.',
    'Do NOT save task-specific details or conversation transcripts.',
  ].join('\n');

  // 7. Get Tamir config from orchestrator
  const tamirConfig = orchestrator.getAgent('tamir');
  if (!tamirConfig) {
    log.warn({ taskId }, 'Tamir agent not registered in orchestrator, skipping review');
    return;
  }

  // 8. Set up review-specific context
  const reviewRunId = generateId('review');
  const cosDeskDir = dataPath('departments', 'cos');
  const tmpDelivDir = dataPath('tmp', `review-${taskId}`);
  const tmpManifestPath = dataPath('tmp', `review-${taskId}`, 'manifest.json');

  // Mark as active to prevent duplicate concurrent reviews
  activeReviews.add(taskId);

  try {
    // 9. Invoke agent with memory-only capabilities
    await invokeAgent({
      taskId,
      runId: reviewRunId,
      agentId: 'tamir',
      department: 'cos',
      prompt: reviewPrompt,
      soulMd: tamirConfig.soulMd,
      deskDir: cosDeskDir,
      delivDir: tmpDelivDir,
      manifestPath: tmpManifestPath,
      maxBudgetUsd: 0.50,  // D-19: budget cap for review runs
      // maxTurns not supported by SDK directly; rely on maxBudgetUsd as effective limit
    });

    log.info({ taskId, ceoTurns }, 'Memory review completed successfully');
  } finally {
    activeReviews.delete(taskId);
  }
}
