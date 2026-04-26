/**
 * TamirStandbyManager -- Pre-warms Tamir SDK sessions so the CEO's first
 * consultation or routing message gets inference-only latency (~1-3s) instead
 * of a 4-8s cold start.
 *
 * Two standby sessions are kept hot: one for consultation (CONSULTATION_TURN_SCHEMA)
 * and one for routing (ROUTING_SCHEMA). When a request arrives, the caller
 * acquires the standby, pushes the real message into its queue, and gets a
 * response from the already-initialized SDK subprocess.
 *
 * After acquisition the manager immediately starts creating a replacement
 * standby in the background, so the next request also benefits.
 *
 * Memory-dirty signaling: When MemoryStore writes to a Tamir memory file,
 * it calls markMemoryDirty(). After a 500ms debounce (to batch rapid writes),
 * all standbys are torn down and recreated with fresh soulMd.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { invokeAgentStreaming } from '@/lib/invoke-agent';
import { orchestrator } from '@/lib/orchestrator';
import { buildDynamicConsultationSchema, buildDynamicRoutingSchema } from '@/a2a/schemas';
import { DATA_ROOT as DATA_DIR } from '@/lib/paths';
import { generateId } from '@/lib/id';
import { logger } from '@/lib/logger';
import { AsyncQueue } from '@/lib/warm-session';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StandbySession {
  type: 'consult' | 'route';
  queue: AsyncQueue<SDKUserMessage>;
  query: ReturnType<typeof query>;
  runId: string;
  sessionIdPromise: Promise<string>;
  createdAt: number;
  soulMd: string;
}

// ---------------------------------------------------------------------------
// System prompts (must match the prompts used by consult/route endpoints)
// ---------------------------------------------------------------------------

const CONSULT_SYSTEM_PROMPT =
  'You are Tamir, Chief of Staff. The CEO is consulting with you. Respond naturally and thoughtfully.\n\n' +
  'Classification rules:\n' +
  '- Default to "chat". Most turns are consultation.\n' +
  '- Only classify as "task_detected" when the CEO explicitly delegates work \u2014 ' +
  'look for phrases like "let\'s have X do", "assign", "get the CTO to", ' +
  '"I want [agent] to build/create/fix". Discussing a topic, asking for advice, ' +
  'or mentioning problems is NOT a task. The CEO must signal intent to hand off work to an agent.';

const ROUTE_SYSTEM_PROMPT =
  'The CEO wants to get something done. Route this request to the correct department.';

// ---------------------------------------------------------------------------
// TamirStandbyManager
// ---------------------------------------------------------------------------

export class TamirStandbyManager {
  private standbys = new Map<'consult' | 'route', StandbySession>();
  private memoryDirty = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshing = false;
  private log = logger.child({ module: 'tamir-standby' });

  /**
   * Initialize standby sessions. Called once from instrumentation.ts.
   * Non-blocking -- caller should use .then()/.catch(), not await.
   */
  async init(): Promise<void> {
    const start = Date.now();
    this.log.info('Pre-warming Tamir standby sessions...');

    try {
      await Promise.all([
        this.createStandby('consult'),
        this.createStandby('route'),
      ]);
      this.log.info({ durationMs: Date.now() - start }, 'Tamir standby sessions pre-warmed');
    } catch (err) {
      this.log.error({ err, durationMs: Date.now() - start }, 'Tamir standby pre-warm failed (non-fatal)');
    }
  }

  /**
   * Acquire a pre-warmed standby session. Returns null if unavailable
   * (refreshing or none exists), in which case callers should fall back
   * to the cold path.
   *
   * After acquisition, a replacement standby is created in the background.
   */
  acquire(type: 'consult' | 'route'): StandbySession | null {
    if (this.refreshing) {
      this.log.debug({ type }, 'Standby unavailable (refreshing)');
      return null;
    }

    const session = this.standbys.get(type);
    if (!session) {
      this.log.debug({ type }, 'No standby available');
      return null;
    }

    // Take the session out of the map
    this.standbys.delete(type);

    this.log.info(
      { type, ageMs: Date.now() - session.createdAt },
      'Standby acquired',
    );

    // Schedule background replacement
    setTimeout(() => {
      this.createStandby(type).catch((err) => {
        this.log.error({ err, type }, 'Background standby replacement failed');
      });
    }, 0);

    return session;
  }

  /**
   * Signal that a Tamir memory file was written. After 500ms debounce,
   * all standbys are torn down and recreated with fresh soulMd.
   */
  markMemoryDirty(): void {
    this.memoryDirty = true;

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      this.refresh().catch((err) => {
        this.log.error({ err }, 'Standby refresh after memory-dirty failed');
      });
    }, 500);
  }

  /**
   * Tear down existing standbys and create fresh ones with updated soulMd.
   */
  async refresh(): Promise<void> {
    this.refreshing = true;
    this.log.info('Refreshing standbys (memory dirty)');

    try {
      // Close existing standbys
      for (const [type, session] of this.standbys) {
        try {
          session.queue.close();
          session.query.close();
        } catch {
          // Ignore close errors
        }
        this.standbys.delete(type);
      }

      // Create fresh standbys
      await Promise.all([
        this.createStandby('consult'),
        this.createStandby('route'),
      ]);

      this.memoryDirty = false;
      this.log.info('Standbys refreshed with fresh soulMd');
    } catch (err) {
      this.log.error({ err }, 'Standby refresh failed');
    } finally {
      this.refreshing = false;
    }
  }

  /**
   * Graceful shutdown -- close all standbys.
   */
  shutdown(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    for (const [, session] of this.standbys) {
      try {
        session.queue.close();
        session.query.close();
      } catch {
        // Ignore
      }
    }
    this.standbys.clear();
    this.log.info('Standby manager shut down');
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async createStandby(type: 'consult' | 'route'): Promise<void> {
    const start = Date.now();

    // Load fresh soulMd
    const soulMd = await orchestrator.getSoulMd('tamir');
    const agent = orchestrator.getAgent('tamir');
    if (!agent) {
      this.log.warn('Tamir agent not registered, skipping standby creation');
      return;
    }

    // Desk paths (same as consult/route endpoints)
    const deskDir = join(DATA_DIR, 'departments', 'cos');
    const tmpDelivDir = join(DATA_DIR, 'tmp', `standby-${type}-${Date.now()}`);
    mkdirSync(tmpDelivDir, { recursive: true });
    const manifestPath = join(tmpDelivDir, 'manifest.json');
    writeFileSync(manifestPath, '{}', 'utf-8');

    // Create empty queue
    const queue = new AsyncQueue<SDKUserMessage>();

    // Determine schema and system prompt
    const outputFormat = type === 'consult' ? await buildDynamicConsultationSchema() : await buildDynamicRoutingSchema();

    const runId = generateId('run');
    const taskId = `standby-${type}-${Date.now()}`;

    // Start streaming query with empty queue (SDK initializes, then blocks waiting for input)
    const { query: q, sessionIdPromise } = invokeAgentStreaming({
      taskId,
      runId,
      agentId: 'tamir',
      department: agent.department,
      soulMd,
      deskDir,
      delivDir: tmpDelivDir,
      manifestPath,
      outputFormat,
      maxBudgetUsd: 1,
      prompt: queue,
      tools: [], // LLM-only mode
    });

    // Wait for SDK to fully initialize
    await sessionIdPromise;

    // Store the standby
    this.standbys.set(type, {
      type,
      queue,
      query: q,
      runId,
      sessionIdPromise,
      createdAt: Date.now(),
      soulMd,
    });

    this.log.info({ type, durationMs: Date.now() - start }, 'Standby created');
  }
}

// ---------------------------------------------------------------------------
// Singleton -- survives Next.js HMR in development
// ---------------------------------------------------------------------------

const globalForStandby = globalThis as typeof globalThis & { __tamirStandby?: TamirStandbyManager };
export const tamirStandby: TamirStandbyManager = globalForStandby.__tamirStandby ??= new TamirStandbyManager();
