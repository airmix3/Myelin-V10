import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';

/**
 * GET /api/assets/[assetId]/dependencies
 * List dependencies for an asset (both directions) with ripple count.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  const { assetId } = params;

  // Assets this asset depends on
  const dependsOn = sqlite.prepare(
    'SELECT ad.*, a.title as targetTitle FROM asset_dependencies ad JOIN assets a ON a.id = ad.targetId WHERE ad.sourceId = ?'
  ).all(assetId);

  // Assets that depend on this asset
  const dependedBy = sqlite.prepare(
    'SELECT ad.*, a.title as sourceTitle FROM asset_dependencies ad JOIN assets a ON a.id = ad.sourceId WHERE ad.targetId = ?'
  ).all(assetId);

  // Ripple count: how many assets are transitively affected
  const rippleResult = sqlite.prepare(`
    WITH RECURSIVE ripple(id) AS (
      SELECT sourceId FROM asset_dependencies WHERE targetId = ?
      UNION
      SELECT ad.sourceId FROM asset_dependencies ad JOIN ripple r ON ad.targetId = r.id
    )
    SELECT COUNT(*) as rippleCount FROM ripple
  `).get(assetId) as { rippleCount: number } | undefined;

  return NextResponse.json({
    dependsOn,
    dependedBy,
    rippleCount: rippleResult?.rippleCount || 0,
  });
}

/**
 * POST /api/assets/[assetId]/dependencies
 * Add a dependency from this asset to another.
 * Body: { targetId, label? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  const { assetId } = params;

  try {
    const body = await request.json();
    const { targetId, label } = body;

    if (!targetId) {
      return NextResponse.json({ error: 'targetId is required' }, { status: 400 });
    }

    // Verify both assets exist
    const [source, target] = await Promise.all([
      prisma.asset.findUnique({ where: { id: assetId } }),
      prisma.asset.findUnique({ where: { id: targetId } }),
    ]);

    if (!source) {
      return NextResponse.json({ error: 'Source asset not found' }, { status: 404 });
    }
    if (!target) {
      return NextResponse.json({ error: 'Target asset not found' }, { status: 404 });
    }

    const id = generateId('adep');

    // Insert via raw sqlite (AssetDependency has no Prisma relation to Asset)
    sqlite.prepare(
      'INSERT INTO asset_dependencies (id, sourceId, targetId, label, createdAt) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(id, assetId, targetId, label || null);

    // Create dependency_added event on the source asset
    await prisma.assetEvent.create({
      data: {
        id: generateId('aevt'),
        assetId,
        type: 'dependency_added',
        summary: `Dependency added: depends on "${target.title}"`,
        metadata: JSON.stringify({ targetId, targetTitle: target.title }),
      },
    });

    return NextResponse.json({ id, sourceId: assetId, targetId, label: label || null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to add dependency', detail: String(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/assets/[assetId]/dependencies
 * Delete a dependency. Query param: ?dependencyId=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  const { searchParams } = new URL(request.url);
  const dependencyId = searchParams.get('dependencyId');

  if (!dependencyId) {
    return NextResponse.json({ error: 'dependencyId query param is required' }, { status: 400 });
  }

  const existing = sqlite.prepare(
    'SELECT * FROM asset_dependencies WHERE id = ? AND (sourceId = ? OR targetId = ?)'
  ).get(dependencyId, params.assetId, params.assetId);

  if (!existing) {
    return NextResponse.json({ error: 'Dependency not found for this asset' }, { status: 404 });
  }

  sqlite.prepare('DELETE FROM asset_dependencies WHERE id = ?').run(dependencyId);

  return NextResponse.json({ deleted: true });
}
