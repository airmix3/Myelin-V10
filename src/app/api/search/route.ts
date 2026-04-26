import { searchAllDocuments } from '@/lib/fts';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  if (!query.trim()) {
    return NextResponse.json({ results: [], deliverables: {} });
  }

  try {
    const results = searchAllDocuments(query, 50);

    // Look up deliverable metadata for any deliverable-source results
    const deliverableDocIds = results
      .filter((r) => r.source === 'deliverable')
      .map((r) => r.id);

    const deliverables: Record<string, {
      id: string;
      title: string;
      type: string | null;
      status: string;
      department: string;
    }> = {};

    if (deliverableDocIds.length > 0) {
      // Find deliverables whose title matches any of the document titles
      const deliverableTitles = results
        .filter((r) => r.source === 'deliverable')
        .map((r) => r.title);

      const dbDeliverables = await prisma.deliverable.findMany({
        where: { title: { in: deliverableTitles } },
        select: { id: true, title: true, type: true, status: true, department: true },
      });

      // Map by title to doc ID for client lookup
      for (const result of results) {
        if (result.source === 'deliverable') {
          const match = dbDeliverables.find((d) => d.title === result.title);
          if (match) {
            deliverables[result.id] = {
              id: match.id,
              title: match.title,
              type: match.type,
              status: match.status,
              department: match.department,
            };
          }
        }
      }
    }

    return NextResponse.json({ results, deliverables });
  } catch {
    return NextResponse.json(
      { results: [], deliverables: {}, error: 'Search is temporarily unavailable.' },
      { status: 500 },
    );
  }
}
