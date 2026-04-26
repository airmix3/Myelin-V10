import { NextRequest, NextResponse } from 'next/server';
import { invokeAgent } from '@/lib/invoke-agent';
import { generateId } from '@/lib/id';
import { prisma } from '@/lib/db';
import { resolve } from 'path';
import { mkdirSync, existsSync, writeFileSync } from 'fs';

const DATA_DIR = resolve(process.cwd(), 'data');
const VALID_DEPTS = ['tech', 'marketing', 'operations'];

export async function POST(
  request: NextRequest,
  { params }: { params: { dept: string; skillId: string } }
) {
  const { dept, skillId } = params;

  if (!VALID_DEPTS.includes(dept)) {
    return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
  }

  try {
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const { orchestrator } = await import('@/lib/orchestrator');
    const tamirAgent = orchestrator.getAgent('tamir');
    if (!tamirAgent) {
      return NextResponse.json({ error: 'Tamir agent not found' }, { status: 500 });
    }

    const deskDir = resolve(DATA_DIR, 'departments', 'cos');
    const delivDir = resolve(deskDir, 'deliverables');
    mkdirSync(delivDir, { recursive: true });
    const manifestPath = resolve(delivDir, 'deliverable_manifest.json');
    if (!existsSync(manifestPath)) {
      writeFileSync(manifestPath, '[]', 'utf-8');
    }

    const runId = generateId('run');
    const taskId = `sys-manage-${Date.now()}`;

    await invokeAgent({
      taskId,
      runId,
      agentId: 'tamir',
      department: 'cos',
      prompt: `Follow your skill-tool-manager skill. Remove skill: ${skill.name} at path ${skill.filePath}. Department: ${dept}.`,
      soulMd: tamirAgent.soulMd,
      deskDir,
      delivDir,
      manifestPath,
      maxBudgetUsd: 1,
      tools: { type: 'preset', preset: 'claude_code' },
    });

    // After Tamir completes removal, delete the skill record from DB
    await prisma.skill.delete({ where: { id: skillId } });

    return NextResponse.json({ success: true, message: `Skill ${skill.name} removed` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
