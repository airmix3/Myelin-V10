# Phase 5: Langfuse Integration - Research

**Researched:** 2026-03-27
**Domain:** LLM observability / tracing (Langfuse SDK v5 + OpenTelemetry)
**Confidence:** HIGH

## Summary

Langfuse SDK v5 (released March 2026) was a complete rewrite from the previous low-level API (`new Langfuse()` with `.trace()/.span()/.generation()`) to an OpenTelemetry-native architecture. The SDK is now split across three packages: `@langfuse/tracing` (observation API), `@langfuse/otel` (span processor/exporter), and `@langfuse/client` (REST API client for prompts/datasets -- not needed for Phase 5).

The key integration pattern is: initialize an OpenTelemetry `NodeSDK` with `LangfuseSpanProcessor` once at startup, then use `startActiveObservation()` / `startObservation()` to create trace hierarchies. The SDK has first-class `agent` and `tool` observation types that map perfectly to Myelin's agent invocations and MCP tool calls. Trace metadata (userId, sessionId, tags) is propagated via `propagateAttributes()` context wrapper. Traces are batched and flushed async in the background with zero performance impact.

**Primary recommendation:** Use `@langfuse/tracing@5.0.1` + `@langfuse/otel@5.0.1` + `@opentelemetry/sdk-node` with `LangfuseSpanProcessor`. Initialize in `instrumentation.ts` as a singleton. Wrap `invokeAgent()` with `startActiveObservation()` using `asType: 'agent'`. Use `createTraceId(taskId)` for deterministic trace-task correlation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Primary value is trace visualization -- hierarchical trace trees showing agent -> tool -> LLM call nesting
- **D-02:** Secondary value is cost analytics dashboard -- aggregate views (trends, cost by agent/department)
- **D-03:** Not using prompt management, datasets/evals, or feedback collection
- **D-04:** Trace all invocations -- both planning and execution
- **D-05:** Trace retention: 90 days. Auto-purge older traces.
- **D-06:** Use Langfuse Cloud SaaS (cloud.langfuse.com). Free tier: 50K trace events/month.
- **D-07:** Initialize Langfuse SDK in instrumentation.ts bootstrap (singleton survives HMR)
- **D-08:** Tracing active when API keys present -- `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`
- **D-09:** Fail silently if Langfuse Cloud API unavailable
- **D-10:** Trace structure: one trace per task (taskId = trace ID). All agent invocations for that task are spans within one trace.
- **D-11:** Capture LLM generations, tool calls, agent metadata, task metadata
- **D-12:** One span per agent invocation = one `invokeAgent()` call
- **D-13:** Performance: SDK background queue (batched async)
- **D-14:** Langfuse is developer tool -- no CEO access via Cortex UI
- **D-15:** Minimal UI: "Observability: Active" badge in settings page

### Claude's Discretion
- Exact Langfuse SDK initialization code in instrumentation.ts
- Span metadata schema (which fields from Task model to attach)
- How to extract/attach soul.md excerpt per span (first N lines? summary?)
- Error handling detail level (log warnings to Pino, activity_log, or both?)
- Settings page badge styling (color, icon, placement)

