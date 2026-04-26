/**
 * Tests for buildCanUseTool() access control — Per doc 17 Phase 1.
 * buildCanUseTool is a pure function returning an async checker.
 * Only logger needs mocking (done in test setup).
 */
import { describe, it, expect } from 'vitest';
import { buildCanUseTool } from './access-control';

// Helper to call the tool checker with minimal args
async function check(
  agentId: string,
  department: string,
  toolName: string,
  input: Record<string, unknown> = {},
) {
  const canUseTool = buildCanUseTool(agentId, department);
  return canUseTool(toolName, input, {
    signal: new AbortController().signal,
    toolUseID: 'test',
  });
}

describe('buildCanUseTool — MCP role-based access control', () => {
  // -----------------------------------------------------------------------
  // Tamir-only tools
  // -----------------------------------------------------------------------
  describe('TAMIR_ONLY tools', () => {
    it('Tamir can use read_inbox', async () => {
      const result = await check('tamir', 'global', 'mcp__cortex__read_inbox');
      expect(result.behavior).toBe('allow');
    });

    it('CTO cannot use read_inbox', async () => {
      const result = await check('cto', 'tech', 'mcp__cortex__read_inbox');
      expect(result.behavior).toBe('deny');
    });

    it('Tamir can use get_dept_status', async () => {
      const result = await check('tamir', 'global', 'mcp__cortex__get_dept_status');
      expect(result.behavior).toBe('allow');
    });

    it('temp employee cannot use read_inbox', async () => {
      const result = await check('temp_worker_123', 'tech', 'mcp__cortex__read_inbox');
      expect(result.behavior).toBe('deny');
    });
  });

  // -----------------------------------------------------------------------
  // Dept-head-only tools
  // -----------------------------------------------------------------------
  describe('DEPT_HEAD_ONLY tools', () => {
    it('CTO can use delegate_subtask', async () => {
      const result = await check('cto', 'tech', 'mcp__cortex__delegate_subtask');
      expect(result.behavior).toBe('allow');
    });

    it('CMO can use delegate_subtask', async () => {
      const result = await check('cmo', 'marketing', 'mcp__cortex__delegate_subtask');
      expect(result.behavior).toBe('allow');
    });

    it('COO can use list_my_employees', async () => {
      const result = await check('coo', 'operations', 'mcp__cortex__list_my_employees');
      expect(result.behavior).toBe('allow');
    });

    it('Tamir can use dept-head tools (per TOOL-10)', async () => {
      const result = await check('tamir', 'global', 'mcp__cortex__delegate_subtask');
      expect(result.behavior).toBe('allow');
    });

    it('temp employee cannot use delegate_subtask (per doc 17: single-level delegation)', async () => {
      const result = await check('temp_worker_123', 'tech', 'mcp__cortex__delegate_subtask');
      expect(result.behavior).toBe('deny');
    });

    it('temp employee cannot use hire_employee', async () => {
      const result = await check('temp_worker_123', 'tech', 'mcp__cortex__hire_employee');
      expect(result.behavior).toBe('deny');
    });

    it('CTO can use hire_employee', async () => {
      const result = await check('cto', 'tech', 'mcp__cortex__hire_employee');
      expect(result.behavior).toBe('allow');
    });

    it('CTO can use list_my_employees', async () => {
      const result = await check('cto', 'tech', 'mcp__cortex__list_my_employees');
      expect(result.behavior).toBe('allow');
    });
  });

  // -----------------------------------------------------------------------
  // Temp employee whitelist (TEMP_ALLOWED)
  // -----------------------------------------------------------------------
  describe('TEMP_ALLOWED tools', () => {
    it('temp employee can use submit_deliverable', async () => {
      const result = await check('temp_worker_123', 'tech', 'mcp__cortex__submit_deliverable');
      expect(result.behavior).toBe('allow');
    });

    it('temp employee can use request_input', async () => {
      const result = await check('temp_worker_123', 'tech', 'mcp__cortex__request_input');
      expect(result.behavior).toBe('allow');
    });

    it('temp employee can use read_memory', async () => {
      const result = await check('temp_worker_123', 'tech', 'mcp__cortex__read_memory');
      expect(result.behavior).toBe('allow');
    });

    it('temp employee can use promote_to_deliverable', async () => {
      const result = await check('temp_worker_123', 'tech', 'mcp__cortex__promote_to_deliverable');
      expect(result.behavior).toBe('allow');
    });

    it('per doc 17: temp employees cannot use escalate_to_ceo', async () => {
      const result = await check('temp_worker_123', 'tech', 'mcp__cortex__escalate_to_ceo');
      expect(result.behavior).toBe('deny');
    });

    it('temp employee cannot use an unknown cortex MCP tool', async () => {
      const result = await check('temp_worker_123', 'tech', 'mcp__cortex__some_unknown_tool');
      expect(result.behavior).toBe('deny');
    });
  });

  // -----------------------------------------------------------------------
  // Non-MCP tools
  // -----------------------------------------------------------------------
  describe('Non-MCP tools', () => {
    it('non-MCP tools are allowed for all roles (no workspace boundaries)', async () => {
      for (const agentId of ['tamir', 'cto', 'temp_worker_123']) {
        const result = await check(agentId, 'tech', 'SomeNonMCPTool');
        expect(result.behavior).toBe('allow');
      }
    });

    it('Read tool without workspace boundaries is allowed', async () => {
      const result = await check('temp_worker_123', 'tech', 'Read', { file_path: '/some/path' });
      expect(result.behavior).toBe('allow');
    });
  });

  // -----------------------------------------------------------------------
  // Dept heads should have full MCP access
  // -----------------------------------------------------------------------
  describe('Dept heads full MCP access', () => {
    it('CTO can use all TEMP_ALLOWED tools too', async () => {
      const result = await check('cto', 'tech', 'mcp__cortex__submit_deliverable');
      expect(result.behavior).toBe('allow');
    });

    it('CMO can use all TEMP_ALLOWED tools', async () => {
      const result = await check('cmo', 'marketing', 'mcp__cortex__request_input');
      expect(result.behavior).toBe('allow');
    });
  });
});
