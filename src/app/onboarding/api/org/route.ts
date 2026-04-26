/**
 * Department CRUD API for the onboarding org builder (Phase 7).
 *
 * POST — create a new department (directory structure, soul file, DB record)
 * PUT  — update an existing department
 * DELETE — remove a department (cleanup directories, DB record, state)
 *
 * Per D-14: Full dynamic organs, any number of departments.
 * Per D-17: Founder names department heads, agent ID derived from name.
 */

import { NextRequest, NextResponse } from 'next/server';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { readOnboardingState, writeOnboardingState } from '@/lib/onboarding/state';
import type { OnboardingDepartment } from '@/lib/onboarding/state';
import { generateSoul } from '@/lib/onboarding/soul-generator';
import { seedDynamicAgent } from '@/lib/seed-agents';
import { invalidateDepartmentCache } from '@/lib/departments';
import { dataPath } from '@/lib/paths';
import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Slugify a string: lowercase, replace spaces/special chars with hyphens, max 20 chars */
function slugify(input: string, maxLen = 20): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

/** Generate a simple hash-based color for avatar/badge */
function generateColor(slug: string): string {
  let hash = 0;
  for (const ch of slug) {
    hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/** Ensure agentId is unique among existing departments; append numeric suffix if collision */
function uniqueAgentId(base: string, existing: OnboardingDepartment[]): string {
  const ids = new Set(existing.map((d) => d.agentId));
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

// ---------------------------------------------------------------------------
// POST — Create department
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, headName, personality } = body as {
      name: string;
      headName: string;
      personality: string;
    };

    if (!name?.trim() || !headName?.trim()) {
      return NextResponse.json({ error: 'name and headName are required' }, { status: 400 });
    }

    const state = readOnboardingState();
    if (!state) {
      return NextResponse.json({ error: 'Onboarding state not initialized' }, { status: 400 });
    }

    const departments = state.departments ?? [];

    // Generate slugs and agent ID (D-17: derived from headName)
    const deptSlug = slugify(name);
    const rawAgentId = slugify(headName);
    const agentId = uniqueAgentId(rawAgentId, departments);

    // 1. Create directory structure
    const deptDirs = [
      dataPath('departments', deptSlug, 'knowledge'),
      dataPath('departments', deptSlug, 'skills'),
      dataPath('departments', deptSlug, 'sharedlib'),
      dataPath('departments', deptSlug, 'planning-desk', '.claude', 'skills'),
      dataPath('departments', deptSlug, 'planning-desk', 'chat'),
    ];
    for (const dir of deptDirs) {
      mkdirSync(dir, { recursive: true });
    }
    mkdirSync(dataPath('agents', agentId), { recursive: true });

    // 2. Generate soul file
    generateSoul(agentId, {
      departmentName: name.trim(),
      headName: headName.trim(),
      headPersonality: (personality || '').trim(),
      companyName: state.companyName || 'Company',
      founderName: state.founderName || 'Founder',
      domainContext: '',
    });

    // 3. Generate card.json
    const cardPath = dataPath('agents', agentId, 'card.json');
    const card = {
      agentId,
      name: headName.trim(),
      department: deptSlug,
      tools: ['read_memory', 'write_memory', 'read_knowledge', 'write_knowledge', 'search_knowledge', 'promote_to_deliverable'],
      avatarColor: generateColor(deptSlug),
    };
    writeFileSync(cardPath, JSON.stringify(card, null, 2), 'utf-8');

    // 4. Seed employee record in DB
    await seedDynamicAgent({
      agentId,
      name: headName.trim(),
      department: deptSlug,
      budgetLimit: 25.0,
    });

    // 5. Update onboarding state
    const newDept: OnboardingDepartment = {
      id: deptSlug,
      name: name.trim(),
      headName: headName.trim(),
      headPersonality: (personality || '').trim(),
      agentId,
      color: generateColor(deptSlug),
    };
    state.departments = [...departments, newDept];
    await writeOnboardingState(state);

    // 6. Invalidate department cache
    invalidateDepartmentCache();

    return NextResponse.json({ success: true, department: newDept });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT — Update department
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { departmentId, name, headName, personality } = body as {
      departmentId: string;
      name?: string;
      headName?: string;
      personality?: string;
    };

    if (!departmentId) {
      return NextResponse.json({ error: 'departmentId is required' }, { status: 400 });
    }

    const state = readOnboardingState();
    if (!state || !state.departments) {
      return NextResponse.json({ error: 'No departments found' }, { status: 400 });
    }

    const idx = state.departments.findIndex((d) => d.id === departmentId);
    if (idx === -1) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const dept = state.departments[idx];

    if (name !== undefined) dept.name = name.trim();
    if (headName !== undefined) dept.headName = headName.trim();
    if (personality !== undefined) dept.headPersonality = personality.trim();

    // Regenerate soul if personality changed
    if (personality !== undefined) {
      generateSoul(dept.agentId, {
        departmentName: dept.name,
        headName: dept.headName,
        headPersonality: dept.headPersonality || '',
        companyName: state.companyName || 'Company',
        founderName: state.founderName || 'Founder',
        domainContext: '',
      });
    }

    state.departments[idx] = dept;
    await writeOnboardingState(state);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — Remove department
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { departmentId } = body as { departmentId: string };

    if (!departmentId) {
      return NextResponse.json({ error: 'departmentId is required' }, { status: 400 });
    }

    const state = readOnboardingState();
    if (!state || !state.departments) {
      return NextResponse.json({ error: 'No departments found' }, { status: 400 });
    }

    const dept = state.departments.find((d) => d.id === departmentId);
    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // 1. Remove department directory
    const deptDir = dataPath('departments', departmentId);
    if (existsSync(deptDir)) {
      rmSync(deptDir, { recursive: true, force: true });
    }

    // 2. Remove agent directory
    const agentDir = dataPath('agents', dept.agentId);
    if (existsSync(agentDir)) {
      rmSync(agentDir, { recursive: true, force: true });
    }

    // 3. Delete employee record from DB
    try {
      await prisma.employee.deleteMany({ where: { agentId: dept.agentId } });
    } catch {
      // Non-critical: employee may not exist yet
    }

    // 4. Remove from state
    state.departments = state.departments.filter((d) => d.id !== departmentId);
    await writeOnboardingState(state);

    // 5. Invalidate department cache
    invalidateDepartmentCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
