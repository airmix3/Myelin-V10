import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface SkillResult {
  id: string;
  name: string;
  description: string;
  source: 'company' | 'clawhub';
  department?: string;
  status?: string;
  stars?: number;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  const sources = (request.nextUrl.searchParams.get('sources') || 'company,clawhub').split(',');

  const results: SkillResult[] = [];
  const sourceStatus: Record<string, 'ok' | 'unavailable'> = {};

  // 1. Company DB (always works)
  if (sources.includes('company')) {
    try {
      const skills = await prisma.skill.findMany({
        where: {
          status: { in: ['active', 'approved'] },
          ...(query ? { name: { contains: query } } : {}),
        },
        take: 20,
      });
      for (const s of skills) {
        results.push({
          id: `company-${s.id}`,
          name: s.name,
          description: s.description || '',
          source: 'company',
          department: s.department,
          status: s.status,
        });
      }
      sourceStatus.company = 'ok';
    } catch {
      sourceStatus.company = 'unavailable';
    }
  }

  // 2. ClawHub (domain doesn't resolve per Research — always unavailable in practice)
  if (sources.includes('clawhub')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://hub.openclaw.ai/api/skills?q=${encodeURIComponent(query)}&limit=20`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.skills || data.results || []);
        for (const item of items.slice(0, 20)) {
          results.push({
            id: `clawhub-${item.id || item.name}`,
            name: item.name || 'Unknown',
            description: item.description || '',
            source: 'clawhub',
            stars: item.stars || 0,
          });
        }
        sourceStatus.clawhub = 'ok';
      } else {
        sourceStatus.clawhub = 'unavailable';
      }
    } catch {
      sourceStatus.clawhub = 'unavailable';
    }
  }

  // Sort by stars descending (per D-10)
  results.sort((a, b) => (b.stars || 0) - (a.stars || 0));

  return NextResponse.json({ results, sourceStatus });
}
