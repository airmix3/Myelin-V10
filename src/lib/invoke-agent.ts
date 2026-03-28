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
  SDKToolProgressMessage,
  SDKFilesPersistedEvent,
  SDKHookStartedMessage,
  SDKHookProgressMessage,
  SDKHookResponseMessage,
  SDKLocalCommandOutputMessage,
  AgentDefinition,
  JsonSchemaOutputFormat,
} from '@anthropic-ai/claude-agent-sdk';
import { buildCortexMcpServer } from '@/lib/mcp/server';
import { createToolContext } from '@/lib/mcp/tool-context';
import { buildCanUseTool } from '@/lib/mcp/access-control';
import { eventBus } from '@/lib/events';
import { sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { logger } from '@/lib/logger';
import { withAgentObservation } from '@/lib/langfuse';
import { insertActivityLog } from '@/lib/activity-log';
import { registerQueryRef, unregisterQueryRef } from '@/lib/mcp/query-registry';

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

interface ToolUseBlock {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncateText(text: string, maxLen = 180): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getPathFromInput(input: Record<string, unknown>): string {
  const candidates = [
    input.file_path,
    input.path,
    input.notebook_path,
    input.target_file,
    input.uri,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  if (Array.isArray(input.paths) && typeof input.paths[0] === 'string') return input.paths[0];
  return '';
}

function summarizeToolUse(name: string, input: Record<string, unknown>): string {
  const path = getPathFromInput(input);
  switch (name) {
    case 'Read':
      return path ? `Read ${path}` : 'Read file';
    case 'Write':
      return path ? `Wrote ${path}` : 'Wrote file';
    case 'Edit':
    case 'MultiEdit':
      return path ? `Edited ${path}` : 'Edited file';
    case 'Glob': {
      const pattern = typeof input.pattern === 'string' ? input.pattern : typeof input.glob === 'string' ? input.glob : '';
      const scope = typeof input.path === 'string' ? ` in ${input.path}` : '';
      return pattern ? `Globbed ${pattern}${scope}` : 'Ran glob search';
    }
    case 'Grep': {
      const pattern = typeof input.pattern === 'string' ? input.pattern : typeof input.query === 'string' ? input.query : '';
      const scope = typeof input.path === 'string' ? ` in ${input.path}` : '';
      return pattern ? `Searched for ${truncateText(pattern, 80)}${scope}` : 'Ran search';
    }
    case 'Bash': {
      const command = typeof input.command === 'string' ? input.command : '';
      return command ? `Ran bash: ${truncateText(command, 120)}` : 'Ran bash command';
    }
    case 'LS':
      return path ? `Listed ${path}` : 'Listed files';
    case 'WebFetch':
      return typeof input.url === 'string' ? `Fetched ${input.url}` : 'Fetched web page';
    case 'WebSearch':
      return typeof input.query === 'string' || typeof input.search_term === 'string'
        ? `Web searched ${truncateText(String(input.query ?? input.search_term), 90)}`
        : 'Ran web search';
    default:
      if (name.startsWith('mcp__')) {
        return `Used ${name.replace(/^mcp__/, '').replace(/__/g, '.')}`;
      }
      return `${name}${path ? ` ${path}` : ''}`.trim();
  }
}

function extractAssistantText(message: SDKAssistantMessage): string {
  const content = message.message?.content;
  if (!Array.isArray(content)) return '';
  const text = content.flatMap((block) => {
    const record = asRecord(block);
    if (!record || record.type !== 'text' || typeof record.text !== 'string') return [];
    return [record.text];
  }).join('\n\n');
  return normalizeWhitespace(text);
}

function extractToolUseBlocks(message: SDKAssistantMessage): ToolUseBlock[] {
  const content = message.message?.content;
  if (!Array.isArray(content)) return [];

  return content.flatMap((block) => {
    const record = asRecord(block);
    if (!record || record.type !== 'tool_use') return [];
    return [{
      id: typeof record.id === 'string' ? record.id : generateId('tool'),
      name: typeof record.name === 'string' ? record.name : 'tool',
      input: asRecord(record.input) ?? {},
    }];
  });
}

export async function invokeAgent(opts: InvokeAgentOptions): Promise<InvokeAgentResult> {
  const log = logger.child({ module: 'invoke-agent', taskId: opts.taskId, agentId: opts.agentId });

  // 1. Create per-invocation ToolContext (closure-bound isolation)
  const ctx = createToolContext({
    taskId: opts.taskId,
    runId: opts.runId,
    agentId: opts.agentId,
    department: opts.department,
    deskDir: opts.deskDir,
    delivDir: opts.delivDir,
    manifestPath: opts.manifestPath,
  });

  // 2. Create fresh MCP server for this invocation
  const cortexServer = buildCortexMcpServer(ctx);

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
    mcpServers: { cortex: cortexServer },
    allowedTools: ['mcp__cortex__*'],
    canUseTool,
    permissionMode: 'acceptEdits',
    maxBudgetUsd: opts.maxBudgetUsd ?? 10,
    includePartialMessages: true,
    resume: opts.sessionId,
    settingSources: ['project'],
    env: {
      ...process.env as Record<string, string>,
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

      // Register query ref for hot-reload access (e.g., install_tool's setMcpServers)
      registerQueryRef(opts.runId, q);

      let sessionId = '';

      try {
      // 6. Iterate the async generator
      const seenTypes = new Set<string>();
      for await (const msg of q) {
        // Debug: track all message types seen
        const typeKey = msg.type + ('subtype' in msg ? `:${(msg as Record<string, unknown>).subtype}` : '');
        if (!seenTypes.has(typeKey)) {
          seenTypes.add(typeKey);
          log.info({ msgType: typeKey }, 'SDK message type seen (first occurrence)');
        }
        // Init message -- capture session_id, check MCP server status
        if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'init') {
          const initMsg = msg as SDKSystemMessage;
          sessionId = initMsg.session_id;
          log.info({ sessionId, model: initMsg.model, tools: initMsg.tools.length }, 'SDK session initialized');

          // Persist sessionId immediately so "Take His Role" can resume mid-execution
          try {
            sqlite.prepare(
              'UPDATE task_runs SET sessionId = ? WHERE id = ? AND sessionId IS NULL'
            ).run(sessionId, opts.runId);
          } catch (earlySessionErr) {
            log.warn({ runId: opts.runId, earlySessionErr }, 'Early sessionId persist skipped');
          }

          insertActivityLog({
            taskId: opts.taskId,
            agentId: opts.agentId,
            actionType: 'SDK_SESSION_INIT',
            description: `Started ${initMsg.model}`,
            metadata: {
              sessionId,
              model: initMsg.model,
              cwd: initMsg.cwd,
              tools: initMsg.tools,
              skills: initMsg.skills,
              mcpServers: initMsg.mcp_servers,
            },
          });

          for (const skill of initMsg.skills ?? []) {
            insertActivityLog({
              taskId: opts.taskId,
              agentId: opts.agentId,
              actionType: 'SDK_SKILL_LOAD',
              description: `Loaded skill ${skill}`,
              metadata: { skill },
            });
          }

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
          insertActivityLog({
            taskId: opts.taskId,
            agentId: opts.agentId,
            actionType: 'SDK_API_RETRY',
            description: `API retry ${retryMsg.attempt}/${retryMsg.max_retries}`,
            metadata: {
              attempt: retryMsg.attempt,
              maxRetries: retryMsg.max_retries,
              retryDelayMs: retryMsg.retry_delay_ms,
              errorStatus: retryMsg.error_status,
              error: retryMsg.error,
            },
          });
        }

        // Assistant message -- log to activity_log and emit to build log
        if (msg.type === 'assistant') {
          const assistantMsg = msg as SDKAssistantMessage;
          const assistantText = extractAssistantText(assistantMsg);
          if (assistantText || assistantMsg.error) {
            insertActivityLog({
              taskId: opts.taskId,
              agentId: opts.agentId,
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
            taskId: opts.taskId,
            event: { type: 'assistant', agentId: opts.agentId, content: assistantMsg },
          });

          for (const block of extractToolUseBlocks(assistantMsg)) {
            insertActivityLog({
              taskId: opts.taskId,
              agentId: opts.agentId,
              actionType: 'SDK_TOOL_CALL',
              description: summarizeToolUse(block.name, block.input),
              metadata: {
                toolName: block.name,
                toolUseId: block.id,
                parentToolUseId: assistantMsg.parent_tool_use_id,
                input: block.input,
              },
            });

            eventBus.emit('task:buildlog', {
              taskId: opts.taskId,
              event: {
                type: 'tool_call',
                agentId: opts.agentId,
                tool_name: block.name,
                tool_use_id: block.id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }

        // Stream event -- emit to build log (partial messages)
        if (msg.type === 'stream_event') {
          eventBus.emit('task:buildlog', { taskId: opts.taskId, event: msg });
        }

        // Tool progress -- emit structured activity to build log
        if (msg.type === 'tool_progress') {
          const toolMsg = msg as SDKToolProgressMessage;
          insertActivityLog({
            taskId: opts.taskId,
            agentId: opts.agentId,
            actionType: 'SDK_TOOL_PROGRESS',
            description: `${toolMsg.tool_name} running`,
            metadata: {
              toolName: toolMsg.tool_name,
              toolUseId: toolMsg.tool_use_id,
              parentToolUseId: toolMsg.parent_tool_use_id,
              elapsedTimeSeconds: toolMsg.elapsed_time_seconds,
              taskId: toolMsg.task_id ?? null,
            },
          });

          eventBus.emit('task:buildlog', {
            taskId: opts.taskId,
            event: {
              type: 'tool_activity',
              agentId: opts.agentId,
              tool_name: toolMsg.tool_name,
              elapsed_time_seconds: toolMsg.elapsed_time_seconds,
              tool_use_id: toolMsg.tool_use_id,
              timestamp: new Date().toISOString(),
            },
          });
        }

        // Tool use summary -- log to activity_log
        if (msg.type === 'tool_use_summary') {
          const summaryMsg = msg as SDKToolUseSummaryMessage;
          insertActivityLog({
            taskId: opts.taskId,
            agentId: opts.agentId,
            actionType: 'SDK_TOOL_SUMMARY',
            description: summaryMsg.summary,
            metadata: {
              precedingToolUseIds: summaryMsg.preceding_tool_use_ids,
            },
          });

          // Also emit to buildlog for live UI
          eventBus.emit('task:buildlog', {
            taskId: opts.taskId,
            event: {
              type: 'tool_summary',
              agentId: opts.agentId,
              summary: summaryMsg.summary,
              timestamp: new Date().toISOString(),
            },
          });
        }

        if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'files_persisted') {
          const filesMsg = msg as SDKFilesPersistedEvent;
          insertActivityLog({
            taskId: opts.taskId,
            agentId: opts.agentId,
            actionType: 'SDK_FILES_PERSISTED',
            description: `Persisted ${filesMsg.files.length} file(s)`,
            metadata: {
              files: filesMsg.files,
              failed: filesMsg.failed,
              processedAt: filesMsg.processed_at,
            },
          });
        }

        if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'hook_started') {
          const hookMsg = msg as SDKHookStartedMessage;
          insertActivityLog({
            taskId: opts.taskId,
            agentId: opts.agentId,
            actionType: 'SDK_HOOK_STARTED',
            description: `Hook started: ${hookMsg.hook_name}`,
            metadata: {
              hookId: hookMsg.hook_id,
              hookEvent: hookMsg.hook_event,
            },
          });
        }

        if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'hook_progress') {
          const hookMsg = msg as SDKHookProgressMessage;
          insertActivityLog({
            taskId: opts.taskId,
            agentId: opts.agentId,
            actionType: 'SDK_HOOK_PROGRESS',
            description: `Hook output: ${hookMsg.hook_name}`,
            metadata: {
              hookId: hookMsg.hook_id,
              hookEvent: hookMsg.hook_event,
              stdout: hookMsg.stdout,
              stderr: hookMsg.stderr,
              output: hookMsg.output,
            },
          });
        }

        if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'hook_response') {
          const hookMsg = msg as SDKHookResponseMessage;
          insertActivityLog({
            taskId: opts.taskId,
            agentId: opts.agentId,
            actionType: 'SDK_HOOK_RESPONSE',
            description: `Hook ${hookMsg.outcome}: ${hookMsg.hook_name}`,
            metadata: {
              hookId: hookMsg.hook_id,
              hookEvent: hookMsg.hook_event,
              outcome: hookMsg.outcome,
              exitCode: hookMsg.exit_code ?? null,
              stdout: hookMsg.stdout,
              stderr: hookMsg.stderr,
              output: hookMsg.output,
            },
          });
        }

        if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'local_command_output') {
          const localMsg = msg as SDKLocalCommandOutputMessage;
          insertActivityLog({
            taskId: opts.taskId,
            agentId: opts.agentId,
            actionType: 'SDK_LOCAL_COMMAND',
            description: truncateText(normalizeWhitespace(localMsg.content)),
            metadata: {
              content: localMsg.content,
            },
          });
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

            insertActivityLog({
              taskId: opts.taskId,
              agentId: opts.agentId,
              actionType: 'SDK_RESULT_SUCCESS',
              description: `Completed in ${Math.round(result.duration_ms / 1000)}s across ${result.num_turns} turn(s)`,
              metadata: {
                sessionId,
                totalCostUsd,
                durationMs: result.duration_ms,
                numTurns: result.num_turns,
                stopReason: result.stop_reason,
                result: result.result,
              },
            });

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

            insertActivityLog({
              taskId: opts.taskId,
              agentId: opts.agentId,
              actionType: 'SDK_RESULT_ERROR',
              description: `Failed: ${errorResult.subtype}`,
              metadata: {
                subtype: errorResult.subtype,
                errors: errorResult.errors,
                durationMs: errorResult.duration_ms,
                numTurns: errorResult.num_turns,
                totalCostUsd: errorResult.total_cost_usd,
              },
            });

            throw new Error(`Agent execution failed: ${errorResult.subtype} - ${errorResult.errors.join(', ')}`);
          }
        }
      }

      // Should not reach here -- query should always end with a result message
      throw new Error('Query ended without result message');
      } finally {
        unregisterQueryRef(opts.runId);
      }
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
