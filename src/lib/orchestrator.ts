/**
 * Agent Orchestrator -- Per AGENT-02.
 * Singleton holding all agent configs, dispatches invocations via invokeAgent().
 */
import { logger } from '@/lib/logger';
import { invokeAgent, type InvokeAgentResult } from '@/lib/invoke-agent';
import type { AgentDefinition, JsonSchemaOutputFormat } from '@anthropic-ai/claude-agent-sdk';

interface AgentRegistryEntry {
  agentId: string;
  name: string;
  department: string;
  role: string;
  soulMd: string;
  avatarColor: string;
}

export class AgentOrchestrator {
  private agents = new Map<string, AgentRegistryEntry>();
  private log = logger.child({ module: 'orchestrator' });

  register(entry: AgentRegistryEntry): void {
    this.agents.set(entry.agentId, entry);
    this.log.info({ agentId: entry.agentId, name: entry.name }, 'Agent registered');
  }

  getAgent(agentId: string): AgentRegistryEntry | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AgentRegistryEntry[] {
    return Array.from(this.agents.values());
  }

  async invoke(opts: {
    taskId: string;
    runId: string;
    agentId: string;
    prompt: string;
    deskDir: string;
    delivDir: string;
    manifestPath: string;
    sessionId?: string;
    maxBudgetUsd?: number;
    outputFormat?: JsonSchemaOutputFormat;
    agents?: Record<string, AgentDefinition>;
  }): Promise<InvokeAgentResult> {
    const agent = this.agents.get(opts.agentId);
    if (!agent) throw new Error(`Unknown agent: ${opts.agentId}`);

    this.log.info({ agentId: opts.agentId, taskId: opts.taskId }, 'Dispatching agent invocation');

    return invokeAgent({
      ...opts,
      department: agent.department,
      soulMd: agent.soulMd,
    });
  }
}

// Singleton -- survives Next.js HMR in development
const globalForOrch = globalThis as typeof globalThis & { __orchestrator?: AgentOrchestrator };
export const orchestrator: AgentOrchestrator = globalForOrch.__orchestrator ??= new AgentOrchestrator();

/**
 * Initialize orchestrator with all 4 executive agent configs.
 * Called once from instrumentation.ts on server startup.
 * Uses dynamic imports since agent.ts files use import.meta.url + readFileSync.
 */
export async function initOrchestrator(): Promise<void> {
  const { agentConfig: tamirConfig } = await import('@/agents/tamir/agent');
  const { agentConfig: ctoConfig } = await import('@/agents/cto/agent');
  const { agentConfig: cmoConfig } = await import('@/agents/cmo/agent');
  const { agentConfig: cooConfig } = await import('@/agents/coo/agent');

  for (const config of [tamirConfig, ctoConfig, cmoConfig, cooConfig]) {
    orchestrator.register({
      agentId: config.agentId,
      name: config.name,
      department: config.department,
      role: config.role,
      soulMd: config.soulMd,
      avatarColor: config.avatarColor,
    });
  }
}
