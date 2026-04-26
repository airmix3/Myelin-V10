/**
 * Vitest global setup file.
 * Mocks all heavy dependencies (DB, events, logger, activity-log) globally
 * so individual test files don't need to repeat this setup.
 */
import { vi } from 'vitest';
import { createMockSqlite, createMockPrisma, resetMocks } from './helpers/mock-db';

// Create mock instances
const mockSqlite = createMockSqlite();
const mockPrisma = createMockPrisma();

// Mock @/lib/db globally
vi.mock('@/lib/db', () => ({
  sqlite: mockSqlite,
  prisma: mockPrisma,
}));

// Mock @/lib/events globally
vi.mock('@/lib/events', () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(),
  },
}));

// Mock @/lib/logger globally
const mockChildLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
};
mockChildLogger.child.mockReturnValue(mockChildLogger);

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue(mockChildLogger),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock @/lib/activity-log globally
vi.mock('@/lib/activity-log', () => ({
  insertActivityLog: vi.fn(),
}));

// Mock @/lib/id globally with deterministic IDs for testing
let idCounter = 0;
vi.mock('@/lib/id', () => ({
  generateId: vi.fn((prefix: string) => `${prefix}_test_${++idCounter}`),
}));

// Reset all mocks between tests
import { beforeEach } from 'vitest';

beforeEach(() => {
  resetMocks();
  idCounter = 0;
});
