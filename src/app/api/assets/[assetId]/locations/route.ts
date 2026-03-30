import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';

/**
 * GET /api/assets/[assetId]/locations
 * List locations for an asset.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  const { assetId } = params;

  const locations = await prisma.assetLocation.findMany({
    where: { assetId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(locations);
}

/**
 * POST /api/assets/[assetId]/locations
 * Add a location to an asset.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  const { assetId } = params;

  try {
    const body = await request.json();
    const { type, value, label, isCanonical } = body;

    if (!type || !value) {
      return NextResponse.json({ error: 'type and value are required' }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // If setting as canonical, unset all existing canonical locations
    if (isCanonical) {
      await prisma.assetLocation.updateMany({
        where: { assetId, isCanonical: true },
        data: { isCanonical: false },
      });
    }

    const location = await prisma.assetLocation.create({
      data: {
        id: generateId('aloc'),
        assetId,
        type,
        value,
        label: label || null,
        isCanonical: isCanonical || false,
      },
    });

    // Create location_added event
    await prisma.assetEvent.create({
      data: {
        id: generateId('aevt'),
        assetId,
        type: 'location_added',
        summary: `Location added: ${type} - ${value}`,
      },
    });

    return NextResponse.json(location, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to add location', detail: String(err) }, { status: 500 });
  }
}

/**
 * PATCH /api/assets/[assetId]/locations
 * Update a location. Body: { locationId, isCanonical?, label? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  const { assetId } = params;

  try {
    const body = await request.json();
    const { locationId, isCanonical, label } = body;

    if (!locationId) {
      return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
    }

    const existing = await prisma.assetLocation.findUnique({ where: { id: locationId } });
    if (!existing || existing.assetId !== assetId) {
      return NextResponse.json({ error: 'Location not found for this asset' }, { status: 404 });
    }

    // If setting as canonical, unset all others first
    if (isCanonical) {
      await prisma.assetLocation.updateMany({
        where: { assetId, isCanonical: true },
        data: { isCanonical: false },
      });
    }

    const data: Record<string, unknown> = {};
    if (isCanonical !== undefined) data.isCanonical = isCanonical;
    if (label !== undefined) data.label = label;

    const updated = await prisma.assetLocation.update({
      where: { id: locationId },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update location', detail: String(err) }, { status: 500 });
  }
}
