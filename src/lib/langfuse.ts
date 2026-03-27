/**
 * Langfuse tracing module -- conditional OTel integration.
 * Per D-07: Initialize once at server boot when API keys are present.
 * Per D-08: Silently disabled when keys are absent.
 * Per D-09: Fail silently if Langfuse Cloud is unavailable.
 */
import { logger } from './logger';

const log = logger.child({ module: 'langfuse' });

// Check once at module load (D-08)
const LANGFUSE_ENABLED = !!(
  process.env.LANGFUSE_PUBLIC_KEY &&
  process.env.LANGFUSE_SECRET_KEY
);

export function isLangfuseEnabled(): boolean {
  return LANGFUSE_ENABLED;
}

/**
 * Initialize OTel + Langfuse. Call once from instrumentation.ts.
 * No-op if LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not present.
 * HMR-safe via globalThis.__langfuseOtelSdk singleton guard.
 */
export async function initLangfuse(): Promise<void> {
  if (!LANGFUSE_ENABLED) {
    log.info('Langfuse tracing disabled (no API keys)');
    return;
  }

  // HMR guard (Pitfall 2)
  const g = globalThis as typeof globalThis & { __langfuseOtelSdk?: unknown };
  if (g.__langfuseOtelSdk) {
    log.debug('Langfuse OTel SDK already initialized');
    return;
  }

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { LangfuseSpanProcessor } = await import('@langfuse/otel');

    const sdk = new NodeSDK({
      spanProcessors: [
        new LangfuseSpanProcessor({
          publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
          secretKey: process.env.LANGFUSE_SECRET_KEY!,
          baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
          exportMode: 'batched',
          environment: process.env.NODE_ENV ?? 'development',
        }),
      ],
    });

    sdk.start();
    g.__langfuseOtelSdk = sdk;
    log.info('Langfuse OTel SDK initialized successfully');
  } catch (err) {
    log.warn({ err }, 'Langfuse initialization failed -- tracing disabled');
  }
}

/**
 * Wrap an async function in a Langfuse agent observation.
 * Per D-10: Uses deterministic traceId from taskId so all invocations
 * for the same task nest under one trace.
 * Per D-12: One span per invokeAgent() call.
 * Per D-09: If Langfuse itself errors, falls through to fn() directly.
 */
export async function withAgentObservation<T>(
  opts: {
    taskId: string;
    agentId: string;
    department: string;
    soulMd: string;
    prompt: string;
    runId: string;
  },
  fn: () => Promise<T>,
): Promise<T> {
  if (!LANGFUSE_ENABLED) {
    return fn();
  }

  try {
    const { startActiveObservation, propagateAttributes, createTraceId } =
      await import('@langfuse/tracing');

    // D-10: Deterministic trace ID from taskId (Pitfall 3)
    const traceId = await createTraceId(opts.taskId);

    // D-12: One agent observation per invocation
    return (await startActiveObservation(
      'agent-' + opts.agentId,
      async (agentObs: { update: (data: Record<string, unknown>) => void }) => {
        // D-11: Agent metadata, soul excerpt first 3 lines
        agentObs.update({
          input: { prompt: opts.prompt.substring(0, 500) },
          metadata: {
            agentId: opts.agentId,
            department: opts.department,
            taskId: opts.taskId,
            runId: opts.runId,
            soulExcerpt: opts.soulMd.split('\n').slice(0, 3).join('\n'),
          },
        });

        // Pitfall 5: propagateAttributes MUST be inside startActiveObservation callback
        return propagateAttributes(
          {
            userId: 'founder',
            sessionId: opts.taskId,
            tags: [opts.department, opts.agentId],
            traceName: 'task-' + opts.taskId,
          },
          async () => {
            try {
              const result = await fn();
              agentObs.update({ output: { success: true } });
              return result;
            } catch (err) {
              agentObs.update({
                level: 'ERROR',
                statusMessage: String(err),
              });
              throw err;
            }
          },
        );
      },
      {
        asType: 'agent',
        parentSpanContext: {
          traceId,
          spanId: '0000000000000000',
          traceFlags: 1,
        },
      },
    )) as T;
  } catch (langfuseErr) {
    // D-09: If Langfuse itself errors (import fails, API issue), fall through
    log.warn({ err: langfuseErr }, 'Langfuse observation failed -- executing without tracing');
    return fn();
  }
}
