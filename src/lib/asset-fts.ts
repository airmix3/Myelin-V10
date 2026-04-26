import { sqlite } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface AssetSearchResult {
  id: string;
  title: string;
  category: string;
  snippet: string;
  rank: number;
}

/**
 * Initialize FTS5 virtual table and sync triggers for assets. Idempotent.
 * Called once on server startup (from instrumentation.ts).
 */
export function initAssetsFTS5(): void {
  const log = logger.child({ module: 'asset-fts5' });

  const ftsExists = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='assets_fts'"
  ).get();

  if (!ftsExists) {
    log.info('Creating assets FTS5 virtual table and sync triggers');

    sqlite.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
        title,
        description,
        category,
        content='assets',
        content_rowid='rowid',
        tokenize='porter unicode61'
      );
    `);

    // Sync triggers: keep FTS5 in sync when Prisma writes to assets table
    sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS assets_ai AFTER INSERT ON assets BEGIN
        INSERT INTO assets_fts(rowid, title, description, category) VALUES (new.rowid, new.title, new.description, new.category);
      END;
    `);

    sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS assets_ad AFTER DELETE ON assets BEGIN
        INSERT INTO assets_fts(assets_fts, rowid, title, description, category) VALUES('delete', old.rowid, old.title, old.description, old.category);
      END;
    `);

    sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS assets_au AFTER UPDATE ON assets BEGIN
        INSERT INTO assets_fts(assets_fts, rowid, title, description, category) VALUES('delete', old.rowid, old.title, old.description, old.category);
        INSERT INTO assets_fts(rowid, title, description, category) VALUES (new.rowid, new.title, new.description, new.category);
      END;
    `);

    // Rebuild index from any existing content
    sqlite.exec("INSERT INTO assets_fts(assets_fts) VALUES('rebuild')");

    log.info('Assets FTS5 virtual table and triggers created successfully');
  } else {
    log.debug('Assets FTS5 virtual table already exists');
  }
}

/**
 * BM25-ranked full-text search across assets.
 * Returns results with highlighted snippets.
 */
export function searchAssets(query: string, limit: number = 20): AssetSearchResult[] {
  if (!query.trim()) return [];

  return sqlite.prepare(`
    SELECT
      a.id, a.title, a.category,
      snippet(assets_fts, 0, '<mark>', '</mark>', '...', 32) as snippet,
      bm25(assets_fts, 5.0, 2.0, 1.0) as rank
    FROM assets_fts
    JOIN assets a ON a.rowid = assets_fts.rowid
    WHERE assets_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit) as AssetSearchResult[];
}
