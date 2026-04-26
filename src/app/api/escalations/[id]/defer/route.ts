import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'escalation-defer' });

/**
 * POST /api/escalations/[id]/defer
 * Defer an escalation — sets status to 'deferred'. Task stays in input-required
 * (deferred means "come back later", not resolved).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Find escalation
  const escalation = await prisma.escalation.findUnique({ where: { id } });
  if (!escalation) {
    return NextResponse.json({ error: 'Escalation not found' }, { status: 404 });
  }
  if (escalation.status !== 'pending') {
    return NextResponse.json(
      { error: `Escalation already ${escalation.status}` },
      { status: 400 }
    );
  }

  // Update escalation to deferred — do NOT transition the parent task
  await prisma.escalation.update({
    where: { id },
    data: {
      status: 'deferred',
      resolvedAt: new Date(),
    },
  });

  log.info({ escalationId: id, taskId: escalation.taskId }, 'Escalation deferred');

  return NextResponse.json({
    success: true,
    status: 'deferred',
  });
}
