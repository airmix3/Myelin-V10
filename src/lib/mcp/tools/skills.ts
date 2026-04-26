/**
 * MCP tool: propose_skill — Per TOOL-11.
 * Creates a skill directory with SKILL.md and upserts a DB record with pending status.
 * Notifies Tamir inbox for approval flow.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import * as lockfile from 'proper-lockfile';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import type { ToolContext } from '../tool-context';

const INBOX_PATH = resolve(process.cwd(), 'data', 'agents', 'tamir', 'inbox.jsonl');

export function createSkillTools(ctx: ToolContext) {
  const proposeSkill = tool(
    'propose_skill',
    'Propose a new reusable skill for your department. Creates SKILL.md and awaits approval.',
    {
      name: z.string().describe('Skill name in kebab-case (e.g., "eeg-preprocessing")'),
      description: z.string().describe('One-sentence skill description'),
      skill_content: z.string().describe('Full SKILL.md content with frontmatter'),
    },
    async (args) => {
      // Create skill directory
      const skillDir = resolve(process.cwd(), 'data', 'departments', ctx.department, 'skills', args.name);
      mkdirSync(skillDir, { recursive: true });

      // Write SKILL.md
      const skillPath = resolve(skillDir, 'SKILL.md');
      writeFileSync(skillPath, args.skill_content, 'utf-8');

      // Upsert DB record: check by name+department first
      const existing = await prisma.skill.findFirst({
        where: { name: args.name, department: ctx.department },
      });

      if (existing) {
        await prisma.skill.update({
          where: { id: existing.id },
          data: {
            description: args.description,
            filePath: skillPath,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.skill.create({
          data: {
            id: generateId('skill'),
            name: args.name,
            department: ctx.department,
            description: args.description,
            status: 'pending',
            filePath: skillPath,
            proposedBy: ctx.agentId,
          },
        });
      }

      // Notify Tamir inbox
      const inboxDir = dirname(INBOX_PATH);
      mkdirSync(inboxDir, { recursive: true });
      if (!existsSync(INBOX_PATH)) {
        appendFileSync(INBOX_PATH, '');
      }

      let release: (() => Promise<void>) | undefined;
      try {
        release = await lockfile.lock(INBOX_PATH, { retries: 3, realpath: false });
        appendFileSync(INBOX_PATH, JSON.stringify({
          type: 'skill_proposed',
          name: args.name,
          department: ctx.department,
          proposedBy: ctx.agentId,
          timestamp: new Date().toISOString(),
        }) + '\n', 'utf-8');
      } finally {
        if (release) await release();
      }

      return {
        content: [{
          type: 'text' as const,
          text: `Skill '${args.name}' proposed. Awaiting dept head -> CEO approval.`,
        }],
      };
    },
  );

  return [proposeSkill];
}
