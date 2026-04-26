# Claude Agent SDK V2 Migration Feasibility Report

**Date:** 2026-04-06
**SDK Version:** 0.2.84
**Project:** Myelin v10 -- The Cortex

## Executive Summary

The Claude Agent SDK exposes a V2 session-based API (`unstable_v2_createSession`, `unstable_v2_resumeSession`, `unstable_v2_prompt`) alongside the current V1 `query()` async generator API. **V2 is marked `@alpha` with an `unstable_` prefix, signaling it is not production-ready.** While V2 offers a cleaner multi-turn abstraction (`send()/stream()`), it currently lacks critical features that Myelin v10 depends on -- most notably MCP server injection, structured output, subagent definitions, hooks, system prompt configuration, and budget controls. The recommendation is to **stay on V1** until V2 reaches feature parity and drops the unstable prefix.

## Current V1 Architecture

### How invoke-agent.ts Works

The core invocation wrapper (`src/lib/invoke-agent.ts`) uses V1's `query()` function, which returns a `Query` object extending `AsyncGenerator<SDKMessage, void>`. The flow:

1. **MCP Server Setup:** Creates a per-invocation MCP server via `buildCortexMcpServer()` with closure-bound tool context (task ID, run ID, desk/deliverable paths).

2. **Permission Control:** Builds a role-based `canUseTool` callback via `buildCanUseTool()` that restricts tool access per agent role and department.

3. **Query Options:** Constructs a comprehensive options object including:
   - `systemPrompt` with preset `claude_code` + appended soul.md
   - `cwd` set to agent's desk directory
   - `mcpServers` with the cortex MCP server (custom tools)
   - `allowedTools` restricted to `mcp__cortex__*`
   - `canUseTool` for fine-grained permission control
   - `permissionMode: 'acceptEdits'`
   - `maxBudgetUsd` for cost capping
   - `includePartialMessages: true` for SSE streaming
   - `resume` for session continuity
   - `outputFormat` for structured JSON responses (planning turns)
   - `agents` for subagent definitions (hired temp employees)
   - `hooks` for PreCompact memory save nudge (Tamir)
   - `plugins` for skill-creator plugin (Tamir)
   - `tools` override (empty array for LLM-only planning mode)

4. **Event Processing:** Iterates the async generator, handling 12+ message types:
   - `system:init` -- session ID capture, MCP status check
   - `system:api_retry` -- retry logging
   - `assistant` -- text extraction, tool use block parsing, activity logging
   - `stream_event` -- partial message forwarding to build log SSE
   - `tool_progress` -- tool execution status
   - `tool_use_summary` -- summarized tool actions
   - `system:files_persisted` -- file write tracking
   - `system:hook_started/progress/response` -- hook lifecycle
   - `system:local_command_output` -- shell output
   - `result:success` -- cost tracking, session storage, completion
   - `result:error` -- failure handling

5. **Resilience:** `invokeAgentWithResilience()` wraps with empty-response retry.

### Files That Import the SDK

| File | Import | Purpose |
|------|--------|---------|
| `src/lib/invoke-agent.ts` | `query`, 18+ types | Core invocation wrapper |
| `src/lib/orchestrator.ts` | `AgentDefinition`, `JsonSchemaOutputFormat` (types) | Agent registry |
| `src/lib/mcp/server.ts` | `createSdkMcpServer` | MCP server factory |
| `src/lib/mcp/tools/*.ts` (10 files) | `tool` | MCP tool definitions |

### Integration Points in Other Files

| File | SDK Feature Used | Notes |
|------|-----------------|-------|
| `src/lib/worker.ts` | `invokeAgent()` (indirect) | Background execution loop |
| `src/app/api/tasks/[taskId]/message/route.ts` | `orchestrator.invoke()` (indirect) | Planning conversation turns |
| `src/app/api/tasks/[taskId]/approve/route.ts` | triggers worker which uses `invokeAgent()` | Task approval -> execution |

