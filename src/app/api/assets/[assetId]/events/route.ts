import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/assets/[assetId]/events
 * List events for an asset, ordered by createdAt desc.
 * Query param: ?limit=50 (default 50)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  const { assetId } = params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const events = await prisma.assetEvent.findMany({
    where: { assetId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json(events);
}
