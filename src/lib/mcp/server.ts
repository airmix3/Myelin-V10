/**
 * MCP server factory — Per TOOL-01.
 * Creates a fresh per-invocation MCP server with all tools bound to a ToolContext closure.
 * Each agent invocation gets its own server instance for complete isolation.
 */
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { ToolContext } from './tool-context';
import { createMemoryTools } from './tools/memory';
import { createKnowledgeTools } from './tools/knowledge';
import { createDeliverableTools } from './tools/deliverable';

export function buildMyelinMcpServer(ctx: ToolContext) {
  const memoryTools = createMemoryTools(ctx);
  const knowledgeTools = createKnowledgeTools(ctx);
  const deliverableTools = createDeliverableTools(ctx);
  // Plan 04 will add: reviewTools, vaultTools, skillTools, inboxTools, hireTools

  return createSdkMcpServer({
    name: 'myelin',
    tools: [
      ...memoryTools,
      ...knowledgeTools,
      ...deliverableTools,
      // Plan 04 tools will be added here
    ],
  });
}
