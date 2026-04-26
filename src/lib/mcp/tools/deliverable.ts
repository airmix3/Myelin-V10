/**
 * MCP tool: promote_to_deliverable — Per TOOL-04.
 * Copies files from agent desk to deliverables directory with path traversal prevention,
 * manifest update, and FTS5 indexing.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { copyFileSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, basename, join } from 'path';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import type { ToolContext } from '../tool-context';

interface ManifestFile {
  path: string;
  description: string;
  promotedAt: string;
}

interface Manifest {
  taskId: string;
  files: ManifestFile[];
  primaryFile: string | null;
  createdAt: string;
}

export function createDeliverableTools(ctx: ToolContext) {
  const promoteToDeliverable = tool(
    'promote_to_deliverable',
    'Copy a file from your desk to the deliverables directory, making it visible to supervisors and the CEO.',
    {
      source_path: z.string().describe('Relative path from your desk to the file'),
      description: z.string().describe('Brief description of this deliverable'),
    },
    async (args) => {
      // Resolve and validate source path
      const srcFull = resolve(ctx.deskDir, args.source_path);
      if (!srcFull.startsWith(ctx.deskDir)) {
        return {
          content: [{ type: 'text' as const, text: 'Path traversal denied: source must be within desk directory.' }],
          isError: true,
        };
      }

      if (!existsSync(srcFull)) {
        return {
          content: [{ type: 'text' as const, text: `File not found: ${args.source_path}` }],
          isError: true,
        };
      }

      // Copy to deliverables
      const destPath = join(ctx.delivDir, basename(args.source_path));
      copyFileSync(srcFull, destPath);

      // Read and update manifest
      let manifest: Manifest;
      try {
        manifest = JSON.parse(readFileSync(ctx.manifestPath, 'utf-8')) as Manifest;
      } catch {
        manifest = { taskId: ctx.taskId, files: [], primaryFile: null, createdAt: new Date().toISOString() };
      }

      const entry: ManifestFile = {
        path: basename(args.source_path),
        description: args.description,
        promotedAt: new Date().toISOString(),
      };
      manifest.files.push(entry);

      // Set primaryFile if this is the first file promoted
      if (manifest.primaryFile === null) {
        manifest.primaryFile = basename(args.source_path);
      }

      writeFileSync(ctx.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

      // Update deliverable DB record with latest primaryFile
      try {
        await prisma.deliverable.updateMany({
          where: { taskId: ctx.taskId },
          data: { primaryFile: manifest.primaryFile },
        });
      } catch {
        // Non-fatal — manifest is the source of truth, DB is for display
      }

      // Index to FTS5 via documents table
      await prisma.document.create({
        data: {
          id: generateId('doc'),
          title: basename(args.source_path),
          content: args.description,
          source: 'deliverable',
          department: ctx.department,
          filedBy: ctx.agentId,
          filePath: destPath,
        },
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Promoted "${basename(args.source_path)}" to deliverables. ${manifest.files.length === 1 ? 'Set as primary file.' : ''}`,
        }],
      };
    },
  );

  return [promoteToDeliverable];
}