### Deferred Ideas (OUT OF SCOPE)
- Datasets & evaluations
- Custom trace viewer in Cortex (fetch via Langfuse API and render custom UI)
- Prompt management in Langfuse
- Embedded iframe of Langfuse dashboard in Cortex
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @langfuse/tracing | 5.0.1 | Observation API (startActiveObservation, startObservation, propagateAttributes) | Official Langfuse SDK v5 tracing package. Provides `LangfuseAgent`, `LangfuseTool`, `LangfuseGeneration` observation types matching Myelin's agent/tool/LLM hierarchy. |
| @langfuse/otel | 5.0.1 | OpenTelemetry span processor/exporter to Langfuse Cloud | `LangfuseSpanProcessor` batches spans and exports async. Handles auth, retry, media upload. |
| @opentelemetry/sdk-node | 0.214.0 | OpenTelemetry Node.js SDK | Required runtime for `LangfuseSpanProcessor`. Provides `NodeSDK` class for registration. |
| @opentelemetry/api | 1.9.1 | OpenTelemetry API (peer dependency) | Required by both @langfuse/tracing and @opentelemetry/sdk-node. Context propagation, span interface. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @langfuse/client | 5.0.1 | REST API client for Langfuse platform | NOT needed for Phase 5 (tracing only). Would be needed if we added score/dataset features later. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @langfuse/tracing v5 | langfuse v3 (legacy) | v3 had simpler `new Langfuse().trace()` API but is deprecated. v5 is OTel-native with richer type system (agent, tool, generation types). v5 is the correct choice. |
| @opentelemetry/sdk-node | Manual OTel setup | NodeSDK simplifies TracerProvider + SpanProcessor registration. No benefit to manual setup. |

**Installation:**
```bash
pnpm add @langfuse/tracing@5.0.1 @langfuse/otel@5.0.1 @opentelemetry/sdk-node@0.214.0 @opentelemetry/api@1.9.1
```

**Version verification:** All versions verified against npm registry on 2026-03-27. `@langfuse/tracing`, `@langfuse/otel`, and `@langfuse/client` are all at 5.0.1 (latest). `@opentelemetry/sdk-node` requires `@opentelemetry/api` in range `>=1.3.0 <1.10.0` -- 1.9.1 satisfies this.

## Architecture Patterns

### Recommended Integration Points
```
src/
  instrumentation.ts     # Add OTel NodeSDK + LangfuseSpanProcessor init (Step 6.5)
  lib/
    langfuse.ts          # NEW: Langfuse singleton, helper functions, conditional init
    invoke-agent.ts      # MODIFY: Wrap query() in startActiveObservation
  app/
    settings/page.tsx    # MODIFY: Add observability status badge
    api/system/info/route.ts  # MODIFY: Include langfuse status in system info
```

### Pattern 1: OTel NodeSDK Initialization in instrumentation.ts
**What:** Initialize OpenTelemetry with LangfuseSpanProcessor as a singleton at server boot.
**When to use:** Once, at startup, before any agent invocations.
**Key consideration:** The OTel NodeSDK must start BEFORE any traces are created. Place it early in the instrumentation.ts bootstrap sequence (after FTS5 init, before worker loop).

```typescript
// Source: @langfuse/otel + @opentelemetry/sdk-node type definitions
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

// Conditional: only init if keys present (D-08)
const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const secretKey = process.env.LANGFUSE_SECRET_KEY;

if (publicKey && secretKey) {
  const sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey,
        secretKey,
        baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
        exportMode: 'batched',  // D-13: background queue
        environment: 'development',
      })
    ],
  });
  sdk.start();
  // Store reference for shutdown
  (globalThis as any).__langfuseOtelSdk = sdk;
}
```

### Pattern 2: Agent Invocation Tracing with startActiveObservation
**What:** Wrap each `invokeAgent()` call in a Langfuse observation that captures the full invocation lifecycle.
**When to use:** Every time `invokeAgent()` is called.

```typescript
// Source: @langfuse/tracing type definitions (v5.0.1)
import { startActiveObservation, propagateAttributes, createTraceId } from '@langfuse/tracing';

// D-10: One trace per task, taskId = trace ID (deterministic)
const traceId = await createTraceId(opts.taskId);

// D-12: One span per agent invocation
const result = await startActiveObservation(
  `agent-${opts.agentId}`,  // observation name
  async (agentObs) => {
    // Set agent metadata (D-11)
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

    // Propagate trace-level attributes (userId, sessionId, tags)
    return await propagateAttributes({
      userId: 'founder',  // single-user system
      sessionId: opts.taskId,
      tags: [opts.department, opts.agentId],
      traceName: `task-${opts.taskId}`,
    }, async () => {
      // ... existing invokeAgent logic ...
      // SDK query() call, message iteration, etc.
    });
  },
  {
    asType: 'agent',
    parentSpanContext: {
      traceId,
      spanId: '0000000000000000',  // root span
      traceFlags: 1,
    },
  }
);
```

