import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

interface SkillResult {
  id: string;
  name: string;
  description: string;
  source: 'company' | 'skillssh';
  department?: string;
  status?: string;
  stars?: number;
  summary?: string;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  const sources = (request.nextUrl.searchParams.get('sources') || 'company,skillssh').split(',');

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
          summary: s.description || '',
        });
      }
      sourceStatus.company = 'ok';
    } catch {
      sourceStatus.company = 'unavailable';
    }
  }

  // 2. skills.sh via CLI (npx skills search)
  if (sources.includes('skillssh')) {
    try {
      const raw = execSync(`npx skills search "${query.replace(/"/g, '\\"')}" 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 10000,
      });

      // Strip ANSI escape codes
      const clean = raw.replace(/\x1b\[[0-9;]*m/g, '');

      // Parse results: each result is a group of lines like:
      //   owner/repo@skill-name   NNK installs
      //   https://skills.sh/...
      // Find lines matching the owner/repo@skill pattern
      const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        const match = line.match(/^(\S+\/\S+)@(\S+)\s+([\d.]+[KkMm]?)\s+installs?$/);
        if (match) {
          const repo = match[1];
          const skillName = match[2];
          const installStr = match[3];

          // Parse install count
          let installs = parseFloat(installStr);
          if (/[Kk]$/.test(installStr)) installs = parseFloat(installStr) * 1000;
          else if (/[Mm]$/.test(installStr)) installs = parseFloat(installStr) * 1000000;

          results.push({
            id: `skillssh-${repo}@${skillName}`,
            name: skillName,
            description: repo,
            source: 'skillssh',
            stars: Math.round(installs),
          });
        }
      }

      sourceStatus.skillssh = results.some(r => r.source === 'skillssh') ? 'ok' : 'ok';
    } catch {
      sourceStatus.skillssh = 'unavailable';
    }
  }

  // Sort by stars descending (per D-10)
  results.sort((a, b) => (b.stars || 0) - (a.stars || 0));

  return NextResponse.json({ results, sourceStatus });
}
