import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { orchestrator } from '@/lib/orchestrator';
import { generateId } from '@/lib/id';
import { DATA_ROOT } from '@/lib/paths';
import { z } from 'zod';

export const maxDuration = 120;

const bodySchema = z.object({
  goalTitle: z.string().min(1),
  goalDefinitionOfDone: z.string().min(1),
  directionTitle: z.string().min(1),
  directionRationale: z.string(),
});

/**
 * POST /api/strategy/canvas-chats/[chatId]/generate-seeds
 * Tamir mini-invocation to generate 2-3 actionable task seeds for a specific goal.
 *
 * Body: { goalTitle, goalDefinitionOfDone, directionTitle, directionRationale }
 * Returns: { seeds: [{ title, description, suggestedDepartment, roughScope }] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } },
) {
  try {
    // Validate body
    const rawBody = await request.json();
    const parseResult = bodySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parseResult.error.issues },
        { status: 400 },
      );
    }
    const { goalTitle, goalDefinitionOfDone, directionTitle, directionRationale } = parseResult.data;

    // 1. Load canvas-chat from DB
    const chat = await prisma.canvasChat.findUnique({
      where: { id: params.chatId },
    });
    if (!chat) {
      return NextResponse.json({ error: 'Canvas chat not found' }, { status: 404 });
    }

    // 2. Read chat history (last 10 messages for brief context)
    let chatHistory = '';
    const chatFilePath = chat.chatFilePath;
    if (chatFilePath) {
      try {
        if (existsSync(chatFilePath)) {
          const raw = readFileSync(chatFilePath, 'utf-8').trim();
          if (raw) {
            const lines = raw.split('\n').filter(Boolean).slice(-10);
            chatHistory = lines
              .map((line) => {
                try {
                  const entry = JSON.parse(line) as { role: string; content?: string };
                  const speaker = entry.role === 'ceo' ? 'CEO' : 'Tamir';
                  return `${speaker}: ${(entry.content || '').substring(0, 300)}`;
                } catch {
                  return '';
                }
              })
              .filter(Boolean)
              .join('\n');
          }
        }
      } catch {
        // No history
      }
    }

    // 3. Build prompt for seed generation
    const promptParts = [
      'Generate 2-3 actionable task seeds for the following strategic goal.',
      'Each seed should be a concrete task that an AI agent department could execute.',
      '',
      '## Direction',
      `Title: ${directionTitle}`,
      `Rationale: ${directionRationale}`,
      '',
      '## Goal',
      `Title: ${goalTitle}`,
      `Definition of Done: ${goalDefinitionOfDone}`,
      '',
    ];
    if (chatHistory) {
      promptParts.push('## Recent Conversation Context', chatHistory, '');
    }
    promptParts.push(
      '## Instructions',
      'Generate 2-3 task seeds. For each seed:',
      '- Title: a clear, actionable task name',
      '- Description: 1-2 sentences explaining what needs to be done',
      '- Suggested Department: one of "tech", "marketing", or "operations"',
      '- Rough Scope: one of "small" (hours), "medium" (1-2 days), or "large" (3+ days)',
    );

    const agentPrompt = promptParts.join('\n');

    // 4. Set up desk directory
    const deskDir = join(DATA_ROOT, 'strategy', 'canvas-chats', params.chatId, 'seed-desk');
    mkdirSync(deskDir, { recursive: true });

    const settingsPath = join(deskDir, '.claude', 'settings.json');
    if (!existsSync(settingsPath)) {
      mkdirSync(dirname(settingsPath), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({
        permissions: {
          allow: ['Bash(*)', 'Read(*)', 'Write(*)', 'Edit(*)', 'mcp__cortex__*'],
          deny: [],
        },
      }, null, 2), 'utf-8');
    }

    const tmpDelivDir = join(DATA_ROOT, 'tmp', `canvas-seeds-${params.chatId}`);
    mkdirSync(tmpDelivDir, { recursive: true });
    const tmpManifestPath = join(tmpDelivDir, 'manifest.json');
    if (!existsSync(tmpManifestPath)) {
      writeFileSync(tmpManifestPath, '{}', 'utf-8');
    }

    // 5. Invoke Tamir with structured output
    const runId = generateId('run');
    const syntheticTaskId = `canvas-seeds-${params.chatId}`;

    const result = await orchestrator.invoke({
      taskId: syntheticTaskId,
      runId,
      agentId: 'tamir',
      prompt: agentPrompt,
      deskDir,
      delivDir: tmpDelivDir,
      manifestPath: tmpManifestPath,
      maxBudgetUsd: 0.3,
      outputFormat: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            seeds: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  suggestedDepartment: { type: 'string', enum: ['tech', 'marketing', 'operations'] },
                  roughScope: { type: 'string', enum: ['small', 'medium', 'large'] },
                },
                required: ['title', 'description', 'suggestedDepartment', 'roughScope'],
              },
            },
          },
          required: ['seeds'],
        },
      },
    });

    // 6. Extract structured output
    if (result.structuredOutput) {
      const output = result.structuredOutput as {
        seeds?: Array<{
          title: string;
          description: string;
          suggestedDepartment: string;
          roughScope: string;
        }>;
      };
      return NextResponse.json({ seeds: output.seeds || [] });
    }

    // Fallback: try parsing result text
    if (result.result) {
      try {
        const parsed = JSON.parse(result.result);
        return NextResponse.json({ seeds: parsed.seeds || [] });
      } catch {
        // Not JSON
      }
    }

    return NextResponse.json({ seeds: [] });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Seed generation failed: ${errMsg}` },
      { status: 500 },
    );
  }
}
