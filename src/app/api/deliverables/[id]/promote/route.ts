/**
 * POST /api/deliverables/[id]/promote
 * Promote a deliverable to a company asset (new or existing).
 * Per D-01, D-03, D-04, D-05.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { mkdirSync, readdirSync, copyFileSync, existsSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { dataPath } from '@/lib/paths';
import { initAssetRepo, commitToAsset, createAssetBranch, mergeAssetBranch } from '@/lib/asset-repo';
import { logger } from '@/lib/logger';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  let body: {
    title: string;
    description?: string;
    category: string;
    stewardId: string;
    intent?: string;
    returnFactors?: string[];
    existingAssetId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.title || !body.category || !body.stewardId) {
    return NextResponse.json({ error: 'title, category, and stewardId are required' }, { status: 400 });
  }

  // Fetch deliverable with task relation
  const deliverable = await prisma.deliverable.findUnique({
    where: { id },
    include: { task: true },
  });

  if (!deliverable) {
    return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });
  }

  /**
   * Helper: copy all files from a source directory to a target directory.
   */
  function copyDirectoryContents(srcDir: string, destDir: string): void {
    if (!existsSync(srcDir)) return;
    mkdirSync(destDir, { recursive: true });
    const entries = readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(srcDir, entry.name);
      const destPath = join(destDir, entry.name);
      if (entry.isFile()) {
        copyFileSync(srcPath, destPath);
      } else if (entry.isDirectory()) {
        copyDirectoryContents(srcPath, destPath);
      }
    }
  }

  // Determine source deliverable files directory
  const deliverableFilesDir = deliverable.workspacePath
    ? join(deliverable.workspacePath, 'deliverables')
    : null;

  try {
    // --- Absorb into existing asset (per D-05) ---
    if (body.existingAssetId) {
      const existingAsset = await prisma.asset.findUnique({ where: { id: body.existingAssetId } });
      if (!existingAsset) {
        return NextResponse.json({ error: 'Existing asset not found' }, { status: 404 });
      }

      // Copy files to existing asset directory (with git branch isolation)
      if (deliverableFilesDir && existingAsset.directoryPath) {
        try {
          createAssetBranch(existingAsset.directoryPath, 'absorb-' + id);
          copyDirectoryContents(deliverableFilesDir, existingAsset.directoryPath);
          commitToAsset(existingAsset.directoryPath, `Absorb deliverable: ${deliverable.title}`);
          mergeAssetBranch(existingAsset.directoryPath, 'absorb-' + id);
        } catch (err) {
          // Git operations failed — still copy files without version tracking
          logger.child({ module: 'promote' }).warn({ err, assetDir: existingAsset.directoryPath }, 'Git branch/merge failed for absorb (non-blocking)');
          copyDirectoryContents(deliverableFilesDir, existingAsset.directoryPath);
        }
      }

      // Create deliverable_absorbed event
      await prisma.assetEvent.create({
        data: {
          id: generateId('aevt'),
          assetId: body.existingAssetId,
          type: 'deliverable_absorbed',
          summary: `Absorbed deliverable: ${deliverable.title}`,
          metadata: JSON.stringify({
            deliverableId: id,
            deliverableTitle: deliverable.title,
          }),
        },
      });

      // Link deliverable to asset
      await prisma.deliverable.update({
        where: { id },
        data: { assetId: body.existingAssetId },
      });

      return NextResponse.json(existingAsset, { status: 200 });
    }

    // --- Create new asset ---
    const assetId = generateId('asset');
    const assetDir = resolve(process.cwd(), 'data', 'assets', assetId);
    mkdirSync(assetDir, { recursive: true });

    // Copy deliverable files to asset directory
    if (deliverableFilesDir) {
      copyDirectoryContents(deliverableFilesDir, assetDir);
    }

    // Initialize git repo and make initial commit
    try {
      initAssetRepo(assetDir);
      commitToAsset(assetDir, `Initial asset creation from deliverable: ${deliverable.title}`);
    } catch (err) {
      logger.child({ module: 'promote' }).warn({ err, assetDir }, 'Git init/commit failed for new asset (non-blocking)');
    }

    // Create Asset record
    const newAsset = await prisma.asset.create({
      data: {
        id: assetId,
        title: body.title,
        description: body.description || deliverable.task?.description || null,
        category: body.category,
        stewardId: body.stewardId,
        returnFactors: body.returnFactors ? JSON.stringify(body.returnFactors) : null,
        directoryPath: assetDir,
      },
    });

    // Create creation event
    await prisma.assetEvent.create({
      data: {
        id: generateId('aevt'),
        assetId,
        type: 'creation',
        summary: `Asset created from deliverable: ${deliverable.title}`,
        metadata: JSON.stringify({
          source: 'deliverable_promotion',
          deliverableId: id,
        }),
      },
    });

    // Create promotion event
    await prisma.assetEvent.create({
      data: {
        id: generateId('aevt'),
        assetId,
        type: 'promotion',
        summary: body.intent
          ? `Promoted with intent: ${body.intent}`
          : `Promoted from deliverable: ${deliverable.title}`,
        metadata: JSON.stringify({
          deliverableId: id,
          deliverableTitle: deliverable.title,
          intent: body.intent || null,
        }),
      },
    });

    // Link deliverable to asset
    await prisma.deliverable.update({
      where: { id },
      data: { assetId },
    });

    return NextResponse.json(newAsset, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to promote deliverable' },
      { status: 500 },
    );
  }
}
