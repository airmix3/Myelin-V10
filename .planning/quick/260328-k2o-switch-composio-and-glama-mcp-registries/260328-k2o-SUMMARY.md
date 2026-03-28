---
phase: quick-260328-k2o
plan: 01
subsystem: api
tags: [smithery, mcp, registry, gallery]

requires: []
provides:
  - Smithery registry integration for MCP tool search and installation
affects: [gallery, tools, mcp]

tech-stack:
  added: [smithery-registry-api, smithery-cli]
  patterns: [smithery-hosted-mcp-servers]

key-files:
  created: []
  modified:
    - src/app/api/search/tools/route.ts
    - src/components/GalleryPanel.tsx
    - src/lib/mcp/tools/install.ts

key-decisions:
  - "Smithery REST API replaces both Glama and Composio as single external MCP registry"
  - "Hot-reload uses Smithery hosted server URL (server.smithery.ai) instead of local npx stdio"

patterns-established:
  - "Smithery qualified names as MCP server identifiers"

requirements-completed: [QUICK-k2o]

duration: 2min
completed: 2026-03-28
---

# Quick Task 260328-k2o: Switch Composio and Glama MCP Registries Summary

**Replaced Glama+Composio with Smithery.ai as single external MCP registry for tool search and installation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T11:30:14Z
- **Completed:** 2026-03-28T11:31:54Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Search API now fetches from registry.smithery.ai (public, no API key needed)
- Gallery source toggles show "company" and "smithery" instead of "company", "glama", "composio"
- install_tool uses Smithery CLI (npx @smithery/cli mcp add) for MCP server installation
- Hot-reload uses Smithery hosted server URL pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace Glama+Composio with Smithery in search API and gallery UI** - `2facae4` (feat)
2. **Task 2: Switch install_tool to use Smithery CLI for MCP server installation** - `f0f5b08` (feat)

## Files Created/Modified
- `src/app/api/search/tools/route.ts` - Smithery registry search replacing Glama+Composio blocks
- `src/components/GalleryPanel.tsx` - Updated TOOL_SOURCES to ['company', 'smithery']
- `src/lib/mcp/tools/install.ts` - Smithery CLI installation and hosted server URL for hot-reload

## Decisions Made
- Smithery REST API replaces both Glama (unknown API shape) and Composio (required API key) as single external registry
- Hot-reload uses Smithery hosted server URL (server.smithery.ai/{name}) instead of local npx stdio

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - Smithery registry is public, no API key needed.

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: quick-260328-k2o*
*Completed: 2026-03-28*