## V1 vs V2 API Comparison

### Function Signatures

| Aspect | V1: `query()` | V2: `unstable_v2_createSession()` / `unstable_v2_resumeSession()` |
|--------|--------------|------------------------------------------------------------------|
| **Entry point** | `query({ prompt, options })` returns `Query` (AsyncGenerator) | `unstable_v2_createSession(options)` returns `SDKSession` |
| **Resume** | `query({ prompt, options: { resume: sessionId } })` | `unstable_v2_resumeSession(sessionId, options)` |
| **One-shot** | `query({ prompt, options })` + iterate to result | `unstable_v2_prompt(message, options)` returns `Promise<SDKResultMessage>` |
| **Send message** | Pass prompt at creation; or use `streamInput()` for multi-turn | `session.send(message)` |
| **Receive messages** | `for await (const msg of q) { ... }` | `for await (const msg of session.stream()) { ... }` |
| **Close** | `q.close()` | `session.close()` or `await using session = ...` |
| **Stability** | Stable, production API | `@alpha`, `unstable_` prefix |

### Options Comparison

| Option | V1 `Options` | V2 `SDKSessionOptions` | Notes |
|--------|-------------|----------------------|-------|
| `model` | Optional | **Required** | V2 requires explicit model selection |
| `pathToClaudeCodeExecutable` | Yes | Yes | Same |
| `env` | Yes | Yes | Same |
| `allowedTools` | Yes | Yes | Same |
| `disallowedTools` | Yes | Yes | Same |
| `canUseTool` | Yes | Yes | Same |
| `hooks` | Yes | Yes | Same |
| `permissionMode` | Yes (5 modes) | Yes (4 modes, no `bypassPermissions`) | V2 lacks bypass mode |
| **`systemPrompt`** | Yes (string or preset+append) | **NO** | **Critical gap** |
| **`cwd`** | Yes | **NO** | **Critical gap** |
| **`mcpServers`** | Yes (Record of configs) | **NO** | **Critical gap** |
| **`outputFormat`** | Yes (JSON schema) | **NO** | **Critical gap** |
| **`agents`** | Yes (subagent defs) | **NO** | **Critical gap** |
| **`maxBudgetUsd`** | Yes | **NO** | **Critical gap** |
| **`resume`** | Yes (session ID) | N/A (separate function) | Different pattern |
| **`tools`** | Yes (preset or array) | **NO** | **Critical gap** |
| **`plugins`** | Yes | **NO** | **Critical gap** |
| **`maxTurns`** | Yes | **NO** | Missing |
| **`includePartialMessages`** | Yes | **NO** | Missing |
| **`settingSources`** | Yes | **NO** | Missing |
| **`forkSession`** | Yes | **NO** | Missing |
| **`sandbox`** | Yes | **NO** | Missing |
| **`thinking`/`effort`** | Yes | **NO** | Missing |
| **`persistSession`** | Yes | **NO** | Missing |
| `executable` | Yes | Yes | Same |
| `executableArgs` | Yes | Yes | Same |

## Feature Parity Deep Dive

### 1. Tool Visibility (PreToolUse/PostToolUse Hooks)

**V1:** Full hook support via `options.hooks`. Myelin uses `PreCompact` hooks for Tamir's memory save nudge. The `canUseTool` callback provides pre-execution permission control. Activity logging captures tool calls from `SDKAssistantMessage` content blocks.

**V2:** `SDKSessionOptions` includes both `hooks` and `canUseTool` fields. These appear to have feature parity with V1 for this specific capability.

**Parity:** PARTIAL -- hooks and canUseTool are present, but since V2 lacks `mcpServers`, the tools being hooked would be limited to built-in tools only.

### 2. Structured Output (outputFormat with Zod Schemas)

