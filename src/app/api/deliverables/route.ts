import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/deliverables
 * List deliverables, optionally filtered by taskId.
 * Returns { deliverables: [{ id, title, status, department, taskId }] }
 */
export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId');

  const where = taskId ? { taskId } : {};

  const deliverables = await prisma.deliverable.findMany({
    where,
    select: { id: true, title: true, status: true, department: true, taskId: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ deliverables });
}
