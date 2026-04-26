/**
 * PTY Manager -- Lifecycle management for interactive Claude Code terminal sessions.
 * Spawns node-pty processes for CEO "Take His Role" takeover.
 */
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { eventBus } from '@/lib/events';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'pty-manager' });

interface PtyEntry {
  pty: IPty;
  listeners: Set<(data: string) => void>;
}

const activePtys = new Map<string, PtyEntry>();

/**
 * Spawn an interactive Claude Code terminal session that resumes an existing SDK session.
 */
export function spawnTerminal(
  runId: string,
  sessionId: string,
  workspaceCwd: string,
): IPty {
  if (activePtys.has(runId)) {
    log.warn({ runId }, 'Terminal already active for this run, returning existing');
    return activePtys.get(runId)!.pty;
  }

  const claudePath = process.env.CLAUDE_CODE_PATH || '/home/omersh/.npm-global/bin/claude';

  log.info({ runId, sessionId, workspaceCwd, claudePath }, 'Spawning PTY terminal');

  const term = pty.spawn(claudePath, ['--dangerously-skip-permissions', '--resume', sessionId], {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: workspaceCwd,
    env: {
      ...process.env as Record<string, string>,
      TERM: 'xterm-256color',
    },
  });

  const entry: PtyEntry = {
    pty: term,
    listeners: new Set(),
  };

  activePtys.set(runId, entry);

  // Broadcast PTY data to all listeners
  term.onData((data: string) => {
    for (const cb of entry.listeners) {
      try {
        cb(data);
      } catch (err) {
        log.error({ err, runId }, 'PTY listener error');
      }
    }
  });

  // Clean up on exit
  term.onExit(({ exitCode, signal }) => {
    log.info({ runId, exitCode, signal }, 'PTY terminal exited');
    activePtys.delete(runId);
    eventBus.emit('terminal:exit', { runId, exitCode, signal });
  });

  return term;
}

/**
 * Write data to a terminal's stdin.
 */
export function writeToTerminal(runId: string, data: string): void {
  const entry = activePtys.get(runId);
  if (!entry) {
    log.warn({ runId }, 'No active terminal for write');
    return;
  }
  entry.pty.write(data);
}

/**
 * Resize a terminal.
 */
export function resizeTerminal(runId: string, cols: number, rows: number): void {
  const entry = activePtys.get(runId);
  if (!entry) return;
  try {
    entry.pty.resize(cols, rows);
  } catch (err) {
    log.error({ err, runId }, 'PTY resize failed');
  }
}

/**
 * Add a data listener to a terminal.
 */
export function addListener(runId: string, cb: (data: string) => void): void {
  const entry = activePtys.get(runId);
  if (entry) {
    entry.listeners.add(cb);
  }
}

/**
 * Remove a data listener from a terminal.
 */
export function removeListener(runId: string, cb: (data: string) => void): void {
  const entry = activePtys.get(runId);
  if (entry) {
    entry.listeners.delete(cb);
  }
}

/**
 * Force-kill a terminal.
 */
export function killTerminal(runId: string): void {
  const entry = activePtys.get(runId);
  if (!entry) return;
  log.info({ runId }, 'Force-killing terminal');
  try {
    entry.pty.kill();
  } catch (err) {
    log.error({ err, runId }, 'PTY kill failed');
  }
  activePtys.delete(runId);
}

/**
 * Check if a terminal is active for a given runId.
 */
export function isTerminalActive(runId: string): boolean {
  return activePtys.has(runId);
}
