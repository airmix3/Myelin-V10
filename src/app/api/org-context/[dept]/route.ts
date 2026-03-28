import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const DATA_DIR = resolve(process.cwd(), 'data');
const AGENTS_DIR = resolve(process.cwd(), 'src', 'agents');

export async function GET(request: NextRequest, { params }: { params: { dept: string } }) {
  const { dept } = params;
  const validDepts = ['tech', 'marketing', 'operations'];
  if (!validDepts.includes(dept)) {
    return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
  }

  // Fetch employees in this department
  const employees = await prisma.employee.findMany({
    where: { department: dept },
    include: {
      tasks: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, state: true, createdAt: true },
      },
    },
  });

  // Read agent MEMORY.md files for each employee with an agentId
  const agentMemories: Record<string, string> = {};
  for (const emp of employees) {
    if (emp.agentId) {
      const memPath = join(DATA_DIR, 'agents', emp.agentId, 'MEMORY.md');
      if (existsSync(memPath)) {
        agentMemories[emp.agentId] = readFileSync(memPath, 'utf-8');
      }
    }
  }

  // Read knowledge files from data/departments/{dept}/knowledge/
  const knowledgeDir = join(DATA_DIR, 'departments', dept, 'knowledge');
  const knowledgeFiles: Array<{ name: string; content: string }> = [];
  if (existsSync(knowledgeDir)) {
    for (const file of readdirSync(knowledgeDir).filter(f => f.endsWith('.md'))) {
      knowledgeFiles.push({
        name: file.replace('.md', ''),
        content: readFileSync(join(knowledgeDir, file), 'utf-8'),
      });
    }
  }

  // Read agent card.json files
  const agentCards: Record<string, unknown> = {};
  for (const emp of employees) {
    if (emp.agentId) {
      const cardPath = join(AGENTS_DIR, emp.agentId, 'card.json');
      if (existsSync(cardPath)) {
        try {
          agentCards[emp.agentId] = JSON.parse(readFileSync(cardPath, 'utf-8'));
        } catch {
          // Skip invalid card files
        }
      }
    }
  }

  // Fetch skills for this department
  const skills = await prisma.skill.findMany({
    where: { department: dept },
    orderBy: { createdAt: 'desc' },
  });

  // Scan for installed tools in data/departments/{dept}/tools/
  const toolsDir = join(DATA_DIR, 'departments', dept, 'tools');
  const tools: Array<{ name: string; directory: string; description?: string }> = [];
  if (existsSync(toolsDir)) {
    for (const entry of readdirSync(toolsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const toolDir = join(toolsDir, entry.name);
      const tool: { name: string; directory: string; description?: string } = {
        name: entry.name,
        directory: toolDir,
      };
      // Try to read package.json for description
      const pkgPath = join(toolDir, 'package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          if (pkg.description) tool.description = pkg.description;
          if (pkg.name) tool.name = pkg.name;
        } catch {
          // Skip invalid package.json
        }
      }
      tools.push(tool);
    }
  }

  return NextResponse.json({ employees, agentMemories, agentCards, knowledgeFiles, skills, tools });
}
