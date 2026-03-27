/**
 * invokeAgent() -- Core wrapper around Claude Agent SDK query().
 * Per AGENT-01: creates per-invocation MCP server, streams events to SSE,
 * tracks cost, stores session for resume.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  SDKMessage,
  SDKSystemMessage,
  SDKAPIRetryMessage,
  SDKAssistantMessage,
  SDKResultSuccess,
  SDKResultError,
  SDKToolUseSummaryMessage,
  AgentDefinition,
  JsonSchemaOutputFormat,
} from '@anthropic-ai/claude-agent-sdk';
import { buildMyelinMcpServer } from '@/lib/mcp/server';
import { createToolContext } from '@/lib/mcp/tool-context';
import { buildCanUseTool } from '@/lib/mcp/access-control';
import { eventBus } from '@/lib/events';
import { sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { logger } from '@/lib/logger';
import { withAgentObservation } from '@/lib/langfuse';

export interface InvokeAgentOptions {
  taskId: string;
  runId: string;
  agentId: string;
  department: string;
  prompt: string;
  soulMd: string;
  deskDir: string;
  delivDir: string;
  manifestPath: string;
  sessionId?: string;
  maxBudgetUsd?: number;
  outputFormat?: JsonSchemaOutputFormat;
  agents?: Record<string, AgentDefinition>;
  /** Restrict available built-in tools. `[]` disables all built-in tools (LLM-only mode).
   *  Omit to use full Claude Code preset (default for execution runs). */
  tools?: string[] | { type: 'preset'; preset: 'claude_code' };
}

export interface InvokeAgentResult {
  sessionId: string;
  totalCostUsd: number;
  result?: string;
  structuredOutput?: unknown;
}

