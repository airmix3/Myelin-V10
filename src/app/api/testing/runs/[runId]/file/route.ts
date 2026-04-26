import { NextRequest } from 'next/server';
import { resolve, extname } from 'path';
import { readFileSync, statSync, existsSync } from 'fs';

const RUNS_DIR = resolve(process.cwd(), 'test_data/runs');

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

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const { runId } = params;

  // Validate runId
  if (runId.includes('..') || runId.includes('/') || runId.includes('\\')) {
    return new Response('Invalid run ID', { status: 400 });
  }

  const runDir = resolve(RUNS_DIR, runId);

  // Get requested path
  const requestedPath = request.nextUrl.searchParams.get('path');
  if (!requestedPath) {
    return new Response('Missing path parameter', { status: 400 });
  }

  // Resolve target file
  const target = resolve(runDir, requestedPath);

  // Path traversal prevention
  if (!target.startsWith(resolve(runDir))) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!existsSync(target)) {
    return new Response('File not found', { status: 404 });
  }

  const stat = statSync(target);
  if (!stat.isFile()) {
    return new Response('Not a file', { status: 400 });
  }

  const ext = extname(target).toLowerCase();
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
