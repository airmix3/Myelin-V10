/**
 * MCP tools: memory (Tamir bounded), memory (dept heads bounded).
 *
 * Tamir gets a `memory` tool with add/replace/remove actions and
 * memory/user/company targets — bounded, curated, with security scanning.
 * Dept heads get a single-target `memory` tool with add/replace/remove —
 * bounded at 4,000 chars, same pattern but no target routing.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { ToolContext } from '../tool-context';
import { dataPath } from '@/lib/paths';
import {
  MemoryStore,
  TAMIR_MEMORY_PATH,
  TAMIR_USER_PATH,
  TAMIR_COMPANY_PATH,
  MEMORY_CHAR_LIMIT,
  USER_CHAR_LIMIT,
  COMPANY_CHAR_LIMIT,
  DEPT_HEAD_CHAR_LIMIT,
} from '@/lib/memory-store';

// ---------------------------------------------------------------------------
// Dept head bounded memory tool
// ---------------------------------------------------------------------------

const DEPT_HEAD_MEMORY_DESCRIPTION =
  `Save durable information to persistent memory that survives across sessions. ` +
  `Your memory is injected into every future prompt, so keep it compact and focused on facts ` +
  `that will still matter later.\n\n` +

  `WHEN TO SAVE (do this proactively, don't wait to be asked):\n` +
  `- CEO corrects you or says 'remember this' / 'don't do that again'\n` +
  `- You discover a convention, tool quirk, or pattern specific to your domain\n` +
  `- You learn something about active priorities, agent capabilities, or project structure\n` +
  `- You identify a stable fact that will reduce future steering\n\n` +

  `PRIORITY: CEO corrections and preferences > domain conventions > active priorities > ` +
  `lessons learned. The most valuable memory prevents repeating past mistakes.\n\n` +

  `Do NOT save task-specific details, session transcripts, completed-work logs, or ` +
  `temporary TODO state. Those belong in task records, not memory.\n\n` +

  `ACTIONS:\n` +
  `- add: new entry (content required)\n` +
  `- replace: update existing entry (content identifies it via substring match, ` +
  `new_content is the replacement)\n` +
  `- remove: delete entry (content identifies it via substring match)\n\n` +

  `Memory is bounded at 4,000 chars. When near the limit, replace or remove stale entries ` +
  `before adding new ones. Entries are separated by \u00A7 (section sign). ` +
  `Keep each entry focused on one fact or convention.`;

export function createDeptHeadMemoryTool(ctx: ToolContext) {
  const memoryTool = tool(
    'memory',
    DEPT_HEAD_MEMORY_DESCRIPTION,
    {
      action: z.enum(['add', 'replace', 'remove']).describe('The action to perform.'),
      content: z.string().describe('Content to add, or short unique substring identifying the entry to replace/remove.'),
      new_content: z.string().optional().describe('Replacement content (required for replace action).'),
    },
    async (args) => {
      const filePath = dataPath('agents', ctx.agentId, 'MEMORY.md');
      const store = new MemoryStore(filePath, DEPT_HEAD_CHAR_LIMIT);
      await store.loadFromDisk();

      let result;

      switch (args.action) {
        case 'add':
          result = await store.add(args.content);
          break;

        case 'replace':
          if (!args.new_content) {
            result = { success: false, error: 'new_content is required for replace action.' };
            break;
          }
          result = await store.replace(args.content, args.new_content);
          break;

        case 'remove':
          result = await store.remove(args.content);
          break;

        default:
          result = { success: false, error: `Unknown action '${args.action}'. Use: add, replace, remove` };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  return [memoryTool];
}

// ---------------------------------------------------------------------------
// Tamir bounded memory tool
// ---------------------------------------------------------------------------

const TAMIR_MEMORY_DESCRIPTION =
  `Save durable information to persistent memory that survives across sessions. ` +
  `Memory is injected into future turns, so keep it compact and focused on facts ` +
  `that will still matter later.\n\n` +

  `WHEN TO SAVE (do this proactively, don't wait to be asked):\n` +
  `- CEO corrects you or says 'remember this' / 'don't do that again'\n` +
  `- CEO shares a preference, habit, or personal detail (communication style, decision patterns)\n` +
  `- You discover a routing pattern, tool quirk, or convention specific to this company\n` +
  `- You learn something about the company structure, active priorities, or agent capabilities\n` +
  `- You identify a stable fact that will reduce future CEO steering\n\n` +

  `PRIORITY: CEO preferences and corrections > company conventions > active priorities > ` +
  `routing patterns > lessons learned. The most valuable memory prevents the CEO from ` +
  `having to repeat themselves.\n\n` +

  `Do NOT save task-specific details, session transcripts, completed-work logs, or ` +
  `temporary TODO state. Those belong in task records, not memory.\n\n` +

  `THREE TARGETS:\n` +
  `- 'user': who the CEO is -- name, role, preferences, communication style, pet peeves, ` +
  `decision patterns, timezone, work habits\n` +
  `- 'memory': your operational notes -- company conventions, active priorities, routing ` +
  `patterns, tool quirks, agent performance notes, lessons learned\n` +
  `- 'company': company state -- deliverables (status, assigned agent), assets (health, recent events), ` +
  `knowledge (title, source). Updated automatically by the system; you can also annotate entries mid-session.\n\n` +

  `ACTIONS:\n` +
  `- add: new entry (content required)\n` +
  `- replace: update existing entry (content identifies it via substring match, ` +
  `new_content is the replacement)\n` +
  `- remove: delete entry (content identifies it via substring match)\n\n` +

  `Memory is bounded (MEMORY.md: 2,200 chars, USER.md: 1,375 chars, COMPANY.md: 3,000 chars). When near the ` +
  `limit, replace or remove stale entries before adding new ones. Entries are separated ` +
  `by \u00A7 (section sign). Keep each entry focused on one fact or convention.`;

export function createTamirMemoryTool(_ctx: ToolContext) {
  const memoryTool = tool(
    'memory',
    TAMIR_MEMORY_DESCRIPTION,
    {
      action: z.enum(['add', 'replace', 'remove']).describe('The action to perform.'),
      target: z.enum(['memory', 'user', 'company']).describe("Which memory store: 'memory' for operational notes, 'user' for CEO profile, 'company' for company state (deliverables, assets, knowledge)."),
      content: z.string().describe('Content to add, or short unique substring identifying the entry to replace/remove.'),
      new_content: z.string().optional().describe('Replacement content (required for replace action).'),
    },
    async (args) => {
      const filePath = args.target === 'user' ? TAMIR_USER_PATH
        : args.target === 'company' ? TAMIR_COMPANY_PATH
        : TAMIR_MEMORY_PATH;
      const charLimit = args.target === 'user' ? USER_CHAR_LIMIT
        : args.target === 'company' ? COMPANY_CHAR_LIMIT
        : MEMORY_CHAR_LIMIT;

      const store = new MemoryStore(filePath, charLimit);
      await store.loadFromDisk();

      let result;

      switch (args.action) {
        case 'add':
          result = await store.add(args.content);
          break;

        case 'replace':
          if (!args.new_content) {
            result = { success: false, error: 'new_content is required for replace action.' };
            break;
          }
          result = await store.replace(args.content, args.new_content);
          break;

        case 'remove':
          result = await store.remove(args.content);
          break;

        default:
          result = { success: false, error: `Unknown action '${args.action}'. Use: add, replace, remove` };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  return [memoryTool];
}
