import { NextRequest, NextResponse } from 'next/server';
import { activateSeed } from '@/lib/strategy/seed-activation';

/**
 * POST /api/strategy/directions/[directionId]/goals/[goalId]/seeds/[seedId]/activate
 * Activate a seed: creates a real task and returns pre-filled Tamir context.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { directionId: string; goalId: string; seedId: string } },
) {
  try {
    const result = await activateSeed(params.seedId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to activate seed', detail: String(err) },
      { status: 500 },
    );
  }
}
