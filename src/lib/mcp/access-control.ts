/**
 * Role-based access control for MCP tools — Per TOOL-02.
 *
 * MCP tools are exposed as mcp__myelin__toolname by the SDK.
 * Three tiers: Tamir-only, dept-head-only (+ Tamir), temp employee whitelist.
 */

// Tamir-only tools
const TAMIR_ONLY = ['mcp__myelin__read_inbox', 'mcp__myelin__get_dept_status'];

// Dept head (+ Tamir) tools
const DEPT_HEAD_ONLY = [
  'mcp__myelin__approve_deliverable',
  'mcp__myelin__request_changes',
  'mcp__myelin__hire_employee',
  'mcp__myelin__file_to_vault',
];

// Temp employee whitelist — only these tools are allowed for temps
const TEMP_ALLOWED = [
  'mcp__myelin__read_memory',
  'mcp__myelin__write_memory',
  'mcp__myelin__read_knowledge',
  'mcp__myelin__search_knowledge',
  'mcp__myelin__promote_to_deliverable',
  'mcp__myelin__propose_skill',
  'mcp__myelin__submit_for_review',
];

export type CanUseToolFn = (
  toolName: string,
  input: Record<string, unknown>,
  options: { signal: AbortSignal; toolUseID: string; agentID?: string }
) => Promise<{ behavior: 'allow' } | { behavior: 'deny'; message: string }>;

export function buildCanUseTool(agentId: string, _department: string): CanUseToolFn {
  const isTamir = agentId === 'tamir';
  const isDeptHead = ['cto', 'cmo', 'coo'].includes(agentId);
  const isTempEmployee = !isTamir && !isDeptHead;

  return async (toolName: string) => {
    // Non-MCP tools (Bash, Read, Edit, etc.) — allow all
    if (!toolName.startsWith('mcp__myelin__')) {
      return { behavior: 'allow' };
    }

    // Tamir-only tools
    if (TAMIR_ONLY.includes(toolName) && !isTamir) {
      return { behavior: 'deny', message: `Tool ${toolName} is Tamir-only` };
    }

    // Dept-head-only tools (Tamir also allowed per TOOL-10)
    if (DEPT_HEAD_ONLY.includes(toolName) && !isDeptHead && !isTamir) {
      return { behavior: 'deny', message: `Tool ${toolName} requires department head role` };
    }

    // Temp employee restrictions — whitelist only
    if (isTempEmployee && !TEMP_ALLOWED.includes(toolName)) {
      return {
        behavior: 'deny',
        message: `Temp employees can only use: ${TEMP_ALLOWED.map(t => t.replace('mcp__myelin__', '')).join(', ')}`,
      };
    }

    return { behavior: 'allow' };
  };
}
