import { searchDocuments } from '@/lib/fts';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }
  try {
    const results = searchDocuments(query, 20);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { results: [], error: 'Search is temporarily unavailable.' },
      { status: 500 },
    );
  }
}