### Pattern 3: Generation and Tool Observation Nesting
**What:** Record LLM generations and tool calls as child observations within agent spans.
**When to use:** Inside the `invokeAgent()` message iteration loop.

```typescript
// Source: @langfuse/tracing type definitions (v5.0.1)
// Inside the agent observation callback, when processing SDK messages:

// For result messages with cost data (D-11: LLM generations)
if (msg.type === 'result' && msg.subtype === 'success') {
  const gen = agentObs.startObservation('llm-generation', {
    model: Object.keys(result.modelUsage)[0] ?? 'unknown',
    usageDetails: {
      promptTokens: modelStats?.inputTokens ?? 0,
      completionTokens: modelStats?.outputTokens ?? 0,
    },
    costDetails: {
      totalCost: result.total_cost_usd,
    },
    output: result.result?.substring(0, 1000),
  }, { asType: 'generation' });
  gen.end();
}

// For tool use summary messages (D-11: Tool calls)
if (msg.type === 'tool_use_summary') {
  const toolObs = agentObs.startObservation(summaryMsg.summary, {
    metadata: { agentId: opts.agentId },
  }, { asType: 'tool' });
  toolObs.end();
}
```

### Pattern 4: Conditional Tracing Module
**What:** A module that exports no-op functions when Langfuse keys are absent, and real tracing functions when present.
**When to use:** All tracing call sites import from this module, never directly from @langfuse/tracing.

```typescript
// src/lib/langfuse.ts
// Singleton + conditional activation pattern matching existing eventBus/sqlite patterns

const isEnabled = !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);

export function isLangfuseEnabled(): boolean {
  return isEnabled;
}

// Re-export tracing functions conditionally, or provide no-ops
// This keeps invoke-agent.ts clean -- it always calls the same API
```

### Anti-Patterns to Avoid
- **Importing @langfuse/tracing at module top-level unconditionally:** This will fail if OTel SDK is not initialized. Always check `isLangfuseEnabled()` or use conditional dynamic imports.
- **Creating a new NodeSDK per request:** Must be singleton. Multiple NodeSDK instances will corrupt trace context.
- **Calling sdk.shutdown() on each request:** Only call on process exit. Shutdown flushes and terminates -- cannot restart.
- **Using legacy `langfuse` package (v3):** Completely different API, deprecated. Use `@langfuse/tracing` v5.
- **Setting parentSpanContext with the task_run ID as spanId:** spanId must be 16-char hex. Use `createTraceId()` for deterministic traceId from taskId.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trace batching/flushing | Custom batch queue with timers | `LangfuseSpanProcessor` with `exportMode: 'batched'` | Handles retry, backoff, batch size, flush intervals. Edge cases around process shutdown, partial batches. |
| Trace ID generation | Custom hash function for taskId->traceId | `createTraceId(seed)` from `@langfuse/tracing` | Deterministic 32-char hex from seed string. Handles crypto hashing correctly for OTel format. |
| Context propagation | Manual trace/span ID threading | `propagateAttributes()` + OTel context | OTel handles async context propagation across Promises. Manual threading breaks in async flows. |
| Span hierarchy | Parent-child tracking with Map | `startActiveObservation()` context manager | Automatic OTel context nesting. Parent-child relationships set correctly even across async boundaries. |

**Key insight:** The Langfuse SDK v5 delegates all distributed tracing mechanics to OpenTelemetry. Fighting OTel's context model by hand-rolling hierarchy will produce broken traces.

## Common Pitfalls

### Pitfall 1: OTel SDK Must Initialize Before Any Traces
**What goes wrong:** Traces created before `sdk.start()` are silently lost.
**Why it happens:** OTel has no global trace buffer -- if no SpanProcessor is registered, spans are dropped.
**How to avoid:** Initialize NodeSDK early in `instrumentation.ts` -- specifically before the worker loop starts (worker invokes agents immediately).
**Warning signs:** Traces appear in logs but not in Langfuse Cloud.

