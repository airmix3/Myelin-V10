/**
 * Mock database helpers for isolated testing.
 * Provides mock sqlite (better-sqlite3) and prisma instances.
 */
import { vi } from 'vitest';

/**
 * Tracks SQL queries for assertion in tests.
 * Each call to prepare(sql) stores the sql string.
 */
const queryLog: string[] = [];

export function getQueryLog(): string[] {
  return [...queryLog];
}

export function clearQueryLog(): void {
  queryLog.length = 0;
}

/**
 * Creates a mock better-sqlite3 instance.
 * Supports the chaining pattern: sqlite.prepare(sql).all(args) / .get(args) / .run(args)
 */
export function createMockSqlite() {
  const mockStatement = {
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(undefined),
    run: vi.fn().mockReturnValue({ changes: 0, lastInsertRowid: 0 }),
  };

  const sqlite = {
    prepare: vi.fn((sql: string) => {
      queryLog.push(sql);
      return mockStatement;
    }),
    pragma: vi.fn(),
    // Expose the mock statement for test assertions
    __mockStatement: mockStatement,
  };

  return sqlite;
}

/**
 * Creates a mock Prisma client with common model methods.
 */
export function createMockPrisma() {
  return {
    hireRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    employee: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    taskRun: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  };
}

/**
 * Reset all mock state between tests.
 */
export function resetMocks(): void {
  clearQueryLog();
  vi.clearAllMocks();
}
