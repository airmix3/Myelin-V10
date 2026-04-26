/**
 * MCP tool: file_to_vault — Per TOOL-10.
 * Copies a file to data/vault/ and indexes it to FTS5 via the documents table.
 * Supports two calling modes: within-task (deskDir validation) and direct call (absolute path).
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { copyFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, basename, join, isAbsolute } from 'path';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { logger } from '@/lib/logger';
import type { ToolContext } from '../tool-context';

const VAULT_DIR = resolve(process.cwd(), 'data', 'vault');

export function createVaultTools(ctx: ToolContext) {
  const fileToVault = tool(
    'file_to_vault',
    'Copy a file to the company vault and index it for full-text search.',
    {
      source_path: z.string().describe('Path to the file to vault (relative to desk or absolute)'),
      title: z.string().describe('Title for the vault document'),
    },
    async (args) => {
      const log = logger.child({ module: 'vault', taskId: ctx.taskId });

      let srcFull: string;
      if (ctx.deskDir) {
        // Mode 1: within-task -- resolve relative to desk, validate containment
        srcFull = resolve(ctx.deskDir, args.source_path);
        if (!srcFull.startsWith(ctx.deskDir) && !srcFull.startsWith(ctx.delivDir)) {
          return { content: [{ type: 'text' as const, text: 'Error: Path must be within your desk or deliverables directory' }] };
        }
      } else {
        // Mode 2: direct call (e.g., Tamir outside task context)
        if (!isAbsolute(args.source_path)) {
          return { content: [{ type: 'text' as const, text: 'Error: When called outside a task, source_path must be an absolute path' }] };
        }
        srcFull = args.source_path;
        log.warn('file_to_vault called without task context, accepting absolute path');
      }

      if (!existsSync(srcFull)) {
        return { content: [{ type: 'text' as const, text: `Error: File not found: ${srcFull}` }] };
      }

      // Ensure vault directory exists
      mkdirSync(VAULT_DIR, { recursive: true });

      // Copy to vault
      const destPath = join(VAULT_DIR, basename(args.source_path));
      copyFileSync(srcFull, destPath);

      // Read content for indexing
      const fileContent = readFileSync(srcFull, 'utf-8');

      // Upsert to documents table -- FTS5 indexing is automatic via INSERT trigger
      await prisma.document.create({
        data: {
          id: generateId('doc'),
          title: args.title,
          content: fileContent,
          source: 'vault',
          department: ctx.department,
          filedBy: ctx.agentId,
          filePath: destPath,
        },
      });

      // Recompile vault catalog
      try {
        const { compileVaultCatalog } = await import('@/lib/catalog');
        compileVaultCatalog();
      } catch (e) {
        log.warn({ err: e }, 'Vault catalog recompile failed (non-fatal)');
      }

      return { content: [{ type: 'text' as const, text: `Filed to vault: ${args.title}` }] };
    },
  );

  return [fileToVault];
}