### Pitfall 2: NodeSDK Singleton on HMR
**What goes wrong:** Next.js HMR re-runs instrumentation.ts, creating duplicate NodeSDK instances.
**Why it happens:** `instrumentation.ts` already has a singleton guard (`globalThis.__myelinInit`), but OTel's global TracerProvider registration can conflict.
**How to avoid:** Store the NodeSDK instance on `globalThis.__langfuseOtelSdk` and check before creating a new one. Alternatively, use `setLangfuseTracerProvider()` for an isolated provider that doesn't conflict with the global.
**Warning signs:** Duplicate traces or "TracerProvider already registered" warnings.

### Pitfall 3: Trace ID Format Requirements
**What goes wrong:** Using raw taskId (e.g., `task_a1b2c3d4`) as traceId causes Langfuse to reject the trace.
**Why it happens:** OTel trace IDs must be 32-character lowercase hex strings. Myelin task IDs have a prefix + underscore.
**How to avoid:** Use `createTraceId(taskId)` which hashes the seed into a valid 32-char hex trace ID. This is deterministic -- same taskId always produces same traceId, enabling correlation.
**Warning signs:** Empty traces in Langfuse, errors about invalid trace format.

### Pitfall 4: Async Context Loss in SDK subprocess
**What goes wrong:** The Claude Agent SDK runs as a subprocess (`query()` spawns a child process). OTel context does NOT propagate into child processes.
**Why it happens:** OTel context is in-process (AsyncLocalStorage). The SDK's internal LLM calls happen in a separate process.
**How to avoid:** Accept this limitation. We can trace the `invokeAgent()` call as a single agent observation with start/end time, cost, and result -- but we CANNOT see individual LLM calls within the SDK subprocess. Record the aggregate generation data from the SDK result message (tokens, cost, model). This is sufficient for D-01 (hierarchical visualization) at the invokeAgent granularity level.
**Warning signs:** Expecting per-LLM-call granularity inside the SDK subprocess -- this is architecturally impossible without SDK-level instrumentation.

### Pitfall 5: propagateAttributes Must Wrap the Entire Traced Block
**What goes wrong:** Calling `propagateAttributes()` outside the `startActiveObservation()` callback means attributes don't reach child spans.
**Why it happens:** OTel context is scope-based. Attributes set in one scope don't leak into sibling scopes.
**How to avoid:** Call `propagateAttributes()` inside the `startActiveObservation()` callback, wrapping all child operations.
**Warning signs:** Traces visible in Langfuse but missing userId/sessionId/tags.

### Pitfall 6: @opentelemetry/api Version Mismatch
**What goes wrong:** Multiple copies of `@opentelemetry/api` cause "NoopTracer" behavior -- traces silently go nowhere.
**Why it happens:** OTel API uses a singleton pattern via `globalThis`. If two different versions are loaded, one becomes the "real" one and the other is a no-op.
**How to avoid:** Pin `@opentelemetry/api@1.9.1` explicitly. Run `pnpm why @opentelemetry/api` after install to verify single copy.
**Warning signs:** Everything initializes without errors but zero traces appear in Langfuse.

## Code Examples

### Complete Langfuse Module (src/lib/langfuse.ts)
```typescript
// Source: Composed from @langfuse/tracing + @langfuse/otel type definitions
import { logger } from './logger';

const log = logger.child({ module: 'langfuse' });

// Check once at module load
const LANGFUSE_ENABLED = !!(
  process.env.LANGFUSE_PUBLIC_KEY &&
  process.env.LANGFUSE_SECRET_KEY
);

export function isLangfuseEnabled(): boolean {
  return LANGFUSE_ENABLED;
}

/**
 * Initialize OTel + Langfuse. Call once from instrumentation.ts.
 * No-op if keys not present.
 */
export async function initLangfuse(): Promise<void> {
  if (!LANGFUSE_ENABLED) {
    log.info('Langfuse tracing disabled (no API keys)');
    return;
  }

  const g = globalThis as any;
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
```

