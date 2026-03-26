import { NextResponse } from 'next/server';
import { sqlite } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'system-reset' });

export async function POST() {
  try {
    // Delete in foreign key safe order per system-reset SKILL.md
    // 1. task_runs (references tasks, employees)
    const taskRunsDeleted = sqlite.prepare('DELETE FROM task_runs').run().changes;
    // 2. cost_events (references tasks)
    const costEventsDeleted = sqlite.prepare('DELETE FROM cost_events').run().changes;
    // 3. activity_log (references tasks loosely)
    const activityLogDeleted = sqlite.prepare('DELETE FROM activity_log').run().changes;
    // 4. hire_requests (references tasks)
    const hireRequestsDeleted = sqlite.prepare('DELETE FROM hire_requests').run().changes;
    // 5. deliverables (references tasks)
    const deliverablesDeleted = sqlite.prepare('DELETE FROM deliverables').run().changes;
    // 6. tasks
    const tasksDeleted = sqlite.prepare('DELETE FROM tasks').run().changes;
    // 7. non-vault documents (preserve vault + company-dna)
    const docsDeleted = sqlite.prepare("DELETE FROM documents WHERE source != 'vault'").run().changes;
    // 8. reset employee budgets (preserve permanent employees)
    sqlite.prepare("UPDATE employees SET budgetSpent = 0.0 WHERE role = 'executive'").run();
    // 9. terminate temp employees
    const tempsTerminated = sqlite.prepare("UPDATE employees SET status = 'terminated' WHERE role = 'temp'").run().changes;

    const summary = {
      taskRunsDeleted,
      costEventsDeleted,
      activityLogDeleted,
      hireRequestsDeleted,
      deliverablesDeleted,
      tasksDeleted,
      docsDeleted,
      tempsTerminated,
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
