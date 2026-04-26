import { sqlite } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Initialize all strategic layer tables via raw SQL.
 * Uses CREATE TABLE IF NOT EXISTS for idempotency.
 * Called once on server startup (from instrumentation.ts).
 *
 * Why raw SQL instead of Prisma migrate:
 * Prisma migrate is blocked by FTS5 drift (virtual tables and triggers
 * created outside of Prisma migrations cause schema drift detection failures).
 * Prisma schema is updated for type generation only.
 */
export function initStrategicTables(): void {
  const log = logger.child({ module: 'strategic-tables' });

  log.info('Initializing strategic layer tables');

  sqlite.exec(`
    -- 1. Canvas Chats: CEO-Tamir strategic conversation threads
    CREATE TABLE IF NOT EXISTS canvas_chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      chatFilePath TEXT,
      canvasFilePath TEXT,
      lastOpenedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 2. Decision Records: strategic decisions extracted from canvas chats
    CREATE TABLE IF NOT EXISTS decision_records (
      id TEXT PRIMARY KEY,
      canvasChatId TEXT NOT NULL REFERENCES canvas_chats(id),
      summary TEXT NOT NULL,
      conversationRef TEXT,
      canvasSnapshotRef TEXT,
      constraints TEXT,
      alternatives TEXT,
      challengeHighlights TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 3. Directions: high-level strategic directions
    CREATE TABLE IF NOT EXISTS directions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      rationale TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 4. Goals: measurable objectives under directions
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      definitionOfDone TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 5. Task Seeds: pre-task definitions generated from goals
    CREATE TABLE IF NOT EXISTS task_seeds (
      id TEXT PRIMARY KEY,
      goalId TEXT NOT NULL REFERENCES goals(id),
      title TEXT NOT NULL,
      description TEXT,
      suggestedDepartment TEXT,
      roughScope TEXT,
      dependencies TEXT,
      strategicContext TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      taskId TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 6. Priority Sets: named strategic theme sets (per D-05)
    CREATE TABLE IF NOT EXISTS priority_sets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 7. Junction: decision_records <-> directions (M:N)
    CREATE TABLE IF NOT EXISTS decision_directions (
      decisionId TEXT NOT NULL REFERENCES decision_records(id),
      directionId TEXT NOT NULL REFERENCES directions(id),
      PRIMARY KEY (decisionId, directionId)
    );

    -- 8. Junction: directions <-> goals (M:N)
    CREATE TABLE IF NOT EXISTS direction_goals (
      directionId TEXT NOT NULL REFERENCES directions(id),
      goalId TEXT NOT NULL REFERENCES goals(id),
      PRIMARY KEY (directionId, goalId)
    );

    -- 9. Junction: goals <-> assets (M:N)
    CREATE TABLE IF NOT EXISTS goal_assets (
      goalId TEXT NOT NULL REFERENCES goals(id),
      assetId TEXT NOT NULL REFERENCES assets(id),
      PRIMARY KEY (goalId, assetId)
    );

    -- 10. Junction: directions <-> priority_sets (M:N)
    CREATE TABLE IF NOT EXISTS direction_priority_sets (
      directionId TEXT NOT NULL REFERENCES directions(id),
      prioritySetId TEXT NOT NULL REFERENCES priority_sets(id),
      PRIMARY KEY (directionId, prioritySetId)
    );
  `);

  // 11. ALTER TABLE tasks ADD COLUMN goalId — may already exist
  try {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN goalId TEXT`);
    log.info('Added goalId column to tasks table');
  } catch {
    // Column already exists — safe to ignore
    log.debug('goalId column already exists on tasks table');
  }

  // 12. ALTER TABLE directions ADD COLUMN priority — may already exist
  try {
    sqlite.exec(`ALTER TABLE directions ADD COLUMN priority TEXT NOT NULL DEFAULT 'active'`);
    log.info('Added priority column to directions table');
  } catch {
    // Column already exists — safe to ignore
    log.debug('priority column already exists on directions table');
  }

  log.info('Strategic layer tables initialized');
}
