/**
 * Role-based access control for MCP tools — Per TOOL-02.
 * Filesystem boundary enforcement for built-in tools — Per SANDBOX-01.
 *
 * MCP tools are exposed as mcp__cortex__toolname by the SDK.
 * Three tiers: Tamir-only, dept-head-only (+ Tamir), temp employee whitelist.
 *
 * Built-in tools (Read, Write, Edit, Glob, Grep, Bash) are restricted to
 * workspace boundaries (deskDir + delivDir) when workspaceBoundaries is provided.
 */

import { resolve } from 'path';
import { logger } from '@/lib/logger';

// Tamir-only tools
const TAMIR_ONLY = ['mcp__cortex__read_inbox', 'mcp__cortex__get_dept_status'];

// Dept head (+ Tamir) tools
const DEPT_HEAD_ONLY = [
  'mcp__cortex__approve_deliverable',
  'mcp__cortex__request_changes',
  'mcp__cortex__hire_employee',
  'mcp__cortex__file_to_vault',
  'mcp__cortex__update_asset_health',
  'mcp__cortex__add_asset_event',
  'mcp__cortex__link_asset_dependency',
];

// Temp employee whitelist — only these tools are allowed for temps
const TEMP_ALLOWED = [
  'mcp__cortex__read_memory',
  'mcp__cortex__write_memory',
  'mcp__cortex__read_knowledge',
  'mcp__cortex__search_knowledge',
  'mcp__cortex__promote_to_deliverable',
  'mcp__cortex__propose_skill',
  'mcp__cortex__submit_for_review',
  'mcp__cortex__install_tool',
  'mcp__cortex__install_skill',
  'mcp__cortex__suggest_asset_promotion',
];

// Built-in Claude Code tools that access the filesystem
const FILE_PATH_TOOLS: Record<string, string> = {
  Read: 'file_path',
  Write: 'file_path',
  Edit: 'file_path',
};

const OPTIONAL_PATH_TOOLS: Record<string, string> = {
  Glob: 'path',
  Grep: 'path',
};

export type CanUseToolFn = (
  toolName: string,
  input: Record<string, unknown>,
  options: { signal: AbortSignal; toolUseID: string; agentID?: string }
) => Promise<{ behavior: 'allow' } | { behavior: 'deny'; message: string }>;

/**
 * Check whether a target path falls within workspace boundaries.
 * Resolves relative paths against deskDir (the CWD for agent execution).
 */
function isPathAllowed(targetPath: string, boundaries: { deskDir: string; delivDir: string }): boolean {
  const absPath = resolve(boundaries.deskDir, targetPath);
  return absPath.startsWith(boundaries.deskDir) || absPath.startsWith(boundaries.delivDir);
}

/**
 * Extract absolute paths from a bash command string.
 * Returns all tokens that look like absolute paths (starting with /).
 */
function extractAbsolutePathsFromCommand(command: string): string[] {
  const regex = /(?:^|\s)(\/[^\s]+)/g;
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(command)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

export function buildCanUseTool(
  agentId: string,
  _department: string,
  workspaceBoundaries?: { deskDir: string; delivDir: string },
): CanUseToolFn {
  const isTamir = agentId === 'tamir';
  const isDeptHead = ['cto', 'cmo', 'coo'].includes(agentId);
  const isTempEmployee = !isTamir && !isDeptHead;

  const log = logger.child({ module: 'access-control', agentId });

  return async (toolName: string, input: Record<string, unknown>) => {
    // --- Filesystem boundary enforcement (built-in tools only) ---
    if (workspaceBoundaries && !toolName.startsWith('mcp__')) {
      // Tamir gets full data/ boundary (can install to any department)
      const effectiveBoundaries = isTamir
        ? { deskDir: resolve(process.cwd(), 'data'), delivDir: workspaceBoundaries.delivDir }
        : workspaceBoundaries;

      // Read, Write, Edit — required file_path
      const filePathKey = FILE_PATH_TOOLS[toolName];
      if (filePathKey) {
        const targetPath = input[filePathKey] as string | undefined;
        if (targetPath && !isPathAllowed(targetPath, effectiveBoundaries)) {
          log.warn({ toolName, targetPath, deskDir: effectiveBoundaries.deskDir }, 'DENIED: path outside workspace');
          return {
            behavior: 'deny',
            message: `Access denied: ${toolName} cannot access '${targetPath}' — outside workspace boundary. Use MCP tools (read_memory, read_knowledge, search_knowledge) to access shared resources.`,
          };
        }
      }

      // Glob, Grep — optional path (no path = CWD-relative, which is fine)
      const optPathKey = OPTIONAL_PATH_TOOLS[toolName];
      if (optPathKey) {
        const targetPath = input[optPathKey] as string | undefined;
        if (targetPath && !isPathAllowed(targetPath, effectiveBoundaries)) {
          log.warn({ toolName, targetPath, deskDir: effectiveBoundaries.deskDir }, 'DENIED: path outside workspace');
          return {
            behavior: 'deny',
            message: `Access denied: ${toolName} cannot access '${targetPath}' — outside workspace boundary. Use MCP tools (read_memory, read_knowledge, search_knowledge) to access shared resources.`,
          };
        }
      }

      // Bash — scan command for absolute paths outside boundaries
      if (toolName === 'Bash') {
        const command = input.command as string | undefined;
        if (command) {
          const absPaths = extractAbsolutePathsFromCommand(command);
          for (const absPath of absPaths) {
            if (!isPathAllowed(absPath, effectiveBoundaries)) {
              return {
                behavior: 'deny',
                message: `Access denied: Bash cannot access '${absPath}' — outside workspace boundary. Use MCP tools (read_memory, read_knowledge, search_knowledge) to access shared resources.`,
              };
            }
          }
        }
      }
    }

    // --- MCP role-based access control ---
    // Non-MCP tools — allow (filesystem check above already handled)
    if (!toolName.startsWith('mcp__cortex__')) {
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
        message: `Temp employees can only use: ${TEMP_ALLOWED.map(t => t.replace('mcp__cortex__', '')).join(', ')}`,
      };
    }

    return { behavior: 'allow' };
  };
}
