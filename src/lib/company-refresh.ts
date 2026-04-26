/**
 * Company Memory Refresh -- Two-tier system for keeping COMPANY.md current.
 *
 * 1. refreshCompanyMemory() -- Programmatic event-driven refresh (no LLM).
 *    Called after every task_run completion. Queries DB for deliverables, assets,
 *    knowledge and syncs entries into COMPANY.md via MemoryStore.
 *
 * 2. triggerCompanyConsolidation() -- Daily shadow Tamir agent (fire-and-forget).
 *    Uses LLM to consolidate, prune stale entries, and rewrite COMPANY.md for quality.
 */

import { resolve } from 'path';
import { logger } from '@/lib/logger';
import { sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { orchestrator } from '@/lib/orchestrator';
import { invokeAgent } from '@/lib/invoke-agent';
import {
  MemoryStore,
  TAMIR_COMPANY_PATH,
  COMPANY_CHAR_LIMIT,
} from '@/lib/memory-store';

const log = logger.child({ module: 'company-refresh' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(updatedAt: string): string {
  const now = Date.now();
  const then = new Date(updatedAt).getTime();
  const diffMs = now - then;

  if (isNaN(then)) return 'unknown';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// 1. Programmatic event-driven refresh (no LLM)
// ---------------------------------------------------------------------------

/**
 * Refresh COMPANY.md from current DB state.
 * Called after any task_run completion. Fire-and-forget safe.
 */
export async function refreshCompanyMemory(): Promise<void> {
  try {
    const store = new MemoryStore(TAMIR_COMPANY_PATH, COMPANY_CHAR_LIMIT);
    await store.loadFromDisk();

    // Query current state from DB
    const deliverables = sqlite.prepare(
      `SELECT id, title, status, creatorId, updatedAt FROM deliverables ORDER BY updatedAt DESC LIMIT 20`
    ).all() as Array<{ id: string; title: string; status: string; creatorId: string | null; updatedAt: string }>;

    const assets = sqlite.prepare(
      `SELECT id, title, healthStatus, updatedAt FROM assets ORDER BY updatedAt DESC LIMIT 15`
    ).all() as Array<{ id: string; title: string; healthStatus: string; updatedAt: string }>;

    const documents = sqlite.prepare(
      `SELECT id, title, source, updatedAt FROM documents WHERE source IN ('vault', 'knowledge') ORDER BY updatedAt DESC LIMIT 15`
    ).all() as Array<{ id: string; title: string; source: string; updatedAt: string }>;

    // Track which prefixed IDs we see from DB
    const seenPrefixes = new Set<string>();

    // Process deliverables
    for (const del of deliverables) {
      const prefix = `DEL-${del.id}:`;
      seenPrefixes.add(prefix);
      const entry = `${prefix} ${del.title} | ${del.creatorId ?? 'unassigned'} | ${del.status} | updated ${formatRelativeTime(del.updatedAt)}`;

      const existing = await store.remove(prefix).catch(() => null);
      if (existing?.success || true) {
        const result = await store.add(entry);
        if (!result.success && result.error?.includes('exceed')) {
          log.warn({ id: del.id }, 'Company memory at limit, skipping remaining adds');
          break;
        }
      }
    }

    // Process assets
    for (const asset of assets) {
      const prefix = `AST-${asset.id}:`;
      seenPrefixes.add(prefix);
      const entry = `${prefix} ${asset.title} | ${asset.healthStatus} | updated ${formatRelativeTime(asset.updatedAt)}`;

      await store.remove(prefix).catch(() => null);
      const result = await store.add(entry);
      if (!result.success && result.error?.includes('exceed')) {
        log.warn({ id: asset.id }, 'Company memory at limit during assets, skipping remaining');
        break;
      }
    }

    // Process knowledge documents
    for (const doc of documents) {
      const prefix = `DOC-${doc.id}:`;
      seenPrefixes.add(prefix);
      const entry = `${prefix} ${doc.title} | ${doc.source} | updated ${formatRelativeTime(doc.updatedAt)}`;

      await store.remove(prefix).catch(() => null);
      const result = await store.add(entry);
      if (!result.success && result.error?.includes('exceed')) {
        log.warn({ id: doc.id }, 'Company memory at limit during docs, skipping remaining');
        break;
      }
    }

    log.info(
      { deliverables: deliverables.length, assets: assets.length, documents: documents.length },
      'Company memory refreshed from DB state'
    );
  } catch (err) {
    log.warn({ err }, 'Company memory refresh failed (non-blocking)');
  }
}

// ---------------------------------------------------------------------------
// 2. Daily shadow agent consolidation (LLM)
// ---------------------------------------------------------------------------

let activeConsolidation = false;

/**
 * Trigger a daily shadow Tamir agent to consolidate COMPANY.md.
 * Fire-and-forget -- returns void, never throws to caller.
 */
export function triggerCompanyConsolidation(): void {
  if (activeConsolidation) {
    log.debug('Company consolidation already active, skipping');
    return;
  }

  _runConsolidation().catch(err => {
    log.warn({ err }, 'Company consolidation failed (non-blocking)');
  });
}

async function _runConsolidation(): Promise<void> {
  const tamirConfig = orchestrator.getAgent('tamir');
  if (!tamirConfig) {
    log.warn('Tamir agent not registered in orchestrator, skipping consolidation');
    return;
  }

  activeConsolidation = true;

  const consolidationPrompt = [
    'You are reviewing the company state and consolidating COMPANY.md.',
    '',
    '## Instructions',
    '1. Use `get_dept_status` for each department (tech, marketing, operations) to understand current state.',
    '2. Use `search_knowledge` to find recent knowledge entries.',
    '3. Review the current COMPANY.md entries by checking the company memory target.',
    '4. Rewrite COMPANY.md to reflect current reality:',
    '   - Remove completed/stale deliverables older than 7 days',
    '   - Update descriptions to be more useful',
    '   - Consolidate duplicate entries',
    '   - Ensure the most important items are captured within the 3,000 char budget',
    '5. Use the `memory` tool with target \'company\' and actions add/replace/remove to update entries.',
    '',
    'Focus on what Tamir needs to know tomorrow: active work, recent completions, health issues, important knowledge.',
  ].join('\n');

  const cosDeskDir = resolve(process.cwd(), 'data', 'departments', 'cos');
  const taskId = generateId('consolidation');
  const runId = generateId('consolidation-run');
  const tmpDelivDir = resolve(process.cwd(), 'data', 'tmp', `consolidation-${taskId}`);
  const tmpManifestPath = resolve(tmpDelivDir, 'manifest.json');

  try {
    await invokeAgent({
      taskId,
      runId,
      agentId: 'tamir',
      department: 'cos',
      prompt: consolidationPrompt,
      soulMd: tamirConfig.soulMd,
      deskDir: cosDeskDir,
      delivDir: tmpDelivDir,
      manifestPath: tmpManifestPath,
    });

    log.info('Company consolidation completed successfully');
  } finally {
    activeConsolidation = false;
  }
}
