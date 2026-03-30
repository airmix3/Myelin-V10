/**
 * Steward chat endpoint -- POST /api/assets/[assetId]/chat
 * Invokes the assigned steward agent with asset context.
 */
import { NextResponse } from 'next/server';
import { invokeSteward } from '@/lib/steward';
import { prisma } from '@/lib/db';

export const maxDuration = 120; // Steward invocations can take time

export async function POST(request: Request, { params }: { params: { assetId: string } }) {
  const { assetId } = params;
  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  // Look up asset to get stewardId
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
  if (!asset.stewardId) {
    return NextResponse.json({ error: 'No steward assigned to this asset' }, { status: 400 });
  }

  try {
    const result = await invokeSteward({
      assetId,
      agentId: asset.stewardId,
      prompt: message,
    });

    return NextResponse.json({
      response: result.response,
      taskId: result.taskId,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Steward invocation failed' }, { status: 500 });
  }
}
