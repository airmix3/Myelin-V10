/**
 * Agent Orchestrator -- Per AGENT-02.
 * Singleton holding all agent configs, dispatches invocations via invokeAgent().
 *
 * initOrchestrator() now loads agents from the DB (employee table) using
 * loadSoul() for merged template+generated soul content. This supports
 * both default agents and custom departments created during onboarding.
 */
import { logger } from '@/lib/logger';
import { invokeAgent, type InvokeAgentResult } from '@/lib/invoke-agent';
import { MemoryStore, TAMIR_MEMORY_PATH, TAMIR_USER_PATH, TAMIR_COMPANY_PATH, MEMORY_CHAR_LIMIT, USER_CHAR_LIMIT, COMPANY_CHAR_LIMIT, DEPT_HEAD_CHAR_LIMIT } from '@/lib/memory-store';
import { dataPath } from '@/lib/paths';
import type { AgentDefinition, JsonSchemaOutputFormat } from '@anthropic-ai/claude-agent-sdk';
import { prisma } from '@/lib/db';
import { loadSoul } from '@/lib/onboarding/soul-generator';

export interface AgentRegistryEntry {
  agentId: string;
  name: string;
  department: string;
  role: string;
  soulMd: string;
  avatarColor: string;
  isEmployee?: boolean;         // true for non-executive employees
  parentAgentId?: string;       // dept head agentId for employees
  capabilities?: string;        // JSON capabilities string
  toolWhitelist?: string[];     // tool whitelist array
}

export class AgentOrchestrator {
  private agents = new Map<string, AgentRegistryEntry>();
  private log = logger.child({ module: 'orchestrator' });

  register(entry: AgentRegistryEntry): void {
    this.agents.set(entry.agentId, entry);
    this.log.info({ agentId: entry.agentId, name: entry.name }, 'Agent registered');
  }

  get isInitialized(): boolean {
    return this.agents.size > 0;
  }

