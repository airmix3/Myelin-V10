import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

const log = logger.child({ module: 'seed-gallery' });

/**
 * Idempotent seeding of mcp_servers and skills tables.
 * Called during server initialization (instrumentation.ts).
 */
export async function seedGallery(): Promise<void> {
  await seedMcpServers();
  await seedSkills();
}

/**
 * Seed the Cortex internal MCP server entry.
 * 8 tool modules with ~14 total tools.
 */
async function seedMcpServers(): Promise<void> {
  const existing = await prisma.mcpServer.findUnique({ where: { name: 'cortex' } });
  if (!existing) {
    await prisma.mcpServer.create({
      data: {
        id: generateId('mcp'),
        name: 'cortex',
        description: 'Cortex internal tools (memory, knowledge, vault, deliverable, review, skills, inbox, hire)',
        status: 'active',
        toolCount: 14,
      },
    });
    log.info('Seeded MCP server: cortex');
  } else {
    log.debug('MCP server "cortex" already exists');
  }
}

/**
 * Seed skills from multiple on-disk sources:
 * 1. data/departments/global/skills/ — global skills (department='global')
 * 2. data/departments/cos/skills/ — Tamir-specific skills (department='cos')
 * 3. data/departments/{tech,marketing,operations}/skills/ — department skills
 * 4. skills/ (project root) — externally installed skills (department='external')
 */
async function seedSkills(): Promise<void> {
  const matter = (await import('gray-matter')).default;
  const dataDir = path.resolve(process.cwd(), 'data');

  // Seed global skills
  await seedSkillsFromDir(
    matter,
    path.join(dataDir, 'departments', 'global', 'skills'),
    'global',
  );

  // Seed cos skills (Tamir-specific, e.g. installer)
  await seedSkillsFromDir(
    matter,
    path.join(dataDir, 'departments', 'cos', 'skills'),
    'cos',
  );

  // Seed department-specific skills
  for (const dept of ['tech', 'marketing', 'operations']) {
    await seedSkillsFromDir(
      matter,
      path.join(dataDir, 'departments', dept, 'skills'),
      dept,
    );
  }

  // Seed externally installed skills from project root skills/
  await seedSkillsFromDir(
    matter,
    path.resolve(process.cwd(), 'skills'),
    'external',
  );
}

async function seedSkillsFromDir(
  matter: (input: string) => { data: Record<string, unknown>; content: string },
  skillsDir: string,
  department: string,
): Promise<void> {
  if (!fs.existsSync(skillsDir)) {
    log.debug({ skillsDir, department }, 'Skills directory not found, skipping');
    return;
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      log.debug({ dir: entry.name }, 'No SKILL.md found, skipping');
      continue;
    }

    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const parsed = matter(content);
    const name = (parsed.data.name as string) || entry.name;
    const description = (parsed.data.description as string) || '';

    // Upsert by name + department combination
    const existing = await prisma.skill.findFirst({
      where: { name, department },
    });

    if (!existing) {
      await prisma.skill.create({
        data: {
          id: generateId('skill'),
          name,
          department,
          description,
          status: 'active',
          filePath: skillMdPath,
          proposedBy: 'system',
        },
      });
      log.info({ name, department }, 'Seeded skill');
    } else {
      // Update description/filePath if changed
      await prisma.skill.update({
        where: { id: existing.id },
        data: { description, filePath: skillMdPath },
      });
      log.debug({ name, department }, 'Skill already exists, updated metadata');
    }
  }
}
