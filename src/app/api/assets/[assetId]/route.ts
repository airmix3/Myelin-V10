import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';

/**
 * GET /api/assets/[assetId]
 * Get single asset with full details.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  const { assetId } = params;

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      events: { orderBy: { createdAt: 'desc' } },
      locations: true,
    },
  });

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  // Get dependencies via raw sqlite
  const dependsOn = sqlite.prepare(
    'SELECT ad.*, a.title as targetTitle FROM asset_dependencies ad JOIN assets a ON a.id = ad.targetId WHERE ad.sourceId = ?'
  ).all(assetId);

  const dependedBy = sqlite.prepare(
    'SELECT ad.*, a.title as sourceTitle FROM asset_dependencies ad JOIN assets a ON a.id = ad.sourceId WHERE ad.targetId = ?'
  ).all(assetId);

  // Get linked tasks (steward operations + any task referencing this asset in metadata)
  const linkedTasks = sqlite.prepare(
    `SELECT id, title, state, department, "executorAgentId", "createdAt"
     FROM tasks
     WHERE metadata LIKE ?
     ORDER BY "createdAt" DESC
     LIMIT 10`
  ).all(`%${assetId}%`) as Array<{ id: string; title: string; state: string; department: string; executorAgentId: string | null; createdAt: string }>;

  // Compute ripple count
  const rippleRow = sqlite.prepare(
    'SELECT COUNT(*) as cnt FROM asset_dependencies WHERE sourceId = ?'
  ).get(assetId) as { cnt: number } | undefined;

  return NextResponse.json({
    ...asset,
    dependsOn,
    dependedBy,
    linkedTasks,
    rippleCount: rippleRow?.cnt ?? 0,
  });
}

/**
 * PATCH /api/assets/[assetId]
 * Update asset fields.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  const { assetId } = params;

  try {
    const body = await request.json();
    const { title, description, category, maturity, stewardId, returnFactors, healthStatus } = body;

    const existing = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (category !== undefined) data.category = category;
    if (maturity !== undefined) data.maturity = maturity;
    if (stewardId !== undefined) data.stewardId = stewardId;
    if (returnFactors !== undefined) data.returnFactors = JSON.stringify(returnFactors);
    if (healthStatus !== undefined) data.healthStatus = healthStatus;

    const updated = await prisma.asset.update({
      where: { id: assetId },
      data,
    });

    // If maturity changed, create maturity_change event
    if (maturity !== undefined && maturity !== existing.maturity) {
      await prisma.assetEvent.create({
        data: {
          id: generateId('aevt'),
          assetId,
          type: 'maturity_change',
          summary: `Maturity changed from ${existing.maturity} to ${maturity}`,
          metadata: JSON.stringify({ from: existing.maturity, to: maturity }),
        },
      });
    }

    // If healthStatus changed, create health_change event
    if (healthStatus !== undefined && healthStatus !== existing.healthStatus) {
      await prisma.assetEvent.create({
        data: {
          id: generateId('aevt'),
          assetId,
          type: 'health_change',
          summary: `Health status changed from ${existing.healthStatus} to ${healthStatus}`,
          metadata: JSON.stringify({ from: existing.healthStatus, to: healthStatus }),
        },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update asset', detail: String(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/assets/[assetId]
 * Hard delete asset and related records.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  const { assetId } = params;

  const existing = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!existing) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  // Delete dependencies (both directions)
  sqlite.prepare('DELETE FROM asset_dependencies WHERE sourceId = ? OR targetId = ?').run(assetId, assetId);

  // Delete events and locations (cascade via Prisma)
  await prisma.assetEvent.deleteMany({ where: { assetId } });
  await prisma.assetLocation.deleteMany({ where: { assetId } });
  await prisma.asset.delete({ where: { id: assetId } });

  return NextResponse.json({ deleted: true });
}
