import { NextRequest, NextResponse } from 'next/server';
import { invokeAgent } from '@/lib/invoke-agent';
import { generateId } from '@/lib/id';
import { resolve } from 'path';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { DATA_ROOT as DATA_DIR } from '@/lib/paths';

const VALID_DEPTS = ['tech', 'marketing', 'operations'];

export async function POST(
  request: NextRequest,
  { params }: { params: { dept: string } }
) {
  const { dept } = params;

  if (!VALID_DEPTS.includes(dept)) {
    return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
  }

  let body: { description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const description = body.description?.trim();
  if (!description) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 });
  }

  try {
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
    const taskId = `sys-skill-create-${Date.now()}`;

    await invokeAgent({
      taskId,
      runId,
      agentId: 'tamir',
      department: 'cos',
      prompt: `Create a new skill for the ${dept} department based on this description from the CEO: ${description}. Use the skill-creator plugin to generate a proper SKILL.md with appropriate name, triggers, procedure, and edge cases. Then call propose_skill to save it to the ${dept} department. The skill name should be in kebab-case.`,
      soulMd: tamirAgent.soulMd,
      deskDir,
      delivDir,
      manifestPath,
      maxBudgetUsd: 2,
      tools: { type: 'preset', preset: 'claude_code' },
    });

    return NextResponse.json({ success: true, message: `Skill creation started for ${dept}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