### Agent Observation Wrapper
```typescript
// Source: @langfuse/tracing v5.0.1 type definitions
import { startActiveObservation, propagateAttributes, createTraceId } from '@langfuse/tracing';
import { isLangfuseEnabled } from './langfuse';

// If Langfuse disabled, just run the function directly
// If enabled, wrap in observation
async function withAgentObservation<T>(
  opts: { taskId: string; agentId: string; department: string; soulMd: string; prompt: string },
  fn: () => Promise<T>
): Promise<T> {
  if (!isLangfuseEnabled()) return fn();

  const traceId = await createTraceId(opts.taskId);

  return startActiveObservation(
    `agent-${opts.agentId}`,
    async (agentObs) => {
      agentObs.update({
        input: { prompt: opts.prompt.substring(0, 500) },
        metadata: {
          agentId: opts.agentId,
          department: opts.department,
          taskId: opts.taskId,
          soulExcerpt: opts.soulMd.split('\n').slice(0, 3).join('\n'),
        },
      });

      return propagateAttributes({
        userId: 'founder',
        sessionId: opts.taskId,
        tags: [opts.department, opts.agentId],
        traceName: `task-${opts.taskId}`,
      }, async () => {
        try {
          const result = await fn();
          agentObs.update({ output: { success: true } });
          return result;
        } catch (err) {
          agentObs.update({ level: 'ERROR', statusMessage: String(err) });
          throw err;
        }
      });
    },
    {
      asType: 'agent',
      parentSpanContext: { traceId, spanId: '0000000000000000', traceFlags: 1 },
    }
  ) as Promise<T>;
}
```

