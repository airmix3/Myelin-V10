/**
 * ToolContext — Per-invocation context injected into all MCP tool handlers.
 * Created fresh for each agent invocation to ensure isolation.
 */
export interface ToolContext {
  taskId: string;
  runId: string;
  agentId: string;
  department: string;
  deskDir: string;
  delivDir: string;
  manifestPath: string;
}

export function createToolContext(opts: {
  taskId: string;
  runId: string;
  agentId: string;
  department: string;
  deskDir: string;
  delivDir: string;
  manifestPath: string;
}): ToolContext {
  return { ...opts };
}
