import { NextRequest, NextResponse } from 'next/server';
import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

/**
 * GET /api/assets
 * List all assets with recent events and locations.
 * Query params: ?search=query (FTS5 search), ?category=code, ?stewardId=cto
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const category = searchParams.get('category');
  const stewardId = searchParams.get('stewardId');

  // FTS5 search path
  if (search) {
    const { searchAssets } = await import('@/lib/asset-fts');
    const results = searchAssets(search);
    return NextResponse.json(results);
  }

  // Standard list with filters
  const where: Record<string, string> = {};
  if (category) where.category = category;
  if (stewardId) where.stewardId = stewardId;

  const assets = await prisma.asset.findMany({
    where,
    include: {
      events: { orderBy: { createdAt: 'desc' }, take: 5 },
      locations: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Attach dependency counts via raw sqlite
  const depCounts = sqlite.prepare(`
    SELECT sourceId as id, COUNT(*) as count FROM asset_dependencies GROUP BY sourceId
  `).all() as Array<{ id: string; count: number }>;
  const depMap = new Map(depCounts.map(d => [d.id, d.count]));

  const enriched = assets.map(a => ({
    ...a,
    dependencyCount: depMap.get(a.id) || 0,
  }));

  return NextResponse.json(enriched);
}

/**
 * POST /api/assets
 * Create a new asset.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, category, stewardId, returnFactors, maturity, initialLocation } = body;

    if (!title || !category) {
      return NextResponse.json({ error: 'title and category are required' }, { status: 400 });
    }

    const id = generateId('asset');
    const dirPath = resolve(process.cwd(), 'data', 'assets', id);
    mkdirSync(dirPath, { recursive: true });

    const asset = await prisma.asset.create({
      data: {
        id,
        title,
        description: description || null,
        category,
        maturity: maturity || 'nascent',
        stewardId: stewardId || null,
        returnFactors: returnFactors ? JSON.stringify(returnFactors) : null,
        healthStatus: 'healthy',
        directoryPath: `data/assets/${id}/`,
      },
    });

    // Create creation event
    await prisma.assetEvent.create({
      data: {
        id: generateId('aevt'),
        assetId: id,
        type: 'creation',
        summary: `Asset "${title}" created in category ${category}`,
      },
    });

    // Create initial location if provided
    if (initialLocation) {
      await prisma.assetLocation.create({
        data: {
          id: generateId('aloc'),
          assetId: id,
          type: initialLocation.type || 'local_path',
          value: initialLocation.value,
          label: initialLocation.label || null,
          isCanonical: true,
        },
      });
    }

    return NextResponse.json(asset, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create asset', detail: String(err) }, { status: 500 });
  }
}