  getAgent(agentId: string): AgentRegistryEntry | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AgentRegistryEntry[] {
    return Array.from(this.agents.values());
  }

  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.log.info({ agentId }, 'Agent unregistered');
  }

  getEmployeesForDepartment(department: string): AgentRegistryEntry[] {
    return Array.from(this.agents.values()).filter(
      (a) => a.isEmployee === true && a.department === department
    );
  }

  getEmployeesForHead(headAgentId: string): AgentRegistryEntry[] {
    return Array.from(this.agents.values()).filter(
      (a) => a.parentAgentId === headAgentId
    );
  }

  /**
   * Register a dynamically-created agent at runtime (e.g. from onboarding).
   * This is a convenience wrapper over register() for agents created after
   * initial server startup.
   */
  registerDynamicAgent(agentId: string, soulContent: string, department: string, name: string, avatarColor: string): void {
    this.register({
      agentId,
      name,
      department,
      role: 'executive',
      soulMd: soulContent,
      avatarColor,
    });
    this.log.info({ agentId, department }, 'Dynamic agent registered at runtime');
  }

  /**
   * Lazy-init: if the agents map is empty, re-run initOrchestrator().
   * Handles HMR resets and race conditions where routes fire before instrumentation.
   */
  async ensureInitialized(): Promise<void> {
    if (this.agents.size === 0) {
      this.log.info('Orchestrator empty, running lazy init');
      await initOrchestrator();
    }
  }

  /**
   * Get the full soulMd (including memory snapshots) for an agent.
   * Extracted for use by WarmSessionManager which needs soulMd without invoking.
   */
  async getSoulMd(agentId: string): Promise<string> {
    await this.ensureInitialized();
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Unknown agent: ${agentId}`);

    let soulMd = agent.soulMd;

    if (agentId === 'tamir') {
      try {
        const memoryStore = new MemoryStore(TAMIR_MEMORY_PATH, MEMORY_CHAR_LIMIT);
        await memoryStore.loadFromDisk();
        const memorySnapshot = memoryStore.formatForSystemPrompt();

        const userStore = new MemoryStore(TAMIR_USER_PATH, USER_CHAR_LIMIT);
        await userStore.loadFromDisk();
        const userSnapshot = userStore.formatForSystemPrompt();

        const companyStore = new MemoryStore(TAMIR_COMPANY_PATH, COMPANY_CHAR_LIMIT);
        await companyStore.loadFromDisk();
        const companySnapshot = companyStore.formatForSystemPrompt();

        const snapshots = [memorySnapshot, userSnapshot, companySnapshot]
          .filter((s): s is string => !!s && s.trim().length > 0)
          .join('\n\n');
        if (snapshots) {
          soulMd = soulMd + '\n\n' + snapshots;
        }
      } catch (err) {
        this.log.warn({ err, agentId }, 'Failed to load memory snapshots, continuing without');
      }
    } else {
      // Dept heads: inject single MEMORY.md snapshot
      try {
        const memPath = dataPath('agents', agentId, 'MEMORY.md');
        const store = new MemoryStore(memPath, DEPT_HEAD_CHAR_LIMIT);
        await store.loadFromDisk();
        const snapshot = store.formatForSystemPrompt();
        if (snapshot && snapshot.trim().length > 0) {
          soulMd = soulMd + '\n\n' + snapshot;
        }
      } catch (err) {
        this.log.warn({ err, agentId }, 'Failed to load dept head memory snapshot, continuing without');
      }
    }

    return soulMd;
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
    await this.ensureInitialized();
    const agent = this.agents.get(opts.agentId);
    if (!agent) throw new Error(`Unknown agent: ${opts.agentId}`);

    this.log.info({ agentId: opts.agentId, taskId: opts.taskId }, 'Dispatching agent invocation');

    // D-13/D-14/D-15: Inject frozen memory snapshots for Tamir
    let soulMd = agent.soulMd;

    if (opts.agentId === 'tamir') {
      try {
        const memoryStore = new MemoryStore(TAMIR_MEMORY_PATH, MEMORY_CHAR_LIMIT);
        await memoryStore.loadFromDisk();
        const memorySnapshot = memoryStore.formatForSystemPrompt();

        const userStore = new MemoryStore(TAMIR_USER_PATH, USER_CHAR_LIMIT);
        await userStore.loadFromDisk();
        const userSnapshot = userStore.formatForSystemPrompt();

        const companyStore = new MemoryStore(TAMIR_COMPANY_PATH, COMPANY_CHAR_LIMIT);
        await companyStore.loadFromDisk();
        const companySnapshot = companyStore.formatForSystemPrompt();

        // Concatenate: soul.md + memory snapshot + user snapshot + company snapshot
        const snapshots = [memorySnapshot, userSnapshot, companySnapshot].filter((s): s is string => !!s && s.trim().length > 0).join('\n\n');
        if (snapshots) {
          soulMd = soulMd + '\n\n' + snapshots;
        }

        this.log.info({ agentId: opts.agentId }, 'Loaded frozen memory snapshots for Tamir');
      } catch (err) {
        this.log.warn({ err, agentId: opts.agentId }, 'Failed to load memory snapshots, continuing without');
      }
    } else {
      // Dept heads: inject single MEMORY.md snapshot
      try {
        const memPath = dataPath('agents', opts.agentId, 'MEMORY.md');
        const store = new MemoryStore(memPath, DEPT_HEAD_CHAR_LIMIT);
        await store.loadFromDisk();
        const snapshot = store.formatForSystemPrompt();
        if (snapshot && snapshot.trim().length > 0) {
          soulMd = soulMd + '\n\n' + snapshot;
        }
        this.log.info({ agentId: opts.agentId }, 'Loaded frozen memory snapshot for dept head');
      } catch (err) {
        this.log.warn({ err, agentId: opts.agentId }, 'Failed to load dept head memory snapshot, continuing without');
      }
    }

    return invokeAgent({
      ...opts,
      department: agent.department,
      soulMd,
    });
  }
}

// Singleton -- survives Next.js HMR in development
const globalForOrch = globalThis as typeof globalThis & { __orchestrator?: AgentOrchestrator };
export const orchestrator: AgentOrchestrator = globalForOrch.__orchestrator ??= new AgentOrchestrator();

/** Default avatar colors for known agents; dynamic agents get a generated color. */
const DEFAULT_AVATAR_COLORS: Record<string, string> = {
  tamir: '#6366f1',
  cto: '#10b981',
  cmo: '#f59e0b',
  coo: '#3b82f6',
};

/**
 * Simple hash-based color generator for dynamic agents without a preset color.
 */
function generateAvatarColor(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash + agentId.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/**
 * Initialize orchestrator from DB employee table.
 * Called once from instrumentation.ts on server startup.
 *
 * For agents with src/agents/{agentId}/agent.ts (the original 4 executives),
 * uses their getAgentConfig() for precise config including soul.md.
 * For dynamically-created agents (from onboarding), uses loadSoul() to
 * merge template + generated layers.
 *
 * This makes initOrchestrator() work for both default AND custom departments.
 */
export async function initOrchestrator(): Promise<void> {
  const log = logger.child({ module: 'orchestrator-init' });

  // Load the well-known agent configs (these have src/agents/{id}/agent.ts)
  const knownAgentModules: Record<string, () => Promise<{ getAgentConfig: () => AgentRegistryEntry & { soulMd: string } }>> = {
    tamir: () => import('@/agents/tamir/agent'),
    cto: () => import('@/agents/cto/agent'),
    cmo: () => import('@/agents/cmo/agent'),
    coo: () => import('@/agents/coo/agent'),
  };

  // Query all active executives from DB
  const executives = await prisma.employee.findMany({
    where: { role: 'executive', status: 'active' },
  });

  for (const emp of executives) {
    const agentId = emp.agentId;
    if (!agentId) continue;

    // Check if this agent has a well-known config module
    const loader = knownAgentModules[agentId];
    if (loader) {
      try {
        const mod = await loader();
        const config = mod.getAgentConfig();
        orchestrator.register({
          agentId: config.agentId,
          name: config.name,
          department: config.department,
          role: config.role,
          soulMd: config.soulMd,
          avatarColor: config.avatarColor,
        });
        continue;
      } catch (err) {
        log.warn({ err, agentId }, 'Failed to load known agent config, falling back to loadSoul');
      }
    }

    // Dynamic agent: use loadSoul() for merged template+generated soul
    const soulMd = loadSoul(agentId, emp.department);
    const avatarColor = DEFAULT_AVATAR_COLORS[agentId] || generateAvatarColor(agentId);
    orchestrator.register({
      agentId,
      name: emp.name,
      department: emp.department,
      role: emp.role,
      soulMd,
      avatarColor,
    });
    log.info({ agentId, department: emp.department }, 'Registered dynamic agent from DB');
  }

  // Also register non-executive persistent employees
  const employees = await prisma.employee.findMany({
    where: { role: { not: 'executive' }, status: 'active' },
  });
  for (const emp of employees) {
    if (!emp.agentId) continue;
    if (orchestrator.getAgent(emp.agentId)) continue; // already registered
    orchestrator.register({
      agentId: emp.agentId,
      name: emp.name,
      department: emp.department,
      role: emp.role,
      soulMd: '',
      avatarColor: '#6B7280',
      isEmployee: true,
      capabilities: emp.capabilities ?? undefined,
    });
    log.info({ agentId: emp.agentId, department: emp.department }, 'Registered persistent employee from DB');
  }
}
