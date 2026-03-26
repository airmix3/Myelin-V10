/**
 * MCP tools: read_inbox, get_dept_status — Per TOOL-12, TOOL-13.
 * Tamir's notification inbox (read+clear with lockfile) and department status overview.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as lockfile from 'proper-lockfile';
import { sqlite } from '@/lib/db';
import type { ToolContext } from '../tool-context';

const INBOX_PATH = resolve(process.cwd(), 'data', 'agents', 'tamir', 'inbox.jsonl');

interface TaskCountRow {
  department: string;
  state: string;
  count: number;
}

interface EmployeeCountRow {
  department: string;
  count: number;
}

export function createInboxTools(ctx: ToolContext) {
  const readInbox = tool(
    'read_inbox',
    'Read and clear your notification inbox.',
    {},
    async () => {
      if (!existsSync(INBOX_PATH)) {
        return { content: [{ type: 'text' as const, text: 'No pending notifications.' }] };
      }

      let release: (() => Promise<void>) | undefined;
      let content: string;
      try {
        release = await lockfile.lock(INBOX_PATH, { retries: 3, realpath: false });
        content = readFileSync(INBOX_PATH, 'utf-8');
        writeFileSync(INBOX_PATH, '', 'utf-8');
      } finally {
        if (release) await release();
      }

      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No pending notifications.' }] };
      }

      const notifications = lines.map(line => {
        try {
          const entry = JSON.parse(line) as Record<string, unknown>;
          const type = entry.type ?? 'unknown';
          const timestamp = entry.timestamp ?? '';
          // Build summary from available fields
          const fields = Object.entries(entry)
            .filter(([k]) => k !== 'type' && k !== 'timestamp')
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          return `[${type}] ${fields} (${timestamp})`;
        } catch {
          return `[parse_error] ${line}`;
        }
      });

      return {
        content: [{ type: 'text' as const, text: notifications.join('\n') }],
      };
    },
    { annotations: { readOnlyHint: false } },
  );

  const getDeptStatus = tool(
    'get_dept_status',
    'Get summary of active tasks across all departments.',
    {},
    async () => {
      const taskCounts = sqlite.prepare(
        "SELECT department, state, COUNT(*) as count FROM tasks WHERE state NOT IN ('completed', 'failed', 'canceled') GROUP BY department, state"
      ).all() as TaskCountRow[];

      const employeeCounts = sqlite.prepare(
        "SELECT department, COUNT(*) as count FROM employees WHERE status = 'active' GROUP BY department"
      ).all() as EmployeeCountRow[];

      // Build department map
      const depts = new Map<string, { tasks: Map<string, number>; agents: number }>();

      for (const row of taskCounts) {
        if (!depts.has(row.department)) {
          depts.set(row.department, { tasks: new Map(), agents: 0 });
        }
        depts.get(row.department)!.tasks.set(row.state, row.count);
      }

      for (const row of employeeCounts) {
        if (!depts.has(row.department)) {
          depts.set(row.department, { tasks: new Map(), agents: 0 });
        }
        depts.get(row.department)!.agents = row.count;
      }

      if (depts.size === 0) {
        return { content: [{ type: 'text' as const, text: 'No active tasks or agents found.' }] };
      }

      let output = '## Department Status\n';
      for (const [dept, info] of depts) {
        const totalTasks = Array.from(info.tasks.values()).reduce((a, b) => a + b, 0);
        const breakdown = Array.from(info.tasks.entries())
          .map(([state, count]) => `${state}: ${count}`)
          .join(', ');
        output += `\n### ${dept.charAt(0).toUpperCase() + dept.slice(1)}\n`;
        output += `- Active tasks: ${totalTasks}${breakdown ? ` (${breakdown})` : ''}\n`;
        output += `- Active agents: ${info.agents}\n`;
      }

      return { content: [{ type: 'text' as const, text: output }] };
    },
    { annotations: { readOnlyHint: true } },
  );

  return [readInbox, getDeptStatus];
}
