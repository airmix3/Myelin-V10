/**
 * Git repository management for asset directories.
 * Each asset becomes its own local git repo with branch-per-task isolation.
 * Uses execSync for all git operations (matches synchronous better-sqlite3 pattern).
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'asset-repo' });

const EXEC_OPTS = { stdio: 'pipe' as const, encoding: 'utf-8' as const };

/**
 * Initialize a git repo in an asset directory. Idempotent — returns early if .git exists.
 */
export function initAssetRepo(assetDir: string): void {
  if (existsSync(join(assetDir, '.git'))) {
    log.debug({ assetDir }, 'Git repo already initialized, skipping');
    return;
  }

  try {
    execSync('git init', { ...EXEC_OPTS, cwd: assetDir });
    execSync('git checkout -b main', { ...EXEC_OPTS, cwd: assetDir });
    execSync('git config user.name "Cortex"', { ...EXEC_OPTS, cwd: assetDir });
    execSync('git config user.email "cortex@local"', { ...EXEC_OPTS, cwd: assetDir });
    log.info({ assetDir }, 'Initialized asset git repo');
  } catch (err) {
    log.error({ err, assetDir }, 'Failed to initialize asset git repo');
    throw new Error(`Failed to init asset repo at ${assetDir}: ${err}`);
  }
}

/**
 * Stage all changes and commit. Returns true if a commit was made, false if nothing to commit.
 */
export function commitToAsset(assetDir: string, message: string): boolean {
  try {
    execSync('git add -A', { ...EXEC_OPTS, cwd: assetDir });

    // Check if there are staged changes (exit code 1 = changes exist)
    try {
      execSync('git diff --cached --quiet', { ...EXEC_OPTS, cwd: assetDir });
      // If no error, there are no changes
      log.debug({ assetDir }, 'No staged changes to commit');
      return false;
    } catch {
      // Exit code 1 = changes exist, proceed to commit
    }

    execSync(`git commit -m ${JSON.stringify(message)}`, { ...EXEC_OPTS, cwd: assetDir });
    log.info({ assetDir, message }, 'Committed to asset repo');
    return true;
  } catch (err) {
    log.error({ err, assetDir }, 'Failed to commit to asset repo');
    throw new Error(`Failed to commit to asset repo at ${assetDir}: ${err}`);
  }
}

/**
 * Create or switch to a task branch. Branch name: task-{taskId}.
 */
export function createAssetBranch(assetDir: string, taskId: string): void {
  const branch = `task-${taskId}`;
  try {
    const existing = execSync(`git branch --list ${branch}`, { ...EXEC_OPTS, cwd: assetDir }).trim();
    if (existing) {
      execSync(`git checkout ${branch}`, { ...EXEC_OPTS, cwd: assetDir });
      log.info({ assetDir, branch }, 'Switched to existing asset branch');
    } else {
      execSync(`git checkout -b ${branch}`, { ...EXEC_OPTS, cwd: assetDir });
      log.info({ assetDir, branch }, 'Created new asset branch');
    }
  } catch (err) {
    log.error({ err, assetDir, branch }, 'Failed to create/switch asset branch');
    throw new Error(`Failed to create asset branch ${branch} at ${assetDir}: ${err}`);
  }
}

/**
 * Merge a task branch back to main. Prefers fast-forward, falls back to merge commit.
 * Deletes the branch after merge.
 */
export function mergeAssetBranch(assetDir: string, taskId: string): void {
  const branch = `task-${taskId}`;
  try {
    execSync('git checkout main', { ...EXEC_OPTS, cwd: assetDir });

    try {
      execSync(`git merge --ff-only ${branch}`, { ...EXEC_OPTS, cwd: assetDir });
    } catch {
      // Fast-forward failed, fall back to merge commit
      execSync(`git merge ${branch} -m "Merge ${branch}"`, { ...EXEC_OPTS, cwd: assetDir });
    }

    execSync(`git branch -d ${branch}`, { ...EXEC_OPTS, cwd: assetDir });
    log.info({ assetDir, branch }, 'Merged and deleted asset branch');
  } catch (err) {
    log.error({ err, assetDir, branch }, 'Failed to merge asset branch');
    throw new Error(`Failed to merge asset branch ${branch} at ${assetDir}: ${err}`);
  }
}

/**
 * Discard a task branch (force delete since unmerged). Returns to main.
 */
export function discardAssetBranch(assetDir: string, taskId: string): void {
  const branch = `task-${taskId}`;
  try {
    execSync('git checkout main', { ...EXEC_OPTS, cwd: assetDir });
    execSync(`git branch -D ${branch}`, { ...EXEC_OPTS, cwd: assetDir });
    log.info({ assetDir, branch }, 'Discarded asset branch');
  } catch (err) {
    log.warn({ err, assetDir, branch }, 'Failed to discard asset branch (may not exist)');
  }
}

/**
 * Get recent git log for an asset directory. Utility for debugging/display.
 */
export function getAssetLog(assetDir: string, limit?: number): string {
  try {
    return execSync(`git log --oneline -n ${limit || 10}`, { ...EXEC_OPTS, cwd: assetDir }).trim();
  } catch (err) {
    log.error({ err, assetDir }, 'Failed to get asset log');
    throw new Error(`Failed to get asset log at ${assetDir}: ${err}`);
  }
}
