import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { orchestrator } from '@/lib/orchestrator';
import { generateId } from '@/lib/id';
import { DATA_ROOT } from '@/lib/paths';

export const maxDuration = 120;

/**
 * POST /api/strategy/canvas-chats/[chatId]/analyze
 * Tamir mini-invocation with structured output to analyze a canvas conversation
 * and suggest a direction (title, rationale, context summary, 2-4 goals).
 *
 * Returns: { title, rationale, contextSummary, goals: [{ title, definitionOfDone }] }
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { chatId: string } },
) {
  try {
    // 1. Load canvas-chat from DB
    const chat = await prisma.canvasChat.findUnique({
      where: { id: params.chatId },
    });
    if (!chat) {
      return NextResponse.json({ error: 'Canvas chat not found' }, { status: 404 });
    }

    const chatFilePath = chat.chatFilePath;
    if (!chatFilePath) {
      return NextResponse.json({ error: 'No chat file path configured' }, { status: 500 });
    }

    // 2. Read chat history from JSONL file (last 20 messages)
    let chatHistory = '';
    try {
      if (existsSync(chatFilePath)) {
        const raw = readFileSync(chatFilePath, 'utf-8').trim();
        if (raw) {
          const lines = raw.split('\n').filter(Boolean).slice(-20);
          chatHistory = lines
            .map((line) => {
              try {
                const entry = JSON.parse(line) as { role: string; content?: string };
                const speaker = entry.role === 'ceo' ? 'CEO' : 'Tamir';
                return `${speaker}: ${(entry.content || '').substring(0, 500)}`;
              } catch {
                return '';
              }
            })
            .filter(Boolean)
            .join('\n');
        }
      }
    } catch {
      // No history yet
    }

    // 3. Read canvas file if it exists, extract text elements for context
    let canvasSummary = '';
    const canvasFilePath = chat.canvasFilePath;
    if (canvasFilePath && existsSync(canvasFilePath)) {
      try {
        const canvasContent = readFileSync(canvasFilePath, 'utf-8');
        const parsed = JSON.parse(canvasContent);
        if (parsed.elements && Array.isArray(parsed.elements)) {
          const textElements: string[] = [];
          const shapeTypes: string[] = [];
          for (const el of parsed.elements) {
            if (el.type === 'text' && el.text) {
              textElements.push(el.text);
            } else if (el.type && el.type !== 'text') {
              shapeTypes.push(el.type);
            }
          }
          const parts: string[] = [];
          if (textElements.length > 0) {
            parts.push('Text on canvas:\n' + textElements.join('\n'));
          }
          if (shapeTypes.length > 0) {
            const counts: Record<string, number> = {};
            for (const t of shapeTypes) {
              counts[t] = (counts[t] || 0) + 1;
            }
            const shapeSummary = Object.entries(counts)
              .map(([type, count]) => `${count} ${type}(s)`)
              .join(', ');
            parts.push('Shapes: ' + shapeSummary);
          }
          if (parts.length > 0) {
            canvasSummary = parts.join('\n\n');
          }
        }
      } catch {
        // Canvas file unreadable -- continue without
      }
    }

    // 4. Build prompt for structured analysis
    const promptParts = [
      'Analyze this strategic canvas conversation and suggest a direction to commit.',
      'Return a structured analysis with a suggested title, rationale, context summary, and 2-4 candidate goals.',
      '',
    ];
    if (canvasSummary) {
      promptParts.push('## Canvas Content', canvasSummary, '');
    }
    if (chatHistory) {
      promptParts.push('## Conversation History', chatHistory, '');
    }
    promptParts.push(
      '## Instructions',
      'Based on the canvas content and conversation above:',
      '- Suggest a concise direction title (5-15 words) that captures the strategic theme',
      '- Write a rationale (2-3 sentences) explaining why this direction matters',
      '- Provide a brief context summary of what was discussed',
      '- Suggest 2-4 concrete goals for this direction, each with a clear definition of done',
    );

    const agentPrompt = promptParts.join('\n');

    // 5. Set up desk directory
    const deskDir = join(DATA_ROOT, 'strategy', 'canvas-chats', params.chatId, 'analysis-desk');
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

    const tmpDelivDir = join(DATA_ROOT, 'tmp', `canvas-analyze-${params.chatId}`);
    mkdirSync(tmpDelivDir, { recursive: true });
    const tmpManifestPath = join(tmpDelivDir, 'manifest.json');
    if (!existsSync(tmpManifestPath)) {
      writeFileSync(tmpManifestPath, '{}', 'utf-8');
    }

    // 6. Invoke Tamir with structured output
    const runId = generateId('run');
    const syntheticTaskId = `canvas-analyze-${params.chatId}`;

    const result = await orchestrator.invoke({
      taskId: syntheticTaskId,
      runId,
      agentId: 'tamir',
      prompt: agentPrompt,
      deskDir,
      delivDir: tmpDelivDir,
      manifestPath: tmpManifestPath,
      maxBudgetUsd: 0.5,
      outputFormat: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Suggested direction title (concise, 5-15 words)' },
            rationale: { type: 'string', description: 'Why this direction matters (2-3 sentences)' },
            contextSummary: { type: 'string', description: 'Brief summary of what was discussed on the canvas' },
            goals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Goal title' },
                  definitionOfDone: { type: 'string', description: 'How to know this goal is achieved' },
                },
                required: ['title', 'definitionOfDone'],
              },
              description: '2-4 suggested goals for this direction',
            },
          },
          required: ['title', 'rationale', 'contextSummary', 'goals'],
        },
      },
    });

    // 7. Extract structured output
    if (result.structuredOutput) {
      const output = result.structuredOutput as {
        title?: string;
        rationale?: string;
        contextSummary?: string;
        goals?: Array<{ title: string; definitionOfDone: string }>;
      };
      return NextResponse.json({
        title: output.title || 'Untitled Direction',
        rationale: output.rationale || '',
        contextSummary: output.contextSummary || '',
        goals: output.goals || [],
      });
    }

    // Fallback: try parsing result text as JSON
    if (result.result) {
      try {
        const parsed = JSON.parse(result.result);
        return NextResponse.json({
          title: parsed.title || 'Untitled Direction',
          rationale: parsed.rationale || '',
          contextSummary: parsed.contextSummary || '',
          goals: parsed.goals || [],
        });
      } catch {
        // Not JSON -- return a fallback
      }
    }

    return NextResponse.json({
      title: 'New Direction',
      rationale: 'Analysis could not extract structured data. Please edit manually.',
      contextSummary: chatHistory ? 'Based on canvas conversation.' : 'No conversation history available.',
      goals: [],
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Canvas analysis failed: ${errMsg}` },
      { status: 500 },
    );
  }
}
