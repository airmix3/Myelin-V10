import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface ToolResult {
  id: string;
  name: string;
  description: string;
  source: 'company' | 'smithery';
  stars?: number;
  department?: string;
  url?: string;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  const sources = (request.nextUrl.searchParams.get('sources') || 'company,smithery').split(',');

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

  // 2. Smithery (public registry, no auth needed)
  if (sources.includes('smithery')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://registry.smithery.ai/servers?q=${encodeURIComponent(query)}&pageSize=20`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const items = data.servers || [];
        for (const item of items) {
          results.push({
            id: `smithery-${item.qualifiedName}`,
            name: item.displayName || item.qualifiedName,
            description: item.description || '',
            source: 'smithery',
            stars: item.useCount || 0,
            url: item.homepage || `https://smithery.ai/servers/${item.qualifiedName}`,
          });
        }
        sourceStatus.smithery = 'ok';
      } else {
        sourceStatus.smithery = 'unavailable';
      }
    } catch {
      sourceStatus.smithery = 'unavailable';
    }
  }

  // Sort by stars descending (per D-10)
  results.sort((a, b) => (b.stars || 0) - (a.stars || 0));

  return NextResponse.json({ results, sourceStatus });
}