**V1:** Full support via `options.outputFormat`. Myelin uses this extensively for planning turns -- the `AGENT_TURN_SCHEMA` constrains agent responses to structured JSON with `turn_type`, `message`, and `plan_markdown` fields. This is critical for the planning conversation flow.

**V2:** `SDKSessionOptions` does **not** include `outputFormat`. There is no alternative mechanism for structured output in V2.

**Parity:** NONE -- V2 cannot produce structured output. This alone blocks migration for planning turns.

### 3. Session Persistence and Resume

**V1:** Session resume via `options.resume` (pass session ID). Session IDs are captured from `SDKSystemMessage.session_id` during the init event. Myelin stores these in `task_runs.sessionId` for continuity. The `forkSession` option allows branching conversations.

**V2:** Dedicated `unstable_v2_resumeSession()` function creates a session handle from an existing session ID. The `SDKSession.sessionId` property provides the ID. This is architecturally cleaner than V1's resume-via-options pattern.

**Parity:** PARTIAL -- V2 has a cleaner resume model but lacks `forkSession`, `persistSession`, and `resumeSessionAt` capabilities.

### 4. Cost Tracking (Input/Output Token Counts)

**V1:** Cost data arrives in the `SDKResultSuccess` message: `total_cost_usd`, `usage` (input/output tokens), `modelUsage` (per-model breakdown), `duration_ms`, `num_turns`. Myelin records these to `cost_events` table and `employees.budgetSpent`.

**V2:** `SDKSession.stream()` emits the same `SDKMessage` union type, which includes `SDKResultSuccess`. The result message should still contain cost data.

**Parity:** LIKELY FULL -- V2 streams the same message types. However, this is untested since `maxBudgetUsd` is not available in V2, and budget-exceeded error handling cannot be replicated.

### 5. MCP Server Integration (Custom Tools)

**V1:** Full support via `options.mcpServers`. Myelin creates a per-invocation MCP server (`buildCortexMcpServer()`) with 12+ custom tools (read_memory, write_memory, promote_to_deliverable, escalate_to_ceo, submit_for_review, install_tool, etc.). These are the primary tools agents use.

**V2:** `SDKSessionOptions` does **not** include `mcpServers`. There is no mechanism to inject custom MCP servers into a V2 session.

**Parity:** NONE -- V2 cannot use custom MCP tools. This is the most critical gap. Without MCP server injection, agents cannot access any Myelin-specific capabilities (memory, deliverables, escalation, reviews, skills, vault, knowledge base).

### 6. Subagent Support (Department Heads Spawning Temp Employees)

**V1:** Full support via `options.agents` (Record of `AgentDefinition`). Myelin uses this when a task run includes hired temp employees -- the `agents` field is populated from `task_runs.agents` JSON column. Each subagent gets its own description, prompt, tools, and optional model override.

**V2:** `SDKSessionOptions` does **not** include `agents`. There is no mechanism to define subagents in a V2 session.

**Parity:** NONE -- V2 cannot spawn subagents.

### 7. Streaming Events (SDKMessage Types for SSE to Cortex UI)

**V1:** The `Query` async generator yields `SDKMessage` events that Myelin forwards to the Cortex UI via `eventBus.emit('task:buildlog', ...)`. This provides real-time build log updates including tool calls, assistant text, tool progress, and tool summaries.

**V2:** `SDKSession.stream()` returns `AsyncGenerator<SDKMessage, void>` -- the same message type. The streaming model is structurally identical.

**Parity:** FULL -- same message types, same async generator pattern.

## Stability Concerns

### The `unstable_` Prefix

The V2 functions carry an explicit `unstable_` prefix and `@alpha` JSDoc tag. This signals:

1. **API will change.** The function signatures, option types, and behavior may change in any SDK release without semver major version bump.
2. **Not production-tested.** Alpha APIs have not undergone the same level of production validation as stable APIs.
3. **May be removed.** Alpha APIs can be dropped entirely if the approach doesn't work out.
4. **No migration path guarantee.** Code written against `unstable_v2_*` may need significant rewrites when (if) the API stabilizes.

