import { sqlite } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface SearchResult {
  id: string;
  title: string;
  source: string;
  department: string | null;
  snippet: string;
  rank: number;
}

/**
 * Initialize FTS5 virtual table and sync triggers. Idempotent.
 * Called once on server startup (from instrumentation.ts).
 */
export function initFTS5(): void {
  const log = logger.child({ module: 'fts5' });

  // Check if FTS5 table exists
  const ftsExists = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='documents_fts'"
  ).get();

  if (!ftsExists) {
    log.info('Creating FTS5 virtual table and sync triggers');

    sqlite.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        title,
        content,
        content='documents',
        content_rowid='rowid',
        tokenize='porter unicode61'
      );
    `);

    // Sync triggers: keep FTS5 in sync when Prisma writes to documents table
    sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
        INSERT INTO documents_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
      END;
    `);

    sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
      END;
    `);

    sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
        INSERT INTO documents_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
      END;
    `);

    // Rebuild index from any existing content
    sqlite.exec("INSERT INTO documents_fts(documents_fts) VALUES('rebuild')");

    log.info('FTS5 virtual table and triggers created successfully');
  } else {
    log.debug('FTS5 virtual table already exists');
  }
}

/**
 * BM25-ranked full-text search across documents.
 * Returns results with highlighted snippets.
 */
export function searchDocuments(query: string, limit: number = 20): SearchResult[] {
  if (!query.trim()) return [];

  return sqlite.prepare(`
    SELECT
      d.id, d.title, d.source, d.department,
      snippet(documents_fts, 1, '<mark>', '</mark>', '...', 32) as snippet,
      bm25(documents_fts, 5.0, 1.0) as rank
    FROM documents_fts
    JOIN documents d ON d.rowid = documents_fts.rowid
    WHERE documents_fts MATCH ?
      AND d.source IN ('vault', 'knowledge')
    ORDER BY rank
    LIMIT ?
  `).all(query, limit) as SearchResult[];
}

/**
 * BM25-ranked full-text search across ALL document sources (vault, knowledge, deliverable).
 * Returns results with highlighted snippets and optional full content.
 */
export function searchAllDocuments(query: string, limit: number = 50): (SearchResult & { content?: string })[] {
  if (!query.trim()) return [];

  return sqlite.prepare(`
    SELECT
      d.id, d.title, d.source, d.department, d.content,
      snippet(documents_fts, 1, '<mark>', '</mark>', '...', 32) as snippet,
      bm25(documents_fts, 5.0, 1.0) as rank
    FROM documents_fts
    JOIN documents d ON d.rowid = documents_fts.rowid
    WHERE documents_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit) as (SearchResult & { content?: string })[];
}

/**
 * Manual FTS5 indexing for cases where triggers don't fire
 * (e.g., first-boot DNA copy, documents inserted before triggers existed).
 */
export function indexDocument(id: string, title: string, content: string): void {
  const row = sqlite.prepare(
    "SELECT rowid FROM documents WHERE id = ?"
  ).get(id) as { rowid: number } | undefined;

  if (row) {
    // Trigger should have handled it, but force rebuild to be safe
    sqlite.exec("INSERT INTO documents_fts(documents_fts) VALUES('rebuild')");
  }
}
