/**
 * Query Registry -- Stores SDK query() references keyed by runId.
 * Allows MCP tool handlers (e.g., install_tool) to access the running query's
 * setMcpServers() for hot-reloading MCP servers mid-session.
 */

// The query object is the async generator returned by SDK query().
// It has .setMcpServers() and .mcpServerStatus() methods.
// Using `unknown` since the SDK doesn't export a named type for it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryRef = any;

const registry = new Map<string, QueryRef>();

/**
 * Register a query reference when query() is created in invoke-agent.
 */
export function registerQueryRef(runId: string, q: QueryRef): void {
  registry.set(runId, q);
}

/**
 * Look up a query reference by runId (used by install tools for setMcpServers).
 */
export function getQueryRef(runId: string): QueryRef | undefined {
  return registry.get(runId);
}

/**
 * Unregister a query reference when query() completes (in finally block).
 */
export function unregisterQueryRef(runId: string): void {
  registry.delete(runId);
}
