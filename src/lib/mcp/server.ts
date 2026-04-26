/**
 * MCP server factory — Per TOOL-01.
 * Creates a fresh per-invocation MCP server with all 14 tools bound to a ToolContext closure.
 * Each agent invocation gets its own server instance for complete isolation.
 */
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { ToolContext } from './tool-context';
import { createDeptHeadMemoryTool, createTamirMemoryTool } from './tools/memory';
import { createKnowledgeTools } from './tools/knowledge';
import { createDeliverableTools } from './tools/deliverable';
import { createReviewTools } from './tools/review';
import { createVaultTools } from './tools/vault';
import { createSkillTools } from './tools/skills';
import { createInboxTools } from './tools/inbox';
import { createHireTools } from './tools/hire';
import { createInstallTools } from './tools/install';
import { createEscalateTools } from './tools/escalate';
import { createAssetTools } from './tools/asset';
import { createEmployeeTools } from './tools/employee';
import { createDelegationTools } from './tools/delegation';
import { registerOnboardingTools } from './tools/onboarding-tools';

export function buildCortexMcpServer(ctx: ToolContext) {
  const memoryTools = ctx.agentId === 'tamir'
    ? createTamirMemoryTool(ctx)
    : createDeptHeadMemoryTool(ctx);
  const knowledgeTools = createKnowledgeTools(ctx);
  const deliverableTools = createDeliverableTools(ctx);
  const reviewTools = createReviewTools(ctx);
  const vaultTools = createVaultTools(ctx);
  const skillTools = createSkillTools(ctx);
  const inboxTools = createInboxTools(ctx);
  const hireTools = createHireTools(ctx);
  const installTools = createInstallTools(ctx);
  const escalateTools = createEscalateTools(ctx);
  const assetTools = createAssetTools(ctx);
  const employeeTools = createEmployeeTools(ctx);
  const delegationTools = createDelegationTools(ctx);
  const onboardingTools = registerOnboardingTools(ctx);

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
      ...assetTools,
      ...employeeTools,
      ...delegationTools,
      ...onboardingTools,
    ],
  });
}