### What V2 Appears Designed For

Based on the lean `SDKSessionOptions` type (only model, executable, env, permissions, hooks, tools control), V2 appears to be designed for **lightweight conversational sessions** -- think chatbot interactions or simple prompt/response workflows. It is not yet designed for the kind of **heavily configured agent execution** that Myelin requires.

The `bridge.d.ts` file reveals a parallel "bridge" transport layer (`BridgeSessionHandle`) designed for claude.ai remote session management. V2 may be evolving toward a cloud-hosted session model where configuration lives server-side rather than in client options.

## Hybrid Approach Analysis

### Concept: V1 for Execution, V2 for Planning

The idea: use V2's cleaner multi-turn `send()/stream()` pattern for planning conversations (CEO <-> agent back-and-forth) while keeping V1's `query()` for task execution (where full tool access, MCP servers, and subagents are needed).

### Why This Does Not Work

1. **Planning turns require `outputFormat`:** The `AGENT_TURN_SCHEMA` forces structured JSON responses (`turn_type`, `message`, `plan_markdown`). V2 lacks `outputFormat`. Without it, we'd need regex parsing of LLM output -- explicitly forbidden by CLAUDE.md ("Never parse LLM output with regex").

2. **Planning turns require `systemPrompt`:** The soul.md + memory snapshots are injected via `systemPrompt: { type: 'preset', preset: 'claude_code', append: soulMd }`. V2 has no system prompt configuration.

3. **Planning turns require `cwd`:** Agents need a working directory set to the planning desk. V2 has no `cwd` option.

4. **Planning turns require session resume:** Conversation continuity uses `options.resume` with stored session IDs. While V2 has `unstable_v2_resumeSession()`, the session was originally created by V1's `query()`. Cross-API session compatibility is undocumented and untested.

5. **Planning turns use `tools: []`:** LLM-only mode (no tool execution during planning) is set via `options.tools`. V2 lacks this option.

6. **Two code paths increase complexity:** Maintaining both V1 and V2 invocation paths doubles the surface area for bugs, testing, and SDK upgrade friction.

**Verdict:** Hybrid is not feasible. V2 lacks too many features even for the simpler planning use case.

## Migration Effort Estimate

### If V2 Reached Full Feature Parity

Assuming V2 eventually supports all options currently in V1, the migration would involve:

| File | Changes Required | Complexity |
|------|-----------------|------------|
| `src/lib/invoke-agent.ts` | Replace `query()` with `unstable_v2_createSession()` + `send()` + `stream()`. Restructure event loop from single-prompt iteration to session lifecycle. | **High** -- this is 660 lines of carefully tuned event handling |
| `src/lib/orchestrator.ts` | Update type imports if option types change | **Low** |
| `src/lib/worker.ts` | No direct SDK imports; changes flow through invoke-agent | **None** |
| `src/app/api/tasks/[taskId]/message/route.ts` | No direct SDK imports; changes flow through orchestrator | **None** |
| `src/lib/mcp/server.ts` | `createSdkMcpServer` may need updates if V2 changes MCP patterns | **Unknown** |
| `src/lib/mcp/tools/*.ts` (10 files) | `tool()` helper unlikely to change | **Low** |

**Estimated total effort:** 2-4 days of focused work, primarily on `invoke-agent.ts`.

**Risk areas:**
- Session lifecycle differs (V1: one-shot prompt -> iterate; V2: create session -> send -> stream independently)
- Error handling patterns may differ
- Cost tracking message format may change
- Session resume compatibility between V1-created and V2-resumed sessions
- The `Query` interface methods (`interrupt()`, `setPermissionMode()`, etc.) used via `query-registry.ts` for hot-reload would need V2 equivalents

## Recommendation

### Stay on V1

**Rationale:**

