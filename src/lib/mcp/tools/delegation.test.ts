/**
 * Tests for delegate_subtask, submit_deliverable, request_input
 * Per doc 17 Phase 2: Sub-task delegation.
 *
 * Uses real temp directories for filesystem operations.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';
import { sqlite } from '@/lib/db';
import { eventBus } from '@/lib/events';
import { insertActivityLog } from '@/lib/activity-log';
import { createDelegationTools } from './delegation';
import type { ToolContext } from '../tool-context';

let tempDir: string;

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    taskId: 'task_001',
    runId: 'run_001',
    agentId: 'cto',
    department: 'tech',
    deskDir: tempDir,
    delivDir: join(tempDir, '..', 'deliverables'),
    manifestPath: join(tempDir, '..', 'deliverables', 'manifest.json'),
    ...overrides,
  };
}

describe('delegation tools', () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'delegation-test-'));
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // -----------------------------------------------------------------------
  // delegate_subtask
  // -----------------------------------------------------------------------
  describe('delegate_subtask', () => {
    let handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
    const mockGet = (sqlite.prepare as ReturnType<typeof vi.fn>)('').get;
    const mockRun = (sqlite.prepare as ReturnType<typeof vi.fn>)('').run;

    beforeEach(() => {
      const ctx = makeCtx();
      const tools = createDelegationTools(ctx);
      const delegateTool = tools.find(t => t.name === 'delegate_subtask')!;
      handler = delegateTool.handler as typeof handler;

      // Default mock: employee found
      mockGet.mockImplementation((..._args: unknown[]) => {
        // First call: employee lookup, Second call: current run sessionId
        return { id: 'emp_123', sessionId: 'session_abc' };
      });
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    });

    it('creates subtask directory structure: subtasks/st_xxx/shared/, output/, .claude/', async () => {
      await handler({
        employee_agent_id: 'analyst_01',
        description: 'Research competitors',
      });

      // Find the created subtask dir
      const subtasksDir = join(tempDir, 'subtasks');
      expect(existsSync(subtasksDir)).toBe(true);

      const dirs = require('fs').readdirSync(subtasksDir).filter((f: string) => f.startsWith('st_'));
      expect(dirs.length).toBeGreaterThanOrEqual(1);

      const subtaskDir = join(subtasksDir, dirs[0]);
      expect(existsSync(join(subtaskDir, 'shared'))).toBe(true);
      expect(existsSync(join(subtaskDir, 'output'))).toBe(true);
      expect(existsSync(join(subtaskDir, '.claude'))).toBe(true);
    });

    it('writes CLAUDE.md in subtask dir with description', async () => {
      await handler({
        employee_agent_id: 'analyst_01',
        description: 'Research top 5 competitors',
      });

      const subtasksDir = join(tempDir, 'subtasks');
      const dirs = require('fs').readdirSync(subtasksDir).filter((f: string) => f.startsWith('st_'));
      const subtaskDir = join(subtasksDir, dirs[0]);
      const claudeMd = readFileSync(join(subtaskDir, 'CLAUDE.md'), 'utf-8');

      expect(claudeMd).toContain('Research top 5 competitors');
      expect(claudeMd).toContain('submit_deliverable');
      expect(claudeMd).toContain('request_input');
    });

    it('writes settings.json in subtask .claude/ dir', async () => {
      await handler({
        employee_agent_id: 'analyst_01',
        description: 'Do work',
      });

      const subtasksDir = join(tempDir, 'subtasks');
      const dirs = require('fs').readdirSync(subtasksDir).filter((f: string) => f.startsWith('st_'));
      const settingsPath = join(subtasksDir, dirs[0], '.claude', 'settings.json');

      expect(existsSync(settingsPath)).toBe(true);
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      expect(settings.permissions).toBeDefined();
      expect(settings.permissions.allow).toContain('Bash(*)');
    });

    it('creates delegation_log.jsonl entry with correct fields', async () => {
      await handler({
        employee_agent_id: 'analyst_01',
        description: 'Research competitors',
        budget_cents: 1000,
      });

      const logPath = join(tempDir, 'subtasks', 'delegation_log.jsonl');
      expect(existsSync(logPath)).toBe(true);

      const logLine = readFileSync(logPath, 'utf-8').trim();
      const entry = JSON.parse(logLine);

      expect(entry.subtaskId).toMatch(/^st_/);
      expect(entry.employee).toBe('analyst_01');
      expect(entry.description).toBe('Research competitors');
      expect(entry.iteration).toBe(1);
      expect(entry.status).toBe('delegated');
      expect(entry.budgetCents).toBe(1000);
      expect(entry.timestamp).toBeDefined();
    });

    it('inserts child TaskRun with status=queued and onComplete JSON', async () => {
      await handler({
        employee_agent_id: 'analyst_01',
        description: 'Research competitors',
      });

      // Verify sqlite.prepare was called with INSERT INTO task_runs
      const prepareCalls = (sqlite.prepare as ReturnType<typeof vi.fn>).mock.calls;
      const insertCall = prepareCalls.find((c: string[]) =>
        c[0].includes('INSERT INTO task_runs')
      );
      expect(insertCall).toBeDefined();

      // Verify run() was called with the right args
      const runCalls = mockRun.mock.calls;
      // The insert call should have: id, taskId, empId, subtaskId, desc, workspaceCwd, parentRunId, onComplete
      const insertRunCall = runCalls.find((c: unknown[]) => {
        const onCompleteArg = c[7] as string | undefined;
        return typeof onCompleteArg === 'string' && onCompleteArg.includes('resume_parent');
      });
      expect(insertRunCall).toBeDefined();

      // Parse the onComplete JSON
      const onComplete = JSON.parse(insertRunCall![7] as string);
      expect(onComplete.action).toBe('resume_parent');
      expect(onComplete.parentRunId).toBe('run_001');
      expect(onComplete.subtaskId).toMatch(/^st_/);
    });

    it('returns success message mentioning re-invocation', async () => {
      const result = await handler({
        employee_agent_id: 'analyst_01',
        description: 'Do work',
      });

      const text = result.content[0].text;
      expect(text).toContain('delegated');
      expect(text).toContain('re-invoked');
    });

    it('returns error message when employee not found', async () => {
      mockGet.mockReturnValue(undefined);

      const result = await handler({
        employee_agent_id: 'nonexistent',
        description: 'Do work',
      });

      const text = result.content[0].text;
      expect(text).toContain('Error');
      expect(text).toContain('nonexistent');
      expect(text).toContain('not found');
    });

    it('creates shared_files symlinks with a real file', async () => {
      // Create a source file in the desk dir
      const sourceFile = join(tempDir, 'reference.md');
      writeFileSync(sourceFile, '# Reference doc', 'utf-8');

      await handler({
        employee_agent_id: 'analyst_01',
        description: 'Do work',
        shared_files: ['reference.md'],
      });

      const subtasksDir = join(tempDir, 'subtasks');
      const dirs = require('fs').readdirSync(subtasksDir).filter((f: string) => f.startsWith('st_'));
      const sharedPath = join(subtasksDir, dirs[0], 'shared', 'reference.md');

      expect(existsSync(sharedPath)).toBe(true);
    });

    it('per doc 17: subtask workspace layout matches spec (desk/subtasks/st_xxx/{shared,output})', async () => {
      await handler({
        employee_agent_id: 'analyst_01',
        description: 'Do work',
      });

      const subtasksDir = join(tempDir, 'subtasks');
      const dirs = require('fs').readdirSync(subtasksDir).filter((f: string) => f.startsWith('st_'));
      const subtaskDir = join(subtasksDir, dirs[0]);

      // Verify layout per doc 17 spec
      expect(existsSync(join(subtaskDir, 'shared'))).toBe(true);
      expect(existsSync(join(subtaskDir, 'output'))).toBe(true);
    });

    it('emits delegation:created event', async () => {
      await handler({
        employee_agent_id: 'analyst_01',
        description: 'Do work',
      });

      expect(eventBus.emit).toHaveBeenCalledWith(
        'delegation:created',
        expect.objectContaining({
          taskId: 'task_001',
          employeeAgentId: 'analyst_01',
          parentRunId: 'run_001',
        }),
      );
    });

    it('inserts activity log entry', async () => {
      await handler({
        employee_agent_id: 'analyst_01',
        description: 'Research competitors',
      });

      expect(insertActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task_001',
          agentId: 'cto',
          actionType: 'DELEGATION_CREATED',
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // submit_deliverable
  // -----------------------------------------------------------------------
  describe('submit_deliverable', () => {
    let handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
    const mockGet = (sqlite.prepare as ReturnType<typeof vi.fn>)('').get;

    beforeEach(() => {
      const ctx = makeCtx();
      const tools = createDelegationTools(ctx);
      const submitTool = tools.find(t => t.name === 'submit_deliverable')!;
      handler = submitTool.handler as typeof handler;

      // Default mock: run with subtask info
      mockGet.mockReturnValue({
        subtask_id: 'st_abc123',
        subtask_description: 'Research competitors',
      });
    });

    it('writes deliverable.json with correct fields per doc 17', async () => {
      await handler({
        summary: 'Found 5 competitors',
        primary_file: 'output/report.md',
      });

      const delivPath = join(tempDir, 'deliverable.json');
      expect(existsSync(delivPath)).toBe(true);

      const deliv = JSON.parse(readFileSync(delivPath, 'utf-8'));
      expect(deliv.subtaskId).toBe('st_abc123');
      expect(deliv.parentTaskId).toBe('task_001');
      expect(deliv.assignedTo).toBe('cto');
      expect(deliv.description).toBe('Research competitors');
      expect(deliv.status).toBe('completed');
      expect(deliv.summary).toBe('Found 5 competitors');
      expect(deliv.primaryFile).toBe('output/report.md');
      expect(deliv.iteration).toBe(1);
      expect(deliv.completedAt).toBeDefined();
    });

    it('default status is completed', async () => {
      await handler({
        summary: 'Done',
        primary_file: 'output/result.txt',
      });

      const deliv = JSON.parse(readFileSync(join(tempDir, 'deliverable.json'), 'utf-8'));
      expect(deliv.status).toBe('completed');
    });

    it('needs_revision status works', async () => {
      await handler({
        summary: 'Partial results',
        primary_file: 'output/partial.md',
        status: 'needs_revision',
      });

      const deliv = JSON.parse(readFileSync(join(tempDir, 'deliverable.json'), 'utf-8'));
      expect(deliv.status).toBe('needs_revision');
    });

    it('returns confirmation message', async () => {
      const result = await handler({
        summary: 'All done',
        primary_file: 'output/file.md',
      });

      expect(result.content[0].text).toContain('Deliverable submitted');
      expect(result.content[0].text).toContain('All done');
    });
  });

  // -----------------------------------------------------------------------
  // request_input
  // -----------------------------------------------------------------------
  describe('request_input', () => {
    let handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
    const mockGet = (sqlite.prepare as ReturnType<typeof vi.fn>)('').get;

    beforeEach(() => {
      const ctx = makeCtx();
      const tools = createDelegationTools(ctx);
      const requestTool = tools.find(t => t.name === 'request_input')!;
      handler = requestTool.handler as typeof handler;

      mockGet.mockReturnValue({
        subtask_id: 'st_abc123',
        subtask_description: 'Research competitors',
      });
    });

    it('per doc 17: writes deliverable.json with status=needs_input and question field', async () => {
      await handler({ question: 'Include stealth-mode competitors?' });

      const delivPath = join(tempDir, 'deliverable.json');
      expect(existsSync(delivPath)).toBe(true);

      const deliv = JSON.parse(readFileSync(delivPath, 'utf-8'));
      expect(deliv.status).toBe('needs_input');
      expect(deliv.question).toBe('Include stealth-mode competitors?');
    });

    it('summary and primaryFile are null', async () => {
      await handler({ question: 'What format?' });

      const deliv = JSON.parse(readFileSync(join(tempDir, 'deliverable.json'), 'utf-8'));
      expect(deliv.summary).toBeNull();
      expect(deliv.primaryFile).toBeNull();
    });

    it('completedAt is null', async () => {
      await handler({ question: 'Clarify scope?' });

      const deliv = JSON.parse(readFileSync(join(tempDir, 'deliverable.json'), 'utf-8'));
      expect(deliv.completedAt).toBeNull();
    });

    it('returns message about head being re-invoked', async () => {
      const result = await handler({ question: 'Include stealth-mode competitors?' });

      expect(result.content[0].text).toContain('Input requested');
      expect(result.content[0].text).toContain('Include stealth-mode competitors?');
    });

    it('inserts activity log entry for input request', async () => {
      await handler({ question: 'What format?' });

      expect(insertActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'SUBTASK_INPUT_REQUESTED',
        }),
      );
    });
  });
});
