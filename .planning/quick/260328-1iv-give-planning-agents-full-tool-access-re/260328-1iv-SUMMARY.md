---
type: quick
description: "Give planning agents full tool access by removing tools:[] restriction"
completed: 2026-03-28T00:08:59Z
duration: 2min
tasks_completed: 2
tasks_total: 2
files_modified:
  - src/app/api/tamir/route/route.ts
  - src/app/api/tasks/[taskId]/message/route.ts
  - src/lib/workspace.ts
key-decisions:
  - "Removed tools:[] to let SDK default to claude_code preset with full built-in tools"
  - "Planning desk CLAUDE.md now documents sandboxed built-in tool access"
---

# Quick Task 260328-1iv: Give Planning Agents Full Tool Access Summary

**One-liner:** Remove tools:[] restriction from planning invocations so agents can use built-in tools (Read, Grep, Glob, etc.) within their sandboxed planning desk during planning sessions.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Remove tools:[] from planning invocations | d717d9f | Removed `tools: []` from tamir/route and taskId/message routes |
| 2 | Update planning desk CLAUDE.md template | 72073cf | Replaced "disabled" section with "Built-in Tools" sandboxed access section |

## What Changed

### Task 1: Remove tools:[] from planning invocations
- Removed `tools: [],` line from `src/app/api/tamir/route/route.ts` (Tamir routing endpoint)
- Removed `tools: [],` line from `src/app/api/tasks/[taskId]/message/route.ts` (planning message endpoint)
- Omitting the `tools` property lets the SDK use its default claude_code preset which includes all built-in tools
- Phase 06 filesystem sandboxing (canUseTool callback) restricts file operations to the agent's desk directory

### Task 2: Update planning desk CLAUDE.md template
- Removed the "What You Cannot Do in Planning Mode" section that stated built-in tools were DISABLED
- Added a "Built-in Tools" section explaining that agents have full sandboxed access to Read, Write, Bash, Edit, Glob, Grep, WebSearch
- Updated first planning guideline to reference built-in tools for codebase research
- Preserved all MCP tool documentation and planning guidelines

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `grep -rn "tools: \[\]" src/app/api/` -- no matches (PASS)
- `grep "DISABLED" src/lib/workspace.ts` -- no matches (PASS)
- Build has pre-existing type error in `scripts/validate-concurrent-isolation.ts` (unrelated to changes)

## Known Stubs

None.

## Self-Check: PASSED