1. **V2 is missing 10+ critical features** that Myelin depends on (MCP servers, structured output, system prompt, cwd, agents, budget, tools, plugins, partial messages, settings sources). These are not nice-to-haves -- they are foundational to how the agent system works.

2. **V2 is explicitly unstable.** The `unstable_` prefix and `@alpha` tag mean the API will change. Building on it now means guaranteed rewrites later.

3. **V1 is working.** The current implementation handles 12+ message types, 4 agent roles, planning/execution modes, session resume, cost tracking, and MCP tool integration. It is battle-tested in this codebase.

4. **No compelling V2 benefit for this project.** V2's main advantage -- cleaner multi-turn `send()/stream()` -- is useful for chatbot UIs but adds no value for Myelin's architecture where each invocation is a single prompt with full context, and multi-turn is handled by session resume.

5. **Migration risk is real.** `invoke-agent.ts` is 660 lines of event handling code that works correctly. Rewriting it for V2 introduces regression risk in a critical path (agent execution).

### When to Reassess

Monitor SDK releases for:
- V2 `SDKSessionOptions` gaining `mcpServers`, `outputFormat`, `systemPrompt`, `cwd`, `agents`, `maxBudgetUsd`
- The `unstable_` prefix being dropped (promotion to stable)
- Deprecation warnings on V1 `query()`
- SDK changelog entries about V2 feature parity

Until then, V1 is the correct choice for Myelin v10.

## Appendix: Key Code References

### V1 query() Invocation Pattern (invoke-agent.ts)

```typescript
const queryOptions: Parameters<typeof query>[0]['options'] = {
  pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH,
  systemPrompt: { type: 'preset', preset: 'claude_code', append: opts.soulMd },
  cwd: opts.deskDir,
  mcpServers: { cortex: cortexServer },
  allowedTools: ['mcp__cortex__*'],
  canUseTool,
  permissionMode: 'acceptEdits',
  maxBudgetUsd: opts.maxBudgetUsd,
  includePartialMessages: true,
  resume: opts.sessionId,
  settingSources: ['project'],
  // ...
};

const q = query({ prompt: opts.prompt, options: queryOptions });
for await (const msg of q) {
  // Handle 12+ message types...
}
```

### V2 Session Pattern (hypothetical)

```typescript
// V2 equivalent -- NOT POSSIBLE TODAY due to missing options
const session = unstable_v2_createSession({
  model: 'claude-sonnet-4-6',
  // NO systemPrompt
  // NO cwd
  // NO mcpServers
  // NO outputFormat
  // NO agents
  // NO maxBudgetUsd
  // NO tools
  // NO plugins
  // NO includePartialMessages
  // NO settingSources
});

await session.send(prompt);
for await (const msg of session.stream()) {
  // Same SDKMessage types, but session lacks configuration
}
```

### Structured Output for Planning (message/route.ts)

```typescript
result = await orchestrator.invoke({
  taskId: params.taskId,
  runId,
  agentId,
  prompt: agentPrompt,
  deskDir: planningDeskDir,
  delivDir: tmpDelivDir,
  manifestPath: tmpManifestPath,
  outputFormat: AGENT_TURN_SCHEMA,  // V2 has no equivalent
  maxBudgetUsd: 2,                  // V2 has no equivalent
  sessionId: planningSessionId,     // V2 uses separate function
});
```

### Hook Configuration for Tamir (invoke-agent.ts)

```typescript
if (opts.agentId === 'tamir') {
  queryOptions!.plugins = [{
    type: 'local' as const,
    path: dataPath('departments', 'cos', 'skills', 'skill-creator'),
  }];

  queryOptions!.hooks = {
    PreCompact: [{
      hooks: [async (_input, _toolUseId, _options) => ({
        continue: true,
        systemMessage: '[System: Context is being compacted...]',
      })],
    }],
  };
}
```

---

*Report generated from SDK v0.2.84 type definitions. All findings are based on the declared public API surface, not internal implementation details.*
