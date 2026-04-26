/**
 * WarmSessionManager -- Keeps Tamir SDK sessions warm between CEO consultation turns.
 * Instead of cold-starting a new query() per turn, follow-up messages push into
 * an AsyncQueue that feeds the running query's AsyncIterable prompt.
 *
 * The SDK query() yields a result message after each user message, then blocks
 * waiting for the next item from the async iterable. The consumer loop resolves
 * pendingResponse on each result, then continues blocking until the next push.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  SDKSystemMessage,
  SDKAssistantMessage,
  SDKResultSuccess,
  SDKResultError,
  SDKToolUseSummaryMessage,
  SDKToolProgressMessage,
  SDKUserMessage,
  JsonSchemaOutputFormat,
} from '@anthropic-ai/claude-agent-sdk';
import {
  invokeAgentStreaming,
  extractAssistantText,
  extractToolUseBlocks,
  summarizeToolUse,
  truncateText,
  normalizeWhitespace,
} from '@/lib/invoke-agent';
import { insertActivityLog } from '@/lib/activity-log';
import { eventBus } from '@/lib/events';
import { generateId } from '@/lib/id';
import { unregisterQueryRef } from '@/lib/mcp/query-registry';
import { logger } from '@/lib/logger';
import type { ConsultationTurnResult } from '@/a2a/types';

// ---------------------------------------------------------------------------
// AsyncQueue -- bridges push-based API routes to pull-based SDK AsyncIterable
// ---------------------------------------------------------------------------

export class AsyncQueue<T> implements AsyncIterable<T> {
  private buffer: T[] = [];
  private pendingResolve: ((result: IteratorResult<T>) => void) | null = null;
  private closed = false;

  push(item: T): void {
    if (this.closed) return;
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve({ value: item, done: false });
    } else {
      this.buffer.push(item);
    }
  }

  close(): void {
    this.closed = true;
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve({ value: undefined as unknown as T, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        if (this.buffer.length > 0) {
          return Promise.resolve({ value: this.buffer.shift()!, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined as unknown as T, done: true });
        }
        return new Promise<IteratorResult<T>>((resolve) => {
          this.pendingResolve = resolve;
        });
      },
    };
  }
}

// ---------------------------------------------------------------------------
// WarmSession
// ---------------------------------------------------------------------------

interface WarmSession {
  conversationId: string;
  sessionId: string;
  queue: AsyncQueue<SDKUserMessage>;
  query: ReturnType<typeof query>;
  pendingResponse: {
    resolve: (result: ConsultationTurnResult) => void;
    reject: (err: Error) => void;
  } | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  lastActivity: number;
  totalCostUsd: number;
  runId: string;
}

// ---------------------------------------------------------------------------
// WarmSessionManager
// ---------------------------------------------------------------------------

export interface CreateSessionOpts {
  agentId: string;
  department: string;
  soulMd: string;
  deskDir: string;
  delivDir: string;
  manifestPath: string;
  outputFormat?: JsonSchemaOutputFormat;
  maxBudgetUsd?: number;
  sessionId?: string;
  initialPrompt: string;
  initialMessage: string;
}

export class WarmSessionManager {
  private sessions = new Map<string, WarmSession>();
  private log = logger.child({ module: 'warm-session' });

  static readonly IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  getSession(conversationId: string): WarmSession | undefined {
    return this.sessions.get(conversationId);
  }

  /**
   * Create a warm session and push the first message.
   * Returns a Promise<ConsultationTurnResult> that resolves when the SDK responds.
   */
  async createSession(
    conversationId: string,
    opts: CreateSessionOpts,
  ): Promise<ConsultationTurnResult> {
    const runId = generateId('run');
    const queue = new AsyncQueue<SDKUserMessage>();

    // Push the initial user message into the queue BEFORE starting the query
    // so the SDK has something to consume immediately
    const firstMessage: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content: opts.initialPrompt + `\n\nCEO: "${opts.initialMessage}"` },
      parent_tool_use_id: null,
      session_id: '', // SDK will assign
    };
    queue.push(firstMessage);

    // Start streaming query
    const { query: q, sessionIdPromise } = invokeAgentStreaming({
      taskId: conversationId,
      runId,
      agentId: opts.agentId,
      department: opts.department,
      soulMd: opts.soulMd,
      deskDir: opts.deskDir,
      delivDir: opts.delivDir,
      manifestPath: opts.manifestPath,
      outputFormat: opts.outputFormat,
      maxBudgetUsd: opts.maxBudgetUsd,
      sessionId: opts.sessionId,
      prompt: queue,
      tools: [], // LLM-only mode for consultation (no built-in tools)
    });

    const session: WarmSession = {
      conversationId,
      sessionId: '', // Will be set when init message arrives
      queue,
      query: q,
      pendingResponse: null,
      idleTimer: null,
      lastActivity: Date.now(),
      totalCostUsd: 0,
      runId,
    };

    this.sessions.set(conversationId, session);

    // Start background consumer loop (fire and forget)
    this.consumeQueryStream(session, sessionIdPromise).catch((err) => {
      this.log.error({ conversationId, err }, 'Consumer loop crashed');
    });

    // Create the pending response promise for the first turn
    return this.createPendingResponse(session);
  }

  /**
   * Push a follow-up message into an existing warm session.
   * Returns a Promise<ConsultationTurnResult> that resolves when the SDK responds.
   */
  pushMessage(conversationId: string, message: string): Promise<ConsultationTurnResult> {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new Error(`No warm session for conversation ${conversationId}`);
    }

    this.resetIdleTimer(session);
    session.lastActivity = Date.now();

    // Construct SDK user message
    const userMsg: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content: `CEO: "${message}"` },
      parent_tool_use_id: null,
      session_id: session.sessionId,
    };

    // Push into the queue -- the SDK will pick it up
    session.queue.push(userMsg);

    // Create and return the pending response promise
    return this.createPendingResponse(session);
  }

  /**
   * Adopt a pre-warmed standby session as a warm session for a conversation.
   * The standby's queue/query are reused -- the first user message is pushed
   * into the existing queue so the already-initialized SDK subprocess responds
   * with inference-only latency.
   */
  async adoptStandby(
    conversationId: string,
    opts: {
      queue: AsyncQueue<SDKUserMessage>;
      query: ReturnType<typeof query>;
      runId: string;
      sessionIdPromise: Promise<string>;
      initialPrompt: string;
      initialMessage: string;
    },
  ): Promise<ConsultationTurnResult> {
    const sessionId = await opts.sessionIdPromise;

    const session: WarmSession = {
      conversationId,
      sessionId,
      queue: opts.queue,
      query: opts.query,
      pendingResponse: null,
      idleTimer: null,
      lastActivity: Date.now(),
      totalCostUsd: 0,
      runId: opts.runId,
    };

    this.sessions.set(conversationId, session);

    // Start consumer loop (same as createSession)
    this.consumeQueryStream(session, opts.sessionIdPromise).catch((err) => {
      this.log.error({ conversationId, err }, 'Consumer loop crashed (adopted standby)');
    });

    // Push the first user message into the already-initialized queue
    const firstMessage: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content: opts.initialPrompt + `\n\nCEO: "${opts.initialMessage}"` },
      parent_tool_use_id: null,
      session_id: sessionId,
    };
    session.queue.push(firstMessage);

    return this.createPendingResponse(session);
  }

  /**
   * Close a warm session, releasing all resources.
   */
  closeSession(conversationId: string): void {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    this.log.info(
      { conversationId, totalCostUsd: session.totalCostUsd },
      'Closing warm session',
    );

    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }

    session.queue.close();
    session.query.close();
    unregisterQueryRef(session.runId);

    // Reject any pending response
    if (session.pendingResponse) {
      session.pendingResponse.reject(new Error('Session closed'));
      session.pendingResponse = null;
    }

    this.sessions.delete(conversationId);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private createPendingResponse(session: WarmSession): Promise<ConsultationTurnResult> {
    return new Promise<ConsultationTurnResult>((resolve, reject) => {
      session.pendingResponse = { resolve, reject };
    });
  }

  private resetIdleTimer(session: WarmSession): void {
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }
    session.idleTimer = setTimeout(() => {
      this.log.info(
        { conversationId: session.conversationId },
        'Idle timeout reached, closing warm session',
      );
      this.closeSession(session.conversationId);
    }, WarmSessionManager.IDLE_TIMEOUT_MS);
  }

  /**
   * Background consumer loop -- iterates the SDK query async generator,
   * processes messages, and resolves pendingResponse on each result.
   */
  private async consumeQueryStream(
    session: WarmSession,
    sessionIdPromise: Promise<string>,
  ): Promise<void> {
    const log = this.log.child({ conversationId: session.conversationId });

    // Start idle timer
    this.resetIdleTimer(session);

    try {
      const seenTypes = new Set<string>();

      for await (const msg of session.query) {
        const typeKey = msg.type + ('subtype' in msg ? `:${(msg as Record<string, unknown>).subtype}` : '');
        if (!seenTypes.has(typeKey)) {
          seenTypes.add(typeKey);
          log.info({ msgType: typeKey }, 'SDK message type seen (first occurrence)');
        }

        // Init message -- capture session_id
        if (msg.type === 'system' && 'subtype' in msg && (msg as Record<string, unknown>).subtype === 'init') {
          const initMsg = msg as SDKSystemMessage;
          session.sessionId = initMsg.session_id;

          // Resolve the sessionId promise (for external consumers)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const resolver = (session.query as any).__resolveSessionId;
          if (typeof resolver === 'function') {
            (resolver as (id: string) => void)(initMsg.session_id);
          }

          log.info({ sessionId: session.sessionId }, 'Warm session initialized');

          insertActivityLog({
            taskId: session.conversationId,
            agentId: 'tamir',
            actionType: 'SDK_SESSION_INIT',
            description: `Warm session started`,
            metadata: {
              sessionId: session.sessionId,
              model: initMsg.model,
              cwd: initMsg.cwd,
              tools: initMsg.tools,
              mcpServers: initMsg.mcp_servers,
            },
          });
        }

        // Assistant message -- log to activity_log and emit buildlog
        if (msg.type === 'assistant') {
          const assistantMsg = msg as SDKAssistantMessage;
          const assistantText = extractAssistantText(assistantMsg);
          if (assistantText || assistantMsg.error) {
            insertActivityLog({
              taskId: session.conversationId,
              agentId: 'tamir',
              actionType: 'SDK_ASSISTANT',
              description: assistantText
                ? truncateText(assistantText)
                : `Assistant error: ${assistantMsg.error}`,
              metadata: {
                text: assistantText || null,
                parentToolUseId: assistantMsg.parent_tool_use_id,
                error: assistantMsg.error ?? null,
              },
            });
          }

          eventBus.emit('task:buildlog', {
            taskId: session.conversationId,
            event: { type: 'assistant', agentId: 'tamir', content: assistantMsg },
          });

          for (const block of extractToolUseBlocks(assistantMsg)) {
            insertActivityLog({
              taskId: session.conversationId,
              agentId: 'tamir',
              actionType: 'SDK_TOOL_CALL',
              description: summarizeToolUse(block.name, block.input),
              metadata: {
                toolName: block.name,
                toolUseId: block.id,
                parentToolUseId: assistantMsg.parent_tool_use_id,
                input: block.input,
              },
            });
          }
        }

        // Tool progress
        if (msg.type === 'tool_progress') {
          const toolMsg = msg as SDKToolProgressMessage;
          insertActivityLog({
            taskId: session.conversationId,
            agentId: 'tamir',
            actionType: 'SDK_TOOL_PROGRESS',
            description: `${toolMsg.tool_name} running`,
            metadata: {
              toolName: toolMsg.tool_name,
              toolUseId: toolMsg.tool_use_id,
            },
          });
        }

        // Tool use summary
        if (msg.type === 'tool_use_summary') {
          const summaryMsg = msg as SDKToolUseSummaryMessage;
          insertActivityLog({
            taskId: session.conversationId,
            agentId: 'tamir',
            actionType: 'SDK_TOOL_SUMMARY',
            description: summaryMsg.summary,
            metadata: { precedingToolUseIds: summaryMsg.preceding_tool_use_ids },
          });
        }

        // Stream event -- emit partial tokens for real-time UI display
        if (msg.type === 'stream_event') {
          const event = (msg as Record<string, unknown>).event as Record<string, unknown> | undefined;
          if (event?.type === 'content_block_delta') {
            const delta = event.delta as Record<string, unknown> | undefined;
            // Handle both text_delta (normal) and json_delta (structured output)
            const text = delta?.type === 'text_delta' ? delta.text
              : delta?.type === 'json_delta' ? delta.partial_json
              : undefined;
            if (typeof text === 'string' && text.length > 0) {
              eventBus.emit('consult:stream', {
                conversationId: session.conversationId,
                delta: text,
              });
            }
          }
        }

        // Result message -- resolve pending response, continue waiting for next turn
        if (msg.type === 'result') {
          if (msg.subtype === 'success') {
            const result = msg as SDKResultSuccess;
            session.totalCostUsd += result.total_cost_usd;

            log.info(
              { totalCostUsd: session.totalCostUsd, numTurns: result.num_turns },
              'Warm session turn completed',
            );

            insertActivityLog({
              taskId: session.conversationId,
              agentId: 'tamir',
              actionType: 'SDK_RESULT_SUCCESS',
              description: `Turn completed in ${Math.round(result.duration_ms / 1000)}s`,
              metadata: {
                sessionId: session.sessionId,
                totalCostUsd: session.totalCostUsd,
                durationMs: result.duration_ms,
                numTurns: result.num_turns,
              },
            });

            // Resolve the pending response with structured output
            if (session.pendingResponse) {
              const consultation = result.structured_output as ConsultationTurnResult;
              if (consultation?.response) {
                session.pendingResponse.resolve(consultation);
              } else {
                session.pendingResponse.reject(
                  new Error('No structured output in warm session result'),
                );
              }
              session.pendingResponse = null;
            }

            eventBus.emit('consult:done', {
              conversationId: session.conversationId,
            });

            // IMPORTANT: Do NOT break here -- the for-await loop continues
            // waiting for more messages from the AsyncQueue.
          } else {
            // Error result
            const errorResult = msg as SDKResultError;
            log.error(
              { subtype: errorResult.subtype, errors: errorResult.errors },
              'Warm session turn failed',
            );

            insertActivityLog({
              taskId: session.conversationId,
              agentId: 'tamir',
              actionType: 'SDK_RESULT_ERROR',
              description: `Failed: ${errorResult.subtype}`,
              metadata: {
                subtype: errorResult.subtype,
                errors: errorResult.errors,
              },
            });

            if (session.pendingResponse) {
              session.pendingResponse.reject(
                new Error(`Agent error: ${errorResult.subtype} - ${errorResult.errors.join(', ')}`),
              );
              session.pendingResponse = null;
            }
          }
        }
      }
    } catch (err) {
      log.error({ err }, 'Consumer loop error');
      if (session.pendingResponse) {
        session.pendingResponse.reject(
          err instanceof Error ? err : new Error(String(err)),
        );
        session.pendingResponse = null;
      }
    } finally {
      log.info('Consumer loop ended, cleaning up session');
      unregisterQueryRef(session.runId);
      if (session.idleTimer) {
        clearTimeout(session.idleTimer);
      }
      this.sessions.delete(session.conversationId);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton -- survives Next.js HMR in development
// ---------------------------------------------------------------------------

const globalForWarm = globalThis as typeof globalThis & { __warmSessions?: WarmSessionManager };
export const warmSessions: WarmSessionManager = globalForWarm.__warmSessions ??= new WarmSessionManager();
