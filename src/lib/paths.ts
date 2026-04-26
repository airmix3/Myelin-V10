import { resolve, join } from 'path';

/**
 * Root directory for all Cortex data (DB, agents, departments, workspaces, etc.)
 * Override via CORTEX_DATA_DIR env var for testing with isolated data directories.
 * Default: 'data' relative to process.cwd()
 */
export const DATA_ROOT = resolve(process.cwd(), process.env.CORTEX_DATA_DIR || 'data');

/**
 * Build a path relative to DATA_ROOT.
 * Usage: dataPath('agents', 'tamir', 'MEMORY.md') => '{DATA_ROOT}/agents/tamir/MEMORY.md'
 */
export function dataPath(...segments: string[]): string {
  return join(DATA_ROOT, ...segments);
}
