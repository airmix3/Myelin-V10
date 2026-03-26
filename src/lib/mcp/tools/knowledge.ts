/**
 * MCP tools: read_knowledge, write_knowledge, search_knowledge — Per TOOL-05, TOOL-06.
 * Department knowledge library access with FTS5 search and proper-lockfile for writes.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import * as lockfile from 'proper-lockfile';
import { searchDocuments } from '@/lib/fts';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import type { ToolContext } from '../tool-context';

function knowledgeDir(ctx: ToolContext): string {
  return resolve(process.cwd(), 'data', 'departments', ctx.department, 'knowledge');
}

export function createKnowledgeTools(ctx: ToolContext) {
  const readKnowledge = tool(
    'read_knowledge',
    'Read a file from your department knowledge library.',
    { filename: z.string().describe('Name of the knowledge file (e.g., "api-patterns.md")') },
    async (args) => {
      const dir = knowledgeDir(ctx);
      const fullPath = resolve(dir, args.filename);

      // Path traversal check
      if (!fullPath.startsWith(dir)) {
        return {
          content: [{ type: 'text' as const, text: 'Path traversal denied: filename must not escape knowledge directory.' }],
          isError: true,
        };
      }

      try {
        const content = readFileSync(fullPath, 'utf-8');
        return { content: [{ type: 'text' as const, text: content }] };
      } catch {
        return {
          content: [{ type: 'text' as const, text: `Knowledge file not found: ${args.filename}` }],
          isError: true,
        };
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const writeKnowledge = tool(
    'write_knowledge',
    'Write or update a file in your department knowledge library. Protected by file locking for concurrent access.',
    {
      filename: z.string().describe('Name of the knowledge file (e.g., "api-patterns.md")'),
      content: z.string().describe('Full content to write to the knowledge file'),
    },
    async (args) => {
      const dir = knowledgeDir(ctx);
      const fullPath = resolve(dir, args.filename);

      // Path traversal check
      if (!fullPath.startsWith(dir)) {
        return {
          content: [{ type: 'text' as const, text: 'Path traversal denied: filename must not escape knowledge directory.' }],
          isError: true,
        };
      }

      // Ensure directory exists
      mkdirSync(dir, { recursive: true });

      // Write with file locking
      let release: (() => Promise<void>) | undefined;
      try {
        release = await lockfile.lock(dir, { retries: 3 });
        writeFileSync(fullPath, args.content, 'utf-8');
      } finally {
        if (release) await release();
      }

      // Upsert to documents table for FTS5 indexing
      const existing = await prisma.document.findFirst({ where: { filePath: fullPath } });
      if (existing) {
        await prisma.document.update({
          where: { id: existing.id },
          data: { content: args.content, updatedAt: new Date() },
        });
      } else {
        await prisma.document.create({
          data: {
            id: generateId('doc'),
            title: basename(args.filename),
            content: args.content,
            source: 'knowledge',
            department: ctx.department,
            filedBy: ctx.agentId,
            filePath: fullPath,
          },
        });
      }

      return { content: [{ type: 'text' as const, text: 'Knowledge file written and indexed.' }] };
    },
  );

  const searchKnowledge = tool(
    'search_knowledge',
    'Search across all indexed documents (knowledge, vault, deliverables) using full-text search with BM25 ranking.',
    {
      query: z.string().describe('Search query (FTS5 syntax supported)'),
      limit: z.number().optional().describe('Max results, default 20'),
    },
    async (args) => {
      const results = searchDocuments(args.query, args.limit ?? 20);

      if (results.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No documents matched your search query.' }] };
      }

      const formatted = results.map(r =>
        `[${r.source}] ${r.title} (${r.department ?? 'global'})\n${r.snippet}`
      ).join('\n\n---\n\n');

      return { content: [{ type: 'text' as const, text: formatted }] };
    },
    { annotations: { readOnlyHint: true } },
  );

  return [readKnowledge, writeKnowledge, searchKnowledge];
}
