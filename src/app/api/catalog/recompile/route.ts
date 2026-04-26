/**
 * POST /api/catalog/recompile — Manual catalog recompilation trigger.
 * Recompiles one or all department catalogs.
 */
import { NextResponse } from 'next/server';
import { compileCatalog } from '@/lib/catalog';

const ALL_DEPARTMENTS = ['cos', 'tech', 'marketing', 'operations'];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { department } = body as { department?: string };

    if (department && !ALL_DEPARTMENTS.includes(department)) {
      return NextResponse.json(
        { error: `Invalid department. Must be one of: ${ALL_DEPARTMENTS.join(', ')}` },
        { status: 400 },
      );
    }

    const departments = department ? [department] : ALL_DEPARTMENTS;
    const results = departments.map((dept) => compileCatalog(dept));

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
