import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/escalations
 * Query params: ?status=pending (default), ?status=all
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';

  const where = status === 'all' ? {} : { status };

  const escalations = await prisma.escalation.findMany({
    where,
    include: {
      task: {
        select: { title: true, department: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(escalations);
}
