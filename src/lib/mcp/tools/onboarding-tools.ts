/**
 * Onboarding MCP tools — generate_company_dna, generate_soul, ingest_document.
 *
 * Per D-21: These tools are only available during onboarding and are denied
 * post-onboarding via access control in access-control.ts.
 *
 * Only the CoS agent can invoke these tools.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { copyFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, basename, dirname, extname, join } from 'path';
import { generateCompanyDna, type DnaInput } from '@/lib/onboarding/dna-generator';
import { generateSoul, type DeptHeadSoulConfig } from '@/lib/onboarding/soul-generator';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { logger } from '@/lib/logger';
import { dataPath } from '@/lib/paths';
import type { ToolContext } from '../tool-context';

// ---------------------------------------------------------------------------
// Destination directories
// ---------------------------------------------------------------------------

const DEST_ROOTS: Record<string, (...segments: string[]) => string> = {
  vault: (...s) => dataPath('vault', ...s),
  knowledge: (...s) => dataPath('knowledge', ...s),
  sharedlib: (...s) => dataPath('sharedlib', ...s),
  asset: (...s) => dataPath('assets', ...s),
};

// Text-based extensions eligible for FTS5 indexing
const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.csv', '.json', '.yaml', '.yml',
  '.ts', '.js', '.py', '.html', '.css', '.xml',
  '.rst', '.log', '.ini', '.toml', '.env',
]);

// ---------------------------------------------------------------------------
// registerOnboardingTools
// ---------------------------------------------------------------------------

export function registerOnboardingTools(ctx: ToolContext) {
  const log = logger.child({ module: 'onboarding-tools', agentId: ctx.agentId });

  // -------------------------------------------------------------------------
  // 1. generate_company_dna
  // -------------------------------------------------------------------------

  const generateCompanyDnaTool = tool(
    'generate_company_dna',
    'Generate or update company DNA from structured conversational input. Creates data/vault/company-dna.md.',
    {
      companyName: z.string().describe('Company name'),
      identity: z.string().describe('What the company is and does'),
      targetCustomer: z.string().describe('Who the company serves'),
      stage: z.enum(['idea', 'pre-revenue', 'revenue', 'scaling']).describe('Company stage'),
      domain: z.string().describe('Industry or domain'),
      competitiveLandscape: z.string().optional().describe('Competitive landscape'),
      technicalArchitecture: z.string().optional().describe('Technical architecture overview'),
      businessModel: z.string().optional().describe('Business model description'),
      budgetPhilosophy: z.string().optional().describe('Budget philosophy'),
      workingStyle: z.string().optional().describe('Working style preferences'),
      regulatory: z.string().optional().describe('Regulatory considerations'),
      founderBackground: z.string().optional().describe('Founder background'),
      departments: z.string().optional().describe('Department structure overview'),
    },
    async (args) => {
      try {
        const input: DnaInput = {
          companyName: args.companyName,
          identity: args.identity,
          targetCustomer: args.targetCustomer,
          stage: args.stage,
          domain: args.domain,
          competitiveLandscape: args.competitiveLandscape,
          technicalArchitecture: args.technicalArchitecture,
          businessModel: args.businessModel,
          budgetPhilosophy: args.budgetPhilosophy,
          workingStyle: args.workingStyle,
          regulatory: args.regulatory,
          founderBackground: args.founderBackground,
          departments: args.departments,
        };

        generateCompanyDna(input);
        const outPath = dataPath('vault', 'company-dna.md');

        log.info({ companyName: args.companyName }, 'Generated company DNA');

        return {
          content: [{
            type: 'text' as const,
            text: `Company DNA generated successfully at ${outPath}`,
          }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ err: msg }, 'Failed to generate company DNA');
        return {
          content: [{
            type: 'text' as const,
            text: `Error generating company DNA: ${msg}`,
          }],
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // 2. generate_soul
  // -------------------------------------------------------------------------

  const generateSoulTool = tool(
    'generate_soul',
    'Generate a department head soul file (personality/domain layer). Writes to data/agents/{agentId}/soul-generated.md.',
    {
      agentId: z.string().describe('Agent identifier (derived from head name)'),
      departmentName: z.string().describe('Department name'),
      headName: z.string().describe('Department head name'),
      headPersonality: z.string().describe('Personality description for the department head'),
      companyName: z.string().describe('Company name'),
      founderName: z.string().describe('Founder name'),
      domainContext: z.string().describe('Domain expertise and context for this department'),
    },
    async (args) => {
      try {
        const config: DeptHeadSoulConfig = {
          departmentName: args.departmentName,
          headName: args.headName,
          headPersonality: args.headPersonality,
          companyName: args.companyName,
          founderName: args.founderName,
          domainContext: args.domainContext,
        };

        generateSoul(args.agentId, config);
        const outPath = dataPath('agents', args.agentId, 'soul-generated.md');

        log.info({ agentId: args.agentId, departmentName: args.departmentName }, 'Generated soul file');

        return {
          content: [{
            type: 'text' as const,
            text: `Soul file generated for ${args.headName} (${args.departmentName}) at ${outPath}`,
          }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ err: msg, agentId: args.agentId }, 'Failed to generate soul');
        return {
          content: [{
            type: 'text' as const,
            text: `Error generating soul: ${msg}`,
          }],
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // 3. ingest_document
  // -------------------------------------------------------------------------

  const ingestDocumentTool = tool(
    'ingest_document',
    'Classify and file an uploaded document with provenance tracking. Copies file to destination and writes .meta.json sidecar.',
    {
      filePath: z.string().describe('Absolute path to the uploaded file'),
      destination: z.enum(['vault', 'knowledge', 'sharedlib', 'asset']).describe('Where to file the document'),
      department: z.string().optional().describe('Department to file under (for knowledge/sharedlib)'),
      description: z.string().describe('Description of the document'),
      category: z.string().describe('Category classification for the document'),
    },
    async (args) => {
      try {
        // Validate source file exists
        if (!existsSync(args.filePath)) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: Source file not found: ${args.filePath}`,
            }],
          };
        }

        // Build destination path
        const destRootFn = DEST_ROOTS[args.destination];
        if (!destRootFn) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: Unknown destination: ${args.destination}`,
            }],
          };
        }

        const segments: string[] = [];
        if (args.department) segments.push(args.department);
        segments.push(args.category);

        const destDir = destRootFn(...segments);
        mkdirSync(destDir, { recursive: true });

        const fileName = basename(args.filePath);
        const destPath = join(destDir, fileName);

        // Copy file to destination
        copyFileSync(args.filePath, destPath);

        // Write .meta.json sidecar with provenance
        const metaPath = destPath + '.meta.json';
        const meta = {
          source: 'onboarding',
          uploadedAt: new Date().toISOString(),
          category: args.category,
          description: args.description,
          department: args.department || null,
          destination: args.destination,
          originalPath: args.filePath,
        };
        writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

        // Index in FTS5 documents table if text-based
        const ext = extname(fileName).toLowerCase();
        if (TEXT_EXTENSIONS.has(ext)) {
          try {
            const content = readFileSync(destPath, 'utf-8');
            await prisma.document.create({
              data: {
                id: generateId('doc'),
                title: fileName,
                content,
                source: args.destination,
                department: args.department || ctx.department,
                filedBy: ctx.agentId,
                filePath: destPath,
              },
            });
          } catch (indexErr) {
            log.warn({ err: indexErr, filePath: destPath }, 'Failed to index document in FTS5, file still copied');
          }
        }

        log.info({
          fileName,
          destination: args.destination,
          category: args.category,
          department: args.department,
        }, 'Ingested document during onboarding');

        return {
          content: [{
            type: 'text' as const,
            text: `Document ingested: ${fileName} -> ${args.destination}/${args.category}/${fileName}`,
          }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ err: msg }, 'Failed to ingest document');
        return {
          content: [{
            type: 'text' as const,
            text: `Error ingesting document: ${msg}`,
          }],
        };
      }
    },
  );

  return [generateCompanyDnaTool, generateSoulTool, ingestDocumentTool];
}
