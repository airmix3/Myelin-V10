import { NextResponse } from 'next/server';
import { resolve } from 'path';
import { existsSync, writeFileSync } from 'fs';

const RUNS_DIR = resolve(process.cwd(), 'test_data/runs');

const VALID_STATUSES = ['pass', 'fail', 'needs-work'] as const;

export async function POST(
  request: Request,
  { params }: { params: { runId: string } }
) {
  const { runId } = params;

  // Path traversal check
  if (runId.includes('..') || runId.includes('/') || runId.includes('\\')) {
    return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 });
  }

  const runDir = resolve(RUNS_DIR, runId);
  if (!existsSync(runDir)) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  let body: { status: string; notes: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  const verdict = {
    status: body.status,
    notes: body.notes || '',
    timestamp: new Date().toISOString(),
  };

  writeFileSync(resolve(runDir, 'verdict.json'), JSON.stringify(verdict, null, 2));

  return NextResponse.json(verdict);
}
