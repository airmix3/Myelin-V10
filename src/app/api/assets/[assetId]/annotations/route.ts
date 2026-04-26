import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';

/**
 * POST /api/assets/[assetId]/annotations
 * Add an annotation to an asset.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  const { assetId } = params;

  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Parse existing annotations or start fresh
    const existing: Array<{ text: string; createdAt: string }> = asset.annotations
      ? JSON.parse(asset.annotations)
      : [];

    const annotation = { text, createdAt: new Date().toISOString() };
    existing.push(annotation);

    // Update asset annotations
    await prisma.asset.update({
      where: { id: assetId },
      data: { annotations: JSON.stringify(existing) },
    });

    // Create annotation event
    await prisma.assetEvent.create({
      data: {
        id: generateId('aevt'),
        assetId,
        type: 'annotation',
        summary: `Annotation added: "${text.substring(0, 100)}"`,
      },
    });

    return NextResponse.json(existing, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to add annotation', detail: String(err) }, { status: 500 });
  }
}
