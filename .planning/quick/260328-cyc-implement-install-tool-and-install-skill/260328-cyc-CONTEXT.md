# Quick Task 260328-cyc: Implement install_tool and install_skill MCP tools - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Task Boundary

Implement two new MCP tools (`install_tool`, `install_skill`) that allow agents to request tool/skill installation mid-session. Installation triggers department head approval via a separate `query()` call, installs to department directory, and hot-reloads the running agent's MCP servers via `setMcpServers()`.

</domain>

<decisions>
## Implementation Decisions

### Approval Flow
- Department head (CTO/CMO/COO) is invoked via `query()` to approve/reject the install request
- Runs from a new "manager desk" directory (similar hierarchy to planning-desk)
- Dept head receives: task brief, current state, and justification for why the tool/skill is needed
- Dept head has full tool access (can search web, call CEO, etc.) to make the decision
- In the agent log: a thick horizontal line + label shows the agent switch, with a bounded area showing the dept head's activity (tool calls, searches, etc.)

### Hot-Reload Plumbing
- Shared query ref: store the `query` object in a registry keyed by runId
- MCP tool handler looks up the query ref and calls `q.setMcpServers()` directly after installation
- No event bus indirection needed

### Tool Sources
- Tools: npm packages (MCP servers installed via npm/pnpm)
- Skills: skills.sh CLI (already integrated via `npx skills search`)
- No GitHub repos or arbitrary URL support for now

### Department Directory Structure
- Each department gets `data/departments/{dept}/tools/` and `data/departments/{dept}/skills/` directories
- Installed tools/skills persist there and are available to future tasks in that department
- Manager desk: `data/departments/{dept}/manager-desk/` (new, parallel to planning-desk)

### Claude's Discretion
- Exact MCP tool parameter schemas
- How to structure the dept head approval prompt
- Error handling for failed installs or rejected approvals

</decisions>

<specifics>
## Specific Ideas

- Agent log should show bounded region with thick horizontal line when dept head agent runs
- The dept head approval `query()` call should use the dept head's soul.md for personality
- After approval, tool is installed to dept directory AND hot-loaded into the current session
- Skills downloaded via `npx skills search` / `npx skills install` pattern

</specifics>

<canonical_refs>
## Canonical References

- Agent SDK `query.setMcpServers()` — dynamic MCP server reload mid-session
- Agent SDK `query.mcpServerStatus()` — verify server connected after reload
- `src/lib/invoke-agent.ts` — query object creation and streaming loop
- `src/lib/mcp/server.ts` — MCP server factory
- `src/lib/workspace.ts` — workspace/desk creation patterns
- `data/departments/{dept}/planning-desk/` — existing desk hierarchy pattern

</canonical_refs>
