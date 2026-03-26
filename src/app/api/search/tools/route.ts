import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface ToolResult {
  id: string;
  name: string;
  description: string;
  source: 'company' | 'glama' | 'composio';
  stars?: number;
  department?: string;
  url?: string;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  const sources = (request.nextUrl.searchParams.get('sources') || 'company,glama,composio').split(',');

  const results: ToolResult[] = [];
  const sourceStatus: Record<string, 'ok' | 'unavailable'> = {};

  // 1. Company DB (always works)
  if (sources.includes('company')) {
    try {
      const tools = await prisma.mcpServer.findMany({
        where: query ? { name: { contains: query } } : {},
        take: 20,
      });
      for (const t of tools) {
        results.push({
          id: `company-${t.id}`,
          name: t.name,
          description: t.description || '',
          source: 'company',
          stars: t.toolCount, // use toolCount as proxy for relevance
        });
      }
      sourceStatus.company = 'ok';
    } catch {
      sourceStatus.company = 'unavailable';
    }
  }

  // 2. Glama (free, no auth — LOW confidence per Research, graceful fallback)
  if (sources.includes('glama')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://glama.ai/api/mcp/servers?search=${encodeURIComponent(query)}&limit=20`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        // Adapt response shape — exact format unknown, handle gracefully
        const items = Array.isArray(data) ? data : (data.servers || data.results || data.data || []);
        for (const item of items.slice(0, 20)) {
          results.push({
            id: `glama-${item.id || item.name}`,
            name: item.name || item.title || 'Unknown',
            description: item.description || '',
            source: 'glama',
            stars: item.stars || item.weekly_downloads || 0,
            url: item.url || item.homepage || undefined,
          });
        }
        sourceStatus.glama = 'ok';
      } else {
        sourceStatus.glama = 'unavailable';
      }
    } catch {
      sourceStatus.glama = 'unavailable';
    }
  }

  // 3. Composio (requires API key)
  if (sources.includes('composio')) {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) {
      sourceStatus.composio = 'unavailable';
    } else {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          `https://backend.composio.dev/api/v3/toolkits?limit=20${query ? `&search=${encodeURIComponent(query)}` : ''}`,
          {
            headers: { 'x-api-key': apiKey },
            signal: controller.signal,
          },
        );
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.toolkits || data.results || data.items || []);
          for (const item of items.slice(0, 20)) {
            results.push({
              id: `composio-${item.id || item.name}`,
              name: item.name || item.title || 'Unknown',
              description: item.description || '',
              source: 'composio',
              stars: item.stars || item.popularity || 0,
            });
          }
          sourceStatus.composio = 'ok';
        } else {
          sourceStatus.composio = 'unavailable';
        }
      } catch {
        sourceStatus.composio = 'unavailable';
      }
    }
  }

  // Sort by stars descending (per D-10)
  results.sort((a, b) => (b.stars || 0) - (a.stars || 0));

  return NextResponse.json({ results, sourceStatus });
}
