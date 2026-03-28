/**
 * MCP server factory — Per TOOL-01.
 * Creates a fresh per-invocation MCP server with all 14 tools bound to a ToolContext closure.
 * Each agent invocation gets its own server instance for complete isolation.
 */
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { ToolContext } from './tool-context';
import { createMemoryTools } from './tools/memory';
import { createKnowledgeTools } from './tools/knowledge';
import { createDeliverableTools } from './tools/deliverable';
import { createReviewTools } from './tools/review';
import { createVaultTools } from './tools/vault';
import { createSkillTools } from './tools/skills';
import { createInboxTools } from './tools/inbox';
import { createHireTools } from './tools/hire';
import { createInstallTools } from './tools/install';
import { createEscalateTools } from './tools/escalate';

export function buildCortexMcpServer(ctx: ToolContext) {
  const memoryTools = createMemoryTools(ctx);
  const knowledgeTools = createKnowledgeTools(ctx);
  const deliverableTools = createDeliverableTools(ctx);
  const reviewTools = createReviewTools(ctx);
  const vaultTools = createVaultTools(ctx);
  const skillTools = createSkillTools(ctx);
  const inboxTools = createInboxTools(ctx);
  const hireTools = createHireTools(ctx);
  const installTools = createInstallTools(ctx);
  const escalateTools = createEscalateTools(ctx);

  return createSdkMcpServer({
    name: 'cortex',
    tools: [
      ...memoryTools,
      ...knowledgeTools,
      ...deliverableTools,
      ...reviewTools,
      ...vaultTools,
      ...skillTools,
      ...inboxTools,
      ...hireTools,
      ...installTools,
      ...escalateTools,
    ],
  });
}
