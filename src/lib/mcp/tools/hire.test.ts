/**
 * Tests for hire_employee MCP tool — Per doc 17 Phase 3.
 * Verifies CEO escalation path, auto-approve path, metadata handling.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sqlite, prisma } from '@/lib/db';
import { eventBus } from '@/lib/events';
import { insertActivityLog } from '@/lib/activity-log';
import type { ToolContext } from '../tool-context';

// We need to mock additional modules used by hire.ts
vi.mock('@/lib/state-machine', () => ({
  transitionTask: vi.fn().mockReturnValue({ success: true }),
}));

vi.mock('@/lib/orchestrator', () => ({
  orchestrator: {
    register: vi.fn(),
  },
}));

// Mock config to control auto-approve behavior
// Default: no auto-approve
vi.mock('@/lib/config', async () => {
  return {
    HIRING_TEMP_AUTO_APPROVE: false,
    HIRING_AUTO_APPROVE: false,
    HIRING_MAX_TEMP_PER_TASK: 5,
    HIRING_MAX_PERMANENT_PER_DEPT: 10,
    DELEGATION_SUBTASK_TIMEOUT_MINUTES: 60,
  };
});

// Import after mocks
import { createHireTools } from './hire';
import { transitionTask } from '@/lib/state-machine';
import { orchestrator } from '@/lib/orchestrator';
import * as config from '@/lib/config';

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    taskId: 'task_001',
    runId: 'run_001',
    agentId: 'cto',
    department: 'tech',
    deskDir: '/tmp/test-desk',
    delivDir: '/tmp/test-deliv',
    manifestPath: '/tmp/test-deliv/manifest.json',
    ...overrides,
  };
}

describe('hire_employee', () => {
  let handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
  const mockGet = (sqlite.prepare as ReturnType<typeof vi.fn>)('').get;
  const mockRun = (sqlite.prepare as ReturnType<typeof vi.fn>)('').run;

  beforeEach(() => {
    const ctx = makeCtx();
    const tools = createHireTools(ctx);
    const hireTool = tools.find(t => t.name === 'hire_employee')!;
    handler = hireTool.handler as typeof handler;

    // Default: task metadata is empty
    mockGet.mockReturnValue({ metadata: '{}' });
    mockRun.mockReturnValue({ changes: 1 });

    // Default: prisma create returns an object with id
    (prisma.hireRequest.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'hire_test_1' });
    (prisma.employee.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'emp_test_1' });

    // Reset auto-approve to false for each test
    Object.defineProperty(config, 'HIRING_TEMP_AUTO_APPROVE', { value: false, writable: true });
    Object.defineProperty(config, 'HIRING_AUTO_APPROVE', { value: false, writable: true });
  });

  // -----------------------------------------------------------------------
  // Non-auto-approve path (default)
  // -----------------------------------------------------------------------
  describe('non-auto-approve path (default)', () => {
    it('creates HireRequest via prisma with status=pending', async () => {
      await handler({
        employee_name: 'Alex Chen',
        employee_role: 'Market Research Analyst',
        justification: 'Need competitive analysis expertise',
      });

      expect(prisma.hireRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: 'task_001',
          requestedBy: 'cto',
          employeeName: 'Alex Chen',
          employeeRole: 'Market Research Analyst',
          justification: 'Need competitive analysis expertise',
          status: 'pending',
        }),
      });
    });

    it('stores pendingHire in task.metadata with type, soulDraft, specialty, outputTypes', async () => {
      await handler({
        employee_name: 'Alex',
        employee_role: 'Analyst',
        justification: 'Need help',
        type: 'temp',
        soul_draft: 'You are a market analyst',
        specialty: 'competitive analysis',
        output_types: ['report'],
      });

      // Verify metadata update via sqlite
      const prepareCalls = (sqlite.prepare as ReturnType<typeof vi.fn>).mock.calls;
      const updateCalls = prepareCalls.filter((c: string[]) => c[0].includes('UPDATE tasks SET metadata'));
      expect(updateCalls.length).toBeGreaterThan(0);

      // Check the metadata JSON was written with pendingHire
      const runCalls = mockRun.mock.calls;
      const metadataCall = runCalls.find((c: unknown[]) => {
        try {
          const parsed = JSON.parse(c[0] as string);
          return parsed.pendingHire !== undefined;
        } catch {
          return false;
        }
      });
      expect(metadataCall).toBeDefined();
      const metadata = JSON.parse(metadataCall![0] as string);
      expect(metadata.pendingHire.type).toBe('temp');
      expect(metadata.pendingHire.soulDraft).toBe('You are a market analyst');
      expect(metadata.pendingHire.specialty).toBe('competitive analysis');
      expect(metadata.pendingHire.outputTypes).toEqual(['report']);
    });

    it('calls transitionTask from working to input-required with inputType=hire_approval', async () => {
      await handler({
        employee_name: 'Alex',
        employee_role: 'Analyst',
        justification: 'Need help',
      });

      expect(transitionTask).toHaveBeenCalledWith(
        'task_001',
        'working',
        'input-required',
        expect.objectContaining({ inputType: 'hire_approval' }),
      );
    });

    it('returns message about CEO approval pending', async () => {
      const result = await handler({
        employee_name: 'Alex',
        employee_role: 'Analyst',
        justification: 'Need help',
      });

      expect(result.content[0].text).toContain('CEO approval');
    });

    it('emits hire:requested event', async () => {
      await handler({
        employee_name: 'Alex',
        employee_role: 'Analyst',
        justification: 'Need help',
        type: 'temp',
      });

      expect(eventBus.emit).toHaveBeenCalledWith(
        'hire:requested',
        expect.objectContaining({
          taskId: 'task_001',
          employeeName: 'Alex',
          employeeRole: 'Analyst',
          requestedBy: 'cto',
          type: 'temp',
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Auto-approve temp path
  // -----------------------------------------------------------------------
  describe('auto-approve temp path (HIRING_TEMP_AUTO_APPROVE=true)', () => {
    beforeEach(() => {
      Object.defineProperty(config, 'HIRING_TEMP_AUTO_APPROVE', { value: true, writable: true });
    });

    it('creates HireRequest with status=approved', async () => {
      await handler({
        employee_name: 'Quick Worker',
        employee_role: 'Temp Helper',
        justification: 'One-off task',
        type: 'temp',
      });

      expect(prisma.hireRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'approved',
        }),
      });
    });

    it('creates Employee via prisma with capabilities JSON', async () => {
      await handler({
        employee_name: 'Quick Worker',
        employee_role: 'Temp Helper',
        justification: 'One-off task',
        type: 'temp',
        specialty: 'data extraction',
        output_types: ['csv', 'json'],
      });

      expect(prisma.employee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Quick Worker',
          role: 'temp',
          department: 'tech',
          status: 'active',
          capabilities: expect.stringContaining('data extraction'),
        }),
      });
    });

    it('calls orchestrator.register with isEmployee=true and parentAgentId=ctx.agentId', async () => {
      await handler({
        employee_name: 'Quick Worker',
        employee_role: 'Temp Helper',
        justification: 'One-off task',
        type: 'temp',
      });

      expect(orchestrator.register).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Quick Worker',
          department: 'tech',
          role: 'temp',
          isEmployee: true,
          parentAgentId: 'cto',
        }),
      );
    });

    it('cleans pendingHire from metadata after auto-approve', async () => {
      await handler({
        employee_name: 'Quick Worker',
        employee_role: 'Temp Helper',
        justification: 'One-off task',
        type: 'temp',
      });

      // The last metadata update should NOT have pendingHire
      const runCalls = mockRun.mock.calls;
      // Find the last metadata update
      const metadataUpdates = runCalls.filter((c: unknown[]) => {
        try {
          JSON.parse(c[0] as string);
          return true;
        } catch {
          return false;
        }
      });
      if (metadataUpdates.length > 0) {
        const lastMeta = JSON.parse(metadataUpdates[metadataUpdates.length - 1][0] as string);
        expect(lastMeta.pendingHire).toBeUndefined();
      }
    });

    it('returns message confirming hire + agentId', async () => {
      const result = await handler({
        employee_name: 'Quick Worker',
        employee_role: 'Temp Helper',
        justification: 'One-off task',
        type: 'temp',
      });

      expect(result.content[0].text).toContain('Quick Worker');
      expect(result.content[0].text).toContain('hired');
    });

    it('does NOT call transitionTask', async () => {
      await handler({
        employee_name: 'Quick Worker',
        employee_role: 'Temp Helper',
        justification: 'One-off task',
        type: 'temp',
      });

      expect(transitionTask).not.toHaveBeenCalled();
    });

    it('inserts HIRE_AUTO_APPROVED activity log', async () => {
      await handler({
        employee_name: 'Quick Worker',
        employee_role: 'Temp Helper',
        justification: 'One-off task',
        type: 'temp',
      });

      expect(insertActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'HIRE_AUTO_APPROVED',
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Auto-approve all path
  // -----------------------------------------------------------------------
  describe('auto-approve all path (HIRING_AUTO_APPROVE=true)', () => {
    beforeEach(() => {
      Object.defineProperty(config, 'HIRING_AUTO_APPROVE', { value: true, writable: true });
    });

    it('permanent hire is also auto-approved', async () => {
      await handler({
        employee_name: 'Senior Dev',
        employee_role: 'Backend Engineer',
        justification: 'Need permanent backend help',
        type: 'permanent',
      });

      expect(prisma.hireRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'approved',
        }),
      });

      expect(prisma.employee.create).toHaveBeenCalled();
      expect(orchestrator.register).toHaveBeenCalled();
      expect(transitionTask).not.toHaveBeenCalled();
    });
  });
});
