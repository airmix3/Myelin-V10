/**
 * POST /onboarding/api/upload -- File upload with classification and provenance.
 *
 * Per D-19: Guided category walkthrough. Files classified to Vault/Knowledge/SharedLib/Asset.
 * Writes a .meta.json provenance sidecar alongside each uploaded file.
 * Text-based files (md, txt, json, csv) are indexed in FTS5 documents table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { dataPath } from '@/lib/paths';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'onboarding-upload' });

// Valid destination types
const VALID_DESTINATIONS = ['vault', 'knowledge', 'sharedlib', 'asset'] as const;
type Destination = (typeof VALID_DESTINATIONS)[number];

// Destinations that require a department
const DEPT_REQUIRED: Destination[] = ['knowledge', 'sharedlib'];

// Text-based extensions eligible for FTS5 indexing
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.csv']);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract fields
    const file = formData.get('file') as File | null;
    const category = formData.get('category') as string | null;
    const destination = formData.get('destination') as string | null;
    const department = formData.get('department') as string | null;

    // Validate file
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: 'No file provided or file is empty' },
        { status: 400 },
      );
    }

    // Validate destination
    if (!destination || !VALID_DESTINATIONS.includes(destination as Destination)) {
      return NextResponse.json(
        { error: `Invalid destination. Must be one of: ${VALID_DESTINATIONS.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate department when required
    if (DEPT_REQUIRED.includes(destination as Destination) && !department?.trim()) {
      return NextResponse.json(
        { error: `Department is required for destination: ${destination}` },
        { status: 400 },
      );
    }

    // Read file as Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Determine target directory based on destination
    let targetDir: string;
    switch (destination as Destination) {
      case 'vault':
        targetDir = dataPath('vault');
        break;
      case 'knowledge':
        targetDir = dataPath('departments', department!.trim(), 'knowledge');
        break;
      case 'sharedlib':
        targetDir = dataPath('departments', department!.trim(), 'sharedlib');
        break;
      case 'asset':
        targetDir = dataPath('vault');
        break;
      default:
        targetDir = dataPath('vault');
    }

    // Create directory
    mkdirSync(targetDir, { recursive: true });

    // Write file
    const filePath = join(targetDir, file.name);
    writeFileSync(filePath, buffer);

    // Write provenance sidecar .meta.json
    const meta = {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      source: 'onboarding',
      phase: 9,
      category: category || 'uncategorized',
      destination,
      size: buffer.length,
      mimeType: file.type || 'application/octet-stream',
      description: '',
    };

    const metaPath = join(targetDir, `${file.name}.meta.json`);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

    // Index text-based files in FTS5 if applicable
    const ext = extname(file.name).toLowerCase();
    if (TEXT_EXTENSIONS.has(ext)) {
      try {
        // Dynamic import to avoid importing DB at module level (edge compat)
        const { prisma } = await import('@/lib/db');
        const { generateId } = await import('@/lib/id');

        const content = buffer.toString('utf-8');
        const docId = generateId('doc');
        const source = destination === 'knowledge' ? 'knowledge' : 'vault';

        await prisma.document.create({
          data: {
            id: docId,
            title: file.name,
            content,
            source,
            department: department || null,
            filePath,
          },
        });

        log.info({ docId, file: file.name }, 'Indexed text file in FTS5');
      } catch (ftsErr) {
        // Non-critical: log but don't fail the upload
        log.warn({ err: ftsErr, file: file.name }, 'FTS5 indexing failed (non-critical)');
      }
    }

    log.info({ file: file.name, destination, category }, 'File uploaded during onboarding');

    return NextResponse.json({
      success: true,
      path: filePath,
      meta,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, 'File upload failed');
    return NextResponse.json(
      { error: `Upload failed: ${msg}` },
      { status: 500 },
    );
  }
}
