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
 * Seed the Myelin internal MCP server entry.
 * 8 tool modules with ~14 total tools.
 */
async function seedMcpServers(): Promise<void> {
  const existing = await prisma.mcpServer.findUnique({ where: { name: 'myelin' } });
  if (!existing) {
    await prisma.mcpServer.create({
      data: {
        id: generateId('mcp'),
        name: 'myelin',
        description: 'Myelin internal tools (memory, knowledge, vault, deliverable, review, skills, inbox, hire)',
        status: 'active',
        toolCount: 14,
      },
    });
    log.info('Seeded MCP server: myelin');
  } else {
    log.debug('MCP server "myelin" already exists');
  }
}

/**
 * Seed skills from on-disk skills/ directory.
 * Reads each subdirectory's SKILL.md, parses YAML frontmatter for name+description.
 */
async function seedSkills(): Promise<void> {
  const skillsDir = path.resolve(process.cwd(), 'skills');
  if (!fs.existsSync(skillsDir)) {
    log.debug('No skills/ directory found, skipping skill seeding');
    return;
  }

  const matter = (await import('gray-matter')).default;
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
    const name = parsed.data.name || entry.name;
    const description = parsed.data.description || '';

    // Upsert by name + department combination
    const existing = await prisma.skill.findFirst({
      where: { name, department: 'cos' },
    });

    if (!existing) {
      await prisma.skill.create({
        data: {
          id: generateId('skill'),
          name,
          department: 'cos',
          description,
          status: 'active',
          filePath: skillMdPath,
          proposedBy: 'system',
        },
      });
      log.info({ name }, 'Seeded skill');
    } else {
      // Update description/filePath if changed
      await prisma.skill.update({
        where: { id: existing.id },
        data: { description, filePath: skillMdPath },
      });
      log.debug({ name }, 'Skill already exists, updated metadata');
    }
  }
}
