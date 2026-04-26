import { NextResponse } from 'next/server';
import { sqlite } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rmSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const log = logger.child({ module: 'system-reset' });

const DATA_DIR = join(process.cwd(), 'data');

function cleanDirectory(dir: string, pattern?: RegExp): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir)) {
    if (!pattern || pattern.test(entry)) {
      rmSync(join(dir, entry), { recursive: true, force: true });
      count++;
    }
  }
  return count;
}

function resetManifests(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'deliverable_manifest.json') {
        writeFileSync(full, '{}');
        count++;
      }
    }
  };
  walk(dir);
  return count;
}

export async function POST() {
  try {
    // === DATABASE CLEANUP (FK-safe order) ===
    // 1. escalations (references tasks)
    const escalationsDeleted = sqlite.prepare('DELETE FROM escalations').run().changes;
    // 2. task_runs (references tasks, employees)
    const taskRunsDeleted = sqlite.prepare('DELETE FROM task_runs').run().changes;
    // 3. cost_events (references tasks)
    const costEventsDeleted = sqlite.prepare('DELETE FROM cost_events').run().changes;
    // 4. activity_log (references tasks loosely)
    const activityLogDeleted = sqlite.prepare('DELETE FROM activity_log').run().changes;
    // 5. hire_requests (references tasks)
    const hireRequestsDeleted = sqlite.prepare('DELETE FROM hire_requests').run().changes;
    // 6. deliverables (references tasks)
    const deliverablesDeleted = sqlite.prepare('DELETE FROM deliverables').run().changes;
    // 7. tasks
    const tasksDeleted = sqlite.prepare('DELETE FROM tasks').run().changes;
    // 8. conversations
    const conversationsDeleted = sqlite.prepare('DELETE FROM conversations').run().changes;
    // 9. assets (FK-safe order: events/locations/deps first, then assets)
    const assetEventsDeleted = sqlite.prepare('DELETE FROM asset_events').run().changes;
    const assetLocationsDeleted = sqlite.prepare('DELETE FROM asset_locations').run().changes;
    const assetDepsDeleted = sqlite.prepare('DELETE FROM asset_dependencies').run().changes;
    const assetsDeleted = sqlite.prepare('DELETE FROM assets').run().changes;
    // 10. non-vault documents (preserve vault + company-dna)
    const docsDeleted = sqlite.prepare("DELETE FROM documents WHERE source != 'vault'").run().changes;
    // 10. reset employee budgets (preserve permanent employees)
    sqlite.prepare("UPDATE employees SET budgetSpent = 0.0 WHERE role = 'executive'").run();
    // 11. terminate temp employees
    const tempsTerminated = sqlite.prepare("UPDATE employees SET status = 'terminated' WHERE role = 'temp'").run().changes;

    // === FILE CLEANUP ===
    const departments = ['cos', 'tech', 'marketing', 'operations', 'global'];
    let chatFilesDeleted = 0;
    for (const dept of departments) {
      // Chat JSONL + memory-state files
      chatFilesDeleted += cleanDirectory(join(DATA_DIR, 'departments', dept, 'chat'), /\.(jsonl|json)$/);
      // Planning desk chat files
      chatFilesDeleted += cleanDirectory(join(DATA_DIR, 'departments', dept, 'planning-desk', 'chat'), /\.(jsonl|json)$/);
    }

    // Workspaces
    const workspacesDeleted = cleanDirectory(join(DATA_DIR, 'workspaces'));
    // Tmp session manifests
    const tmpDeleted = cleanDirectory(join(DATA_DIR, 'tmp'));
    // Agent inbox
    cleanDirectory(join(DATA_DIR, 'agents', 'tamir'), /\.jsonl$/);
    // Asset directories
    const assetDirsDeleted = cleanDirectory(join(DATA_DIR, 'assets'), /^asset_/);
    // Reset all deliverable manifests to {}
    const manifestsReset = resetManifests(DATA_DIR);

    const summary = {
      escalationsDeleted,
      taskRunsDeleted,
      costEventsDeleted,
      activityLogDeleted,
      hireRequestsDeleted,
      deliverablesDeleted,
      tasksDeleted,
      conversationsDeleted,
      docsDeleted,
      tempsTerminated,
      assetsDeleted,
      assetEventsDeleted,
      assetDirsDeleted,
      chatFilesDeleted,
      workspacesDeleted,
      tmpDeleted,
      manifestsReset,
    };

    log.info(summary, 'System reset completed');
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    log.error({ err }, 'System reset failed');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reset failed' },
      { status: 500 }
    );
  }
}
