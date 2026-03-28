import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { logger } from '@/lib/logger';

const EXECUTIVES = [
  { agentId: 'tamir', name: 'Tamir', department: 'cos', budgetLimit: 50.0 },
  { agentId: 'cto', name: 'CTO', department: 'tech', budgetLimit: 25.0 },
  { agentId: 'cmo', name: 'CMO', department: 'marketing', budgetLimit: 25.0 },
  { agentId: 'coo', name: 'COO', department: 'operations', budgetLimit: 25.0 },
];

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
}
