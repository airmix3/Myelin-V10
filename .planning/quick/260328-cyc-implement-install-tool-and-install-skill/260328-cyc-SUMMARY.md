---
phase: quick-260328-cyc
plan: 01
subsystem: mcp-tools
tags: [mcp, install, hot-reload, agent-switch, setMcpServers, skills.sh]

requires:
  - phase: 02-agent-execution
    provides: "invoke-agent query loop, MCP server factory, access control"
provides:
  - "install_tool and install_skill MCP tools with dept head approval flow"
  - "Query registry for SDK query ref access (hot-reload via setMcpServers)"
  - "Manager desk infrastructure per department"
  - "Agent log bounded regions for agent switch visualization"
affects: [agent-execution, ui, mcp-tools]

tech-stack:
  added: []
  patterns:
    - "Query registry pattern: Map<runId, queryRef> for cross-module query access"
    - "Agent switch boundaries: AGENT_SWITCH_START/END activity log pairs for UI rendering"
    - "Manager desk pattern: parallel to planning-desk for dept head approval calls"

key-files:
  created:
    - src/lib/mcp/query-registry.ts
    - src/lib/mcp/tools/install.ts
  modified:
    - src/lib/mcp/tool-context.ts
    - src/lib/invoke-agent.ts
    - src/lib/workspace.ts
    - src/instrumentation.ts
    - src/lib/mcp/server.ts
    - src/lib/mcp/access-control.ts
    - src/components/AgentLogPanel.tsx
    - scripts/validate-concurrent-isolation.ts

key-decisions:
  - "Query registry uses simple Map<runId, queryRef> with no event bus indirection"
  - "Dept head approval runs via invokeAgent() directly (not orchestrator.invoke) to avoid circular dependencies"
  - "install_tool/install_skill added to TEMP_ALLOWED access control list (approval is the gate, not role)"
  - "Skills use filesystem-based loading (no hot-reload needed), tools use setMcpServers hot-reload"

patterns-established:
  - "Agent switch boundaries: log AGENT_SWITCH_START/END with fromAgent/toAgent metadata for UI"
  - "Manager desk infrastructure: data/departments/{dept}/manager-desk/ with .claude/settings.json"

requirements-completed: []

duration: 3min
completed: 2026-03-28
---

# Quick Task 260328-cyc: Install Tool and Install Skill Summary

**install_tool and install_skill MCP tools with dept head approval flow, query registry for hot-reload, and agent log bounded regions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T06:40:29Z
- **Completed:** 2026-03-28T06:43:48Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Query registry module for storing SDK query refs keyed by runId, enabling hot-reload via setMcpServers
- install_tool and install_skill MCP tools with full dept head approval flow (separate query() call from manager desk)
- Agent log UI renders bounded regions with accent borders and separator lines during dept head agent switches
- Manager desk infrastructure and dept tool/skill directories created on startup

## Task Commits

Each task was committed atomically:

1. **Task 1: Query registry, ToolContext extension, manager desk setup** - `eceb2aa` (feat)
2. **Task 2: Implement install_tool and install_skill MCP tools** - `9ee298d` (feat)
3. **Task 3: Agent log UI bounded region for agent switches** - `5015eae` (feat)

## Files Created/Modified
- `src/lib/mcp/query-registry.ts` - Shared query ref registry (register/get/unregister by runId)
- `src/lib/mcp/tools/install.ts` - install_tool and install_skill MCP tool implementations
- `src/lib/mcp/tool-context.ts` - Added runId field to ToolContext interface
- `src/lib/invoke-agent.ts` - Register/unregister query refs around streaming loop
- `src/lib/workspace.ts` - ensureManagerDesks() for manager desk + dept tools/skills dirs
- `src/instrumentation.ts` - Call ensureManagerDesks on startup
- `src/lib/mcp/server.ts` - Added install tools to MCP server tool list
- `src/lib/mcp/access-control.ts` - Added install_tool/install_skill to TEMP_ALLOWED
- `src/components/AgentLogPanel.tsx` - Bounded region rendering for agent switches
- `scripts/validate-concurrent-isolation.ts` - Fixed to pass runId to createToolContext

## Decisions Made
- Query registry uses simple Map with no event bus -- direct lookup by runId is sufficient
- Dept head approval uses invokeAgent() directly rather than orchestrator.invoke to avoid circular module dependencies
- Both install tools added to TEMP_ALLOWED (any agent can request, dept head approval is the access gate)
- Skills don't need hot-reload (filesystem-based), only tools need setMcpServers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed validate script missing runId in createToolContext**
- **Found during:** Task 1 (ToolContext extension)
- **Issue:** scripts/validate-concurrent-isolation.ts called createToolContext without the new required runId field
- **Fix:** Added runId: 'run-test-cto' and runId: 'run-test-cmo' to both createToolContext calls
- **Files modified:** scripts/validate-concurrent-isolation.ts
- **Verification:** TypeScript compiles cleanly for all modified files
- **Committed in:** eceb2aa (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary because our ToolContext change broke the existing validation script. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Install tools ready for use by agents during execution
- Manager desks will be created automatically on next server start
- Agent log UI will render bounded regions when install approvals occur

---
*Quick Task: 260328-cyc*
*Completed: 2026-03-28*
