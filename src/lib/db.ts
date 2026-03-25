import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'data', 'myelin.db');

// Singleton store -- survives Next.js HMR in development
const globalForDb = globalThis as typeof globalThis & {
  __sqlite?: InstanceType<typeof Database>;
  __prisma?: PrismaClient;
};

// Direct better-sqlite3 instance for FTS5 raw queries, PRAGMAs, triggers
// This is separate from the Prisma adapter (which manages its own connection in Prisma 7)
export const sqlite: InstanceType<typeof Database> = globalForDb.__sqlite ??= (() => {
  const db = new Database(DB_PATH);
  // Set PRAGMAs BEFORE any Prisma usage (per FOUND-02)
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  return db;
})();

// Prisma 7 adapter takes a config object with url, not a Database instance
const adapter = new PrismaBetterSqlite3({ url: `file:${DB_PATH}` });

// Prisma client with driver adapter -- singleton survives HMR
export const prisma: PrismaClient = globalForDb.__prisma ??= new PrismaClient({ adapter });
