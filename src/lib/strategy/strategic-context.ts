/**
 * Strategic context augmentation for Tamir's canvas-chat mode.
 * Builds the strategic soul prompt and provides active directions
 * summary for focus guardian context.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { orchestrator } from '@/lib/orchestrator';
import { sqlite } from '@/lib/db';

// ---- Types ----

interface DirectionSummaryRow {
  id: string;
  title: string;
  status: string;
  goalCount: number;
}

// ---- Functions ----

/**
 * Build the full strategic prompt for Tamir canvas-chat invocations.
 * Concatenates: base soul (with memory snapshots) + strategic-soul.md + active directions summary.
 */
export async function buildStrategicPrompt(_chatId: string): Promise<string> {
  // 1. Load Tamir's full soul (including memory snapshots) via orchestrator
  const baseSoul = await orchestrator.getSoulMd('tamir');

  // 2. Read strategic-soul.md from the agents directory
  let strategicSoul = '';
  try {
    const strategicSoulPath = join(
      process.cwd(),
      'src',
      'agents',
      'tamir',
      'strategic-soul.md',
    );
    strategicSoul = readFileSync(strategicSoulPath, 'utf-8');
  } catch {
    // If strategic soul file is missing, continue with base soul only
    strategicSoul = '';
  }

  // 3. Build active directions summary for focus guardian context
  const directionsSummary = getActiveDirectionsSummary();

  // Concatenate all parts
  const parts = [baseSoul, strategicSoul, directionsSummary].filter(
    (p) => p.trim().length > 0,
  );
  return parts.join('\n\n');
}

/**
 * Query active directions from DB and format as a brief summary
 * for Tamir's focus guardian context.
 */
export function getActiveDirectionsSummary(): string {
  try {
    const rows = sqlite
      .prepare(
        `
      SELECT d.id, d.title, d.status,
        (SELECT COUNT(*) FROM direction_goals dg WHERE dg.directionId = d.id) as goalCount
      FROM directions d
      WHERE d.status = 'active'
      ORDER BY d.createdAt DESC
    `,
      )
      .all() as DirectionSummaryRow[];

    if (rows.length === 0) {
      return '### Active Directions\nNo active directions yet.';
    }

    const lines = rows.map(
      (r, i) => `${i + 1}. ${r.title} (${r.goalCount} goal${r.goalCount !== 1 ? 's' : ''})`,
    );

    const stalledCount = 0; // Could be enhanced with progress tracking later
    return [
      `### Active Directions (${rows.length} total${stalledCount > 0 ? `, ${stalledCount} stalled` : ''})`,
      ...lines,
    ].join('\n');
  } catch {
    // Tables might not exist yet -- return empty
    return '';
  }
}