export async function invokeAgent(opts: InvokeAgentOptions): Promise<InvokeAgentResult> {
  const log = logger.child({ module: 'invoke-agent', taskId: opts.taskId, agentId: opts.agentId });

  // 1. Create per-invocation ToolContext (closure-bound isolation)
  const ctx = createToolContext({
    taskId: opts.taskId,
    agentId: opts.agentId,
    department: opts.department,
    deskDir: opts.deskDir,
    delivDir: opts.delivDir,
    manifestPath: opts.manifestPath,
  });

  // 2. Create fresh MCP server for this invocation
  const myelinServer = buildMyelinMcpServer(ctx);

  // 3. Create role-based access control callback
  const canUseTool = buildCanUseTool(opts.agentId, opts.department, {
    deskDir: opts.deskDir,
    delivDir: opts.delivDir,
  });

  log.info({ deskDir: opts.deskDir, sessionId: opts.sessionId ?? 'new' }, 'Starting agent invocation');

  // 4. Build query options
  const queryOptions: Parameters<typeof query>[0]['options'] = {
    pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH ?? '/home/omersh/.npm-global/bin/claude',
    systemPrompt: { type: 'preset', preset: 'claude_code', append: opts.soulMd },
    cwd: opts.deskDir,
    mcpServers: { myelin: myelinServer },
    allowedTools: ['mcp__myelin__*'],
    canUseTool,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    maxBudgetUsd: opts.maxBudgetUsd ?? 10,
    includePartialMessages: true,
    resume: opts.sessionId,
    settingSources: [],
    env: {
      ...process.env as Record<string, string>,
      CLAUDE_CODE_USE_BEDROCK: '1',
      CLAUDE_CODE_STREAM_CLOSE_TIMEOUT: '120000',
    },
  };

  // Restrict built-in tools when specified (e.g., planning turns use tools: [] for LLM-only mode)
  if (opts.tools !== undefined) {
    queryOptions!.tools = opts.tools;
  }

  // Only add optional fields if provided
  if (opts.outputFormat) {
    queryOptions!.outputFormat = opts.outputFormat;
  }
  if (opts.agents) {
    queryOptions!.agents = opts.agents;
  }

  // 5. Call SDK query() wrapped in Langfuse agent observation
  return withAgentObservation(
    {
      taskId: opts.taskId,
      agentId: opts.agentId,
      department: opts.department,
      soulMd: opts.soulMd,
      prompt: opts.prompt,
      runId: opts.runId,
    },
    async () => {
      const q = query({ prompt: opts.prompt, options: queryOptions });

      let sessionId = '';

      // 6. Iterate the async generator
      for await (const msg of q) {
        // Init message -- capture session_id, check MCP server status
        if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'init') {
          const initMsg = msg as SDKSystemMessage;
          sessionId = initMsg.session_id;
          log.info({ sessionId, model: initMsg.model, tools: initMsg.tools.length }, 'SDK session initialized');

          // Check for failed MCP connections
          const failedMcp = initMsg.mcp_servers.filter(s => s.status !== 'connected');
          if (failedMcp.length > 0) {
            log.error({ failedMcp }, 'MCP servers failed to connect');
          }
        }

        // API retry -- log warning
        if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'api_retry') {
          const retryMsg = msg as SDKAPIRetryMessage;
          log.warn({ attempt: retryMsg.attempt, retryDelayMs: retryMsg.retry_delay_ms }, 'API retry');
        }

        // Assistant message -- log to activity_log and emit to build log
        if (msg.type === 'assistant') {
          const assistantMsg = msg as SDKAssistantMessage;
          sqlite.prepare(`
            INSERT INTO activity_log (id, taskId, agentId, actionType, description, createdAt)
            VALUES (?, ?, ?, 'SDK_ASSISTANT', ?, datetime('now'))
          `).run(generateId('log'), opts.taskId, opts.agentId, 'Assistant message');

          eventBus.emit('task:buildlog', {
            taskId: opts.taskId,
            event: { type: 'assistant', agentId: opts.agentId, content: assistantMsg },
          });
        }

        // Stream event -- emit to build log (partial messages)
        if (msg.type === 'stream_event') {
          eventBus.emit('task:buildlog', { taskId: opts.taskId, event: msg });
        }

        // Tool progress -- emit to build log
        if (msg.type === 'tool_progress') {
          eventBus.emit('task:buildlog', { taskId: opts.taskId, event: msg });
        }

        // Tool use summary -- log to activity_log
        if (msg.type === 'tool_use_summary') {
          const summaryMsg = msg as SDKToolUseSummaryMessage;
          sqlite.prepare(`
            INSERT INTO activity_log (id, taskId, agentId, actionType, description, createdAt)
            VALUES (?, ?, ?, 'SDK_TOOL_SUMMARY', ?, datetime('now'))
          `).run(generateId('log'), opts.taskId, opts.agentId, summaryMsg.summary);
        }

        // Result message -- extract cost, store session, return
        if (msg.type === 'result') {
          if (msg.subtype === 'success') {
            const result = msg as SDKResultSuccess;
            const totalCostUsd = result.total_cost_usd;
            const usage = result.usage;
            const modelUsage = result.modelUsage;

            // Determine model from modelUsage (first key)
            const model = Object.keys(modelUsage)[0] ?? 'unknown';
            const modelStats = modelUsage[model];

            // Log cost event to cost_events table (wrapped: task may not exist yet for routing calls)
            try {
              sqlite.prepare(`
                INSERT INTO cost_events (id, taskId, agentId, inputTokens, outputTokens, costUsd, model, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
              `).run(
                generateId('cost'),
                opts.taskId,
                opts.agentId,
                modelStats?.inputTokens ?? usage.input_tokens ?? 0,
                modelStats?.outputTokens ?? usage.output_tokens ?? 0,
                totalCostUsd,
                model,
              );
            } catch (costErr) {
              log.warn({ taskId: opts.taskId, costErr }, 'Cost event insert skipped (task not yet persisted)');
            }

            // Store session for resume (runId may not exist for routing-only calls)
            try {
              sqlite.prepare(
                'UPDATE task_runs SET sessionId = ?, workspaceCwd = ? WHERE id = ?'
              ).run(sessionId, opts.deskDir, opts.runId);
            } catch (runErr) {
              log.warn({ taskId: opts.taskId, runErr }, 'task_runs session update skipped');
            }

            log.info({
              sessionId,
              totalCostUsd,
              numTurns: result.num_turns,
              durationMs: result.duration_ms,
            }, 'Agent invocation completed successfully');

            return {
              sessionId,
              totalCostUsd,
              result: result.result,
              structuredOutput: result.structured_output,
            };
          } else {
            // Error result
            const errorResult = msg as SDKResultError;
            log.error({
              subtype: errorResult.subtype,
              errors: errorResult.errors,
              totalCostUsd: errorResult.total_cost_usd,
            }, 'Agent execution failed');
            throw new Error(`Agent execution failed: ${errorResult.subtype} - ${errorResult.errors.join(', ')}`);
          }
        }
      }

      // Should not reach here -- query should always end with a result message
      throw new Error('Query ended without result message');
    },
  );
}

/**
 * Wrapper around invokeAgent with INT-01 empty response nudge retry.
 * If the agent returns an empty/whitespace-only result, retries once with a nudge prompt.
 * Tool execution failures are handled natively by the Agent SDK tool loop --
 * errors are returned to the agent as tool error results for self-correction.
 * The SDK logs tool failures via stream events which we capture above in the tool_progress handler.
 */
export async function invokeAgentWithResilience(opts: InvokeAgentOptions): Promise<InvokeAgentResult> {
  const log = logger.child({ module: 'invoke-agent-resilience', taskId: opts.taskId });

  const result = await invokeAgent(opts);

  // INT-01: Empty response nudge -- retry once if result is empty/whitespace
  if (result.result !== undefined && result.result.trim() === '') {
    log.warn({ taskId: opts.taskId }, 'Empty response detected, retrying with nudge');
    const nudgeResult = await invokeAgent({
      ...opts,
      prompt: 'Your previous response was empty. Please provide a substantive response.',
      sessionId: result.sessionId,  // Resume the same session
    });
    return {
      sessionId: nudgeResult.sessionId,
      totalCostUsd: result.totalCostUsd + nudgeResult.totalCostUsd,
      result: nudgeResult.result,
      structuredOutput: nudgeResult.structuredOutput,
    };
  }

  return result;
}
