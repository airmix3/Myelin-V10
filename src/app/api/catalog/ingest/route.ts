/**
 * POST /api/catalog/ingest — CEO-triggered deliverable ingestion into sharedlib.
 * Copies a deliverable file, creates provenance sidecar, recompiles catalog.
 */
import { NextResponse } from 'next/server';
import { ingestDeliverable, compileCatalog } from '@/lib/catalog';

const VALID_DEPARTMENTS = ['cos', 'tech', 'marketing', 'operations'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { department, taskId, deliverablePath, description, agentId } = body;

    if (!department || !VALID_DEPARTMENTS.includes(department)) {
      return NextResponse.json(
        { error: `Invalid department. Must be one of: ${VALID_DEPARTMENTS.join(', ')}` },
        { status: 400 },
      );
    }

    if (!taskId || !deliverablePath || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, deliverablePath, description' },
        { status: 400 },
      );
    }

    const destPath = ingestDeliverable({
      department,
      sourceTaskId: taskId,
      agentId: agentId || 'ceo',
      deliverablePath,
      description,
    });

    const stats = compileCatalog(department);

    return NextResponse.json({
      success: true,
      ingestedTo: destPath,
      catalogStats: stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
