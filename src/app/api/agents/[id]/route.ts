import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const DATA_DIR = resolve(process.cwd(), 'data');
const AGENTS_DIR = resolve(process.cwd(), 'src', 'agents');

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const agentId = params.id;

  // Read card.json
  const cardPath = join(AGENTS_DIR, agentId, 'card.json');
  let card = null;
  if (existsSync(cardPath)) {
    try {
      card = JSON.parse(readFileSync(cardPath, 'utf-8'));
    } catch {
      // Skip invalid card files
    }
  }

  // Read MEMORY.md
  const memPath = join(DATA_DIR, 'agents', agentId, 'MEMORY.md');
  let memory = '';
  if (existsSync(memPath)) {
    memory = readFileSync(memPath, 'utf-8');
  }

  // Get employee record
  const employee = await prisma.employee.findFirst({
    where: { agentId },
  });

  // Get recent tasks where this agent is planning, executor, or supervisor
  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { planningAgentId: agentId },
        { executorAgentId: agentId },
        { supervisorAgentId: agentId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { deliverables: { select: { id: true, title: true } } },
  });

  return NextResponse.json({ card, memory, employee, tasks });
}
