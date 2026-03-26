---
phase: 02-agent-execution-layer
plan: 01
subsystem: agent-tools
tags: [mcp, a2a, access-control, fts5, proper-lockfile, claude-agent-sdk]

requires:
  - phase: 01-foundation-infrastructure
    provides: "Prisma schema, FTS5, state machine, workspace, id generator, db exports"
provides:
  - "A2A TypeScript interfaces (AgentCard, A2ATask, A2AMessage, TaskConfig, RoutingResult, AgentTurnResult)"
  - "ToolContext interface and createToolContext factory for per-invocation isolation"
  - "buildCanUseTool role-based access control (3-tier: Tamir, dept-head, temp)"
  - "6 MCP tools: read_memory, write_memory, read_knowledge, write_knowledge, search_knowledge, promote_to_deliverable"
  - "buildMyelinMcpServer factory for per-invocation isolated MCP servers"
affects: [02-02, 02-03, 02-04, 03-tamir-ui]

tech-stack:
  added: ["@anthropic-ai/claude-agent-sdk@0.2.84", "@modelcontextprotocol/sdk@1.28.0", "proper-lockfile@4.1.2", "marked@17.0.5"]
  patterns: ["per-invocation MCP server via createSdkMcpServer", "tool() helper with zod v4 schemas", "closure-bound ToolContext for tool isolation", "proper-lockfile for concurrent file writes"]

key-files:
  created:
    - src/a2a/types.ts
    - src/lib/mcp/tool-context.ts
    - src/lib/mcp/access-control.ts
    - src/lib/mcp/tools/memory.ts
    - src/lib/mcp/tools/knowledge.ts
    - src/lib/mcp/tools/deliverable.ts
    - src/lib/mcp/server.ts
  modified:
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "A2A types defined in-house (src/a2a/types.ts) instead of importing @a2a-js/sdk -- simpler, no extra dependency"
  - "Tamir allowed to use DEPT_HEAD_ONLY tools per TOOL-10 (file_to_vault is Tamir + dept heads)"
  - "Knowledge write_knowledge upserts documents table by filePath lookup for FTS5 re-indexing"

patterns-established:
  - "MCP tool pattern: tool(name, description, zodSchema, handler, extras) returning CallToolResult"
  - "ToolContext closure: all tools receive ctx via closure, not global state"
  - "Path traversal prevention: resolved path must startsWith allowed directory"
  - "Error returns use isError: true instead of throwing"

requirements-completed: [AGENT-05, TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06]

duration: 3min
completed: 2026-03-26
---

# Phase 02 Plan 01: MCP Tool Server Foundation Summary

**A2A type interfaces, per-invocation MCP server factory with 6 core tools (memory, knowledge, search, deliverable), and 3-tier role-based access control using Claude Agent SDK**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T08:24:40Z
- **Completed:** 2026-03-26T08:28:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- A2A TypeScript interfaces covering all protocol types: AgentCard, A2ATask, A2AMessage, TaskConfig, TaskHandoff, RoutingResult, AgentTurnResult
- 6 MCP tools implemented with proper-lockfile protection, FTS5 indexing, and path traversal prevention
- Role-based access control with 3-tier permissions: Tamir-only, dept-head+Tamir, temp employee whitelist
- Per-invocation MCP server factory using createSdkMcpServer for complete isolation between agent invocations

## Task Commits

Each task was committed atomically:

1. **Task 1: A2A types, ToolContext, and access control** - `87c0229` (feat)
2. **Task 2: Core MCP tools and server factory** - `4a27cf2` (feat)

## Files Created/Modified

- `src/a2a/types.ts` - A2A protocol interfaces (AgentCard, A2ATask, A2AMessage, TaskConfig, TaskHandoff, RoutingResult, AgentTurnResult)
- `src/lib/mcp/tool-context.ts` - ToolContext interface and createToolContext factory
- `src/lib/mcp/access-control.ts` - buildCanUseTool role-based access control factory
- `src/lib/mcp/tools/memory.ts` - read_memory and write_memory MCP tools
- `src/lib/mcp/tools/knowledge.ts` - read_knowledge, write_knowledge, search_knowledge MCP tools
- `src/lib/mcp/tools/deliverable.ts` - promote_to_deliverable MCP tool
- `src/lib/mcp/server.ts` - buildMyelinMcpServer factory combining all tools
- `package.json` - Added SDK dependencies
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made

- A2A types defined in-house instead of importing @a2a-js/sdk -- the types are simple interfaces and adding a dependency for just types adds unnecessary weight
- Tamir allowed to use DEPT_HEAD_ONLY tools (file_to_vault, approve_deliverable, etc.) per TOOL-10 requirement
- Knowledge write_knowledge upserts documents table by filePath lookup to avoid duplicate FTS5 entries on re-writes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in src/agents/*/agent.ts (role type narrowing from card.json import) -- out of scope for this plan, does not affect new files.
- pnpm not in PATH directly -- used npx pnpm as workaround.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MCP server factory ready for Plan 02 (invokeAgent wrapper) to wire into query() calls
- Plan 04 will extend the server with additional tools (review, vault, skills, inbox, hire)
- Access control ready for all agent roles

---
*Phase: 02-agent-execution-layer*
*Completed: 2026-03-26*

## Self-Check: PASSED
