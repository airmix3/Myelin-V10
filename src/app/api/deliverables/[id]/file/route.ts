import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readFileSync, statSync, existsSync, readdirSync } from 'fs';
import path from 'path';

/**
 * GET /api/deliverables/[id]/file
 * Per DELIV-05: Serve workspace files with path traversal prevention.
 * Supports ?list=true for file listing (used by FilesPanel in Plan 03).
 * Supports ?path=... for serving individual files.
 */

// Extension -> MIME type mapping (per Doc 07, ~8 types + extras)
const MIME_MAP: Record<string, string> = {
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.py': 'text/x-python',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

// Recursively list files in a directory
function listFilesRecursive(dir: string, baseDir: string): Array<{ name: string; path: string; size: number; isDeliverable: boolean }> {
  const results: Array<{ name: string; path: string; size: number; isDeliverable: boolean }> = [];
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath, baseDir));
    } else {
      const relativePath = path.relative(baseDir, fullPath);
      results.push({
        name: entry.name,
        path: relativePath,
        size: statSync(fullPath).size,
        isDeliverable: relativePath.startsWith('deliverables/') || relativePath.startsWith('deliverables\\'),
      });
    }
  }
  return results;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: deliverableId } = params;

  const deliverable = await prisma.deliverable.findUnique({ where: { id: deliverableId } });
  if (!deliverable || !deliverable.workspacePath) {
    return new Response('Deliverable not found', { status: 404 });
  }

  // Use workspacePath directly as workspace root (contains both desk/ and deliverables/)
  const workspaceRoot = path.resolve(deliverable.workspacePath);

  // List mode: return JSON array of all files in workspace
  if (request.nextUrl.searchParams.get('list') === 'true') {
    const files = listFilesRecursive(workspaceRoot, workspaceRoot);
    return NextResponse.json({ files });
  }

  // File serve mode: return single file content
  const requestedPath = request.nextUrl.searchParams.get('path');

  if (!requestedPath) {
    return new Response('Missing path parameter', { status: 400 });
  }

  const target = path.resolve(workspaceRoot, requestedPath);

  // Path traversal prevention (Pitfall 6)
  if (!target.startsWith(path.resolve(workspaceRoot))) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!existsSync(target)) {
    return new Response('File not found', { status: 404 });
  }

  const stat = statSync(target);
  if (!stat.isFile()) {
    return new Response('Not a file', { status: 400 });
  }

  const ext = path.extname(target).toLowerCase();
  const mime = MIME_MAP[ext] || 'application/octet-stream';
  const content = readFileSync(target);

  return new Response(content, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(stat.size),
      'Cache-Control': 'no-cache',
    },
  });
}
