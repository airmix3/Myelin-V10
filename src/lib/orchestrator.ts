/**
 * Agent Orchestrator -- Per AGENT-02.
 * Singleton holding all agent configs, dispatches invocations via invokeAgent().
 */
import { logger } from '@/lib/logger';
import { invokeAgent, type InvokeAgentResult } from '@/lib/invoke-agent';
import type { AgentDefinition, JsonSchemaOutputFormat } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import tamirCard from '@/agents/tamir/card.json';
import ctoCard from '@/agents/cto/card.json';
import cmoCard from '@/agents/cmo/card.json';
import cooCard from '@/agents/coo/card.json';

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
    tools?: string[] | { type: 'preset'; preset: 'claude_code' };
    projectRoot?: string;
  }): Promise<InvokeAgentResult> {
    // Lazy init -- handles Next.js dev worker context splits where instrumentation
    // runs in a different context than API route handlers.
    if (this.agents.size === 0) {
      this.log.info('Lazy-initializing orchestrator (no agents registered in this context)');
      initOrchestrator();
    }

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
 * Safe to call multiple times -- register() is idempotent (Map.set).
 * Automatically called by invoke() if agents haven't been loaded yet.
 */
export function initOrchestrator(): void {
  const cwd = process.cwd();
  const agents = [
    { card: tamirCard, soul: 'tamir' },
    { card: ctoCard, soul: 'cto' },
    { card: cmoCard, soul: 'cmo' },
    { card: cooCard, soul: 'coo' },
  ];
  for (const { card, soul } of agents) {
    const soulMd = readFileSync(resolve(cwd, `src/agents/${soul}/soul.md`), 'utf-8');
    orchestrator.register({
      agentId: card.agentId,
      name: card.name,
      department: card.department,
      role: card.role,
      soulMd,
      avatarColor: card.avatarColor,
    });
  }
}
