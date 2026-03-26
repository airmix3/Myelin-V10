/**
 * MCP tools: read_memory, write_memory — Per TOOL-03.
 * Reads/writes data/agents/{agentId}/MEMORY.md for agent-owned persistent memory.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import type { ToolContext } from '../tool-context';

function memoryPath(ctx: ToolContext): string {
  return resolve(process.cwd(), 'data', 'agents', ctx.agentId, 'MEMORY.md');
}

export function createMemoryTools(ctx: ToolContext) {
  const readMemory = tool(
    'read_memory',
    'Read your MEMORY.md file to recall context from past tasks — your persistent notes, conventions learned, and project history.',
    {},
    async () => {
      const memPath = memoryPath(ctx);
      try {
        const content = readFileSync(memPath, 'utf-8');
        return { content: [{ type: 'text' as const, text: content }] };
      } catch {
        return {
          content: [{
            type: 'text' as const,
            text: 'No memory file found. This is your first task -- you\'ll build memories over time.',
          }],
        };
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const writeMemory = tool(
    'write_memory',
    'Update your MEMORY.md with new learnings, project notes, or conventions discovered during this task.',
    { content: z.string().describe('Full updated MEMORY.md content in markdown format') },
    async (args) => {
      const memPath = memoryPath(ctx);
      const dir = resolve(process.cwd(), 'data', 'agents', ctx.agentId);
      mkdirSync(dir, { recursive: true });
      writeFileSync(memPath, args.content, 'utf-8');
      return { content: [{ type: 'text' as const, text: 'Memory updated successfully.' }] };
    },
  );

  return [readMemory, writeMemory];
}