### Settings Page Badge
```typescript
// Source: Existing settings/page.tsx pattern + CONTEXT.md D-15
// Add to system info API response:
{ langfuseStatus: process.env.LANGFUSE_PUBLIC_KEY ? 'active' : 'inactive' }

// In settings page JSX:
<div>
  <span style={{ color: 'var(--text-dim)' }}>Observability</span>
  <div style={{ fontWeight: 'bold' }}>
    <span style={{
      display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
      background: systemInfo?.langfuseStatus === 'active' ? 'var(--green)' : 'var(--text-muted)',
      marginRight: '4px'
    }} />
    {systemInfo?.langfuseStatus === 'active' ? 'Active' : 'Inactive'}
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `langfuse` package v3 (`new Langfuse().trace().span()`) | `@langfuse/tracing` v5 (OTel-native, `startActiveObservation`) | March 2026 (v5 rewrite) | Completely different API. v3 patterns will NOT work. Must use v5 OTel-based approach. |
| Manual trace hierarchy management | OTel automatic context propagation | v5 | No need to pass parent IDs manually. `startActiveObservation` nests automatically. |
| `Langfuse.flush()` manual flushing | `LangfuseSpanProcessor` auto-batching | v5 | Processor handles batching, flush intervals, retry. Only need `sdk.shutdown()` on process exit. |

**Deprecated/outdated:**
- `langfuse` npm package (v3.38.6): Legacy API, fully replaced by `@langfuse/tracing` + `@langfuse/otel` in v5.
- `@langfuse/node`: Removed/merged into `@langfuse/tracing`.
- `langfuse.trace()` / `langfuse.span()` / `langfuse.generation()`: Old API. Use `startObservation()` / `startActiveObservation()` instead.

## Open Questions

1. **Claude Agent SDK subprocess LLM call visibility**
   - What we know: The SDK subprocess makes LLM calls internally. OTel context does NOT cross process boundaries. We can only observe the outer invokeAgent() call.
   - What's unclear: Whether the SDK will ever emit OTel-compatible spans that could be captured by the parent process.
   - Recommendation: Accept this limitation. Capture aggregate token/cost data from SDK result messages as a single generation observation. This still provides hierarchical traces at the agent/task level, which is the primary value (D-01).

2. **OTel NodeSDK + Next.js HMR interaction**
   - What we know: The existing singleton guard in instrumentation.ts prevents double-init. OTel's global TracerProvider can be registered only once.
   - What's unclear: Whether HMR causes the NodeSDK to lose its SpanProcessor registrations.
   - Recommendation: Use `setLangfuseTracerProvider()` from `@langfuse/tracing` to set an isolated provider if global registration conflicts arise. Test during development.

3. **createTraceId determinism across restarts**
   - What we know: `createTraceId(seed)` is deterministic -- same seed always produces same trace ID.
   - What's unclear: Whether multiple agent invocations for the same task will create separate traces or merge into one.
   - Recommendation: Use `createTraceId(taskId)` for the parent trace, and let each `startActiveObservation()` call create child spans within that trace via `parentSpanContext`. Multiple invocations for the same task naturally nest under the same trace.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | @langfuse/tracing requires Node 20+ | Verify at install | 22.x (per @types/node) | -- |
| Langfuse Cloud | Trace export destination | External SaaS | -- | Silent disable (D-09) |
| LANGFUSE_PUBLIC_KEY | SDK auth | User must configure | -- | Tracing disabled (D-08) |
| LANGFUSE_SECRET_KEY | SDK auth | User must configure | -- | Tracing disabled (D-08) |

**Missing dependencies with no fallback:**
- None. All Langfuse dependencies are soft -- system works without them (D-08, D-09).

**Missing dependencies with fallback:**
- Langfuse API keys: If not configured, tracing silently disables. System functions normally.

## Project Constraints (from CLAUDE.md)

- **TypeScript/Node.js only** -- all Langfuse integration code in TypeScript
- **CSS: Custom CSS variables only** -- settings page badge uses cortex.css variables (--green, --text-muted)
- **No Tailwind/Bootstrap** -- badge styled with inline styles + CSS variables, matching existing pattern
- **SQLite via Prisma** -- Phase 5 adds NO new database tables (traces live in Langfuse Cloud)
- **SDK First** -- use Langfuse SDK built-ins (OTel processors, observation API), not custom transport
- **Pino logging** -- Langfuse errors logged via Pino child logger
- **Next.js 14** -- OTel SDK init in instrumentation.ts (stable hook in 14.2+)
- **pnpm** -- install packages with pnpm

## Sources

### Primary (HIGH confidence)
- `@langfuse/tracing@5.0.1` dist/index.d.ts -- Complete TypeScript type definitions. Full API: `startActiveObservation`, `startObservation`, `propagateAttributes`, `createTraceId`, `observe`, all observation types (LangfuseAgent, LangfuseTool, LangfuseGeneration, etc.)
- `@langfuse/otel@5.0.1` dist/index.d.ts -- `LangfuseSpanProcessor` constructor params, export modes, masking, filtering
- `@langfuse/core@5.0.1` dist/index.d.ts -- `PropagateAttributesParams` type (userId, sessionId, tags, metadata, traceName, version)
- npm registry (2026-03-27) -- All version numbers verified live
- langfuse.com/docs/sdk/typescript -- SDK guide confirming OTel-based architecture, NodeSDK init pattern

### Secondary (MEDIUM confidence)
- langfuse.com/docs/get-started -- Getting started guide with init and trace examples
- github.com/langfuse/langfuse-js README -- Confirmed v5 rewrite in March 2026, modular package structure

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All versions verified from npm registry and type definitions inspected locally
- Architecture: HIGH -- Patterns derived from type definitions and official docs, confirmed by CONTEXT.md integration points
- Pitfalls: HIGH -- Pitfalls 1-3, 5-6 from OTel documentation/known issues. Pitfall 4 (subprocess context) from architectural analysis of how Claude Agent SDK query() works.

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (30 days -- SDK v5 is newly released, stable API expected)
