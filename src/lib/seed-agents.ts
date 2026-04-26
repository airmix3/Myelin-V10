import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { logger } from '@/lib/logger';
import { orchestrator } from '@/lib/orchestrator';
import { invalidateDepartmentCache } from '@/lib/departments';

const EXECUTIVES = [
  { agentId: 'tamir', name: 'Tamir', department: 'cos', budgetLimit: 50.0 },
  { agentId: 'cto', name: 'CTO', department: 'tech', budgetLimit: 25.0 },
  { agentId: 'cmo', name: 'CMO', department: 'marketing', budgetLimit: 25.0 },
  { agentId: 'coo', name: 'COO', department: 'operations', budgetLimit: 25.0 },
];

/** Map department to its head agentId */
function getHeadForDepartment(dept: string): string {
  const map: Record<string, string> = { tech: 'cto', marketing: 'cmo', operations: 'coo', cos: 'tamir' };
  return map[dept] ?? 'tamir';
}

export async function seedAgents(): Promise<void> {
  const log = logger.child({ module: 'seed-agents' });
  for (const exec of EXECUTIVES) {
    const existing = await prisma.employee.findFirst({ where: { agentId: exec.agentId } });
    if (!existing) {
      await prisma.employee.create({
        data: {
          id: generateId('emp'),
          name: exec.name,
          role: 'executive',
          department: exec.department,
          agentId: exec.agentId,
          status: 'active',
          budgetLimit: exec.budgetLimit,
          budgetSpent: 0.0,
        },
      });
      log.info({ agentId: exec.agentId }, 'Seeded executive agent');
    } else {
      log.debug({ agentId: exec.agentId }, 'Executive agent already exists');
    }
  }

  // Register permanent (non-executive) employees in the orchestrator
  // so they survive server restarts and appear in the agent registry
  const employees = await prisma.employee.findMany({
    where: { role: { not: 'executive' }, status: 'active' },
  });
  for (const emp of employees) {
    if (!emp.agentId) continue;
    orchestrator.register({
      agentId: emp.agentId,
      name: emp.name,
      department: emp.department,
      role: emp.role,
      soulMd: '', // Employees get soul from capabilities/delegation context
      avatarColor: '#6B7280', // Default gray for employees
      isEmployee: true,
      parentAgentId: getHeadForDepartment(emp.department),
      capabilities: emp.capabilities ?? undefined,
    });
    log.info({ agentId: emp.agentId, department: emp.department }, 'Registered persistent employee');
  }
}

/**
 * Seed a dynamically-created agent during onboarding (Phase 7+).
 * Creates the employee record in DB and invalidates the department cache.
 * Does NOT register in the orchestrator -- caller should use
 * orchestrator.registerDynamicAgent() after generating the soul.
 */
export async function seedDynamicAgent(config: {
  agentId: string;
  name: string;
  department: string;
  budgetLimit: number;
  role?: string;
}): Promise<void> {
  const log = logger.child({ module: 'seed-agents' });
  const existing = await prisma.employee.findFirst({ where: { agentId: config.agentId } });
  if (existing) {
    log.debug({ agentId: config.agentId }, 'Dynamic agent already exists, skipping seed');
    return;
  }
  await prisma.employee.create({
    data: {
      id: generateId('emp'),
      name: config.name,
      role: config.role ?? 'executive',
      department: config.department,
      agentId: config.agentId,
      status: 'active',
      budgetLimit: config.budgetLimit,
      budgetSpent: 0.0,
    },
  });
  // Invalidate department cache so new department appears in routing
  invalidateDepartmentCache();
  log.info({ agentId: config.agentId, department: config.department }, 'Seeded dynamic agent');
}
