---
phase: quick
plan: 260327-wry
subsystem: ui
tags: [sse, build-log, tool-activity, agent-sdk]

requires:
  - phase: 02-agent-execution
    provides: invoke-agent.ts SDK query loop with event emissions
  - phase: 03-cortex-ui
    provides: BuildLogPanel, WorkspaceClient, cortex.css design system
provides:
  - Live tool activity feed in Build Log (tool_call, tool_activity, tool_summary events)
  - Structured tool event emissions from invoke-agent.ts
affects: [workspace-ui, agent-execution]

tech-stack:
  added: []
  patterns:
    - "Structured tool event emission: extract SDK message fields into typed buildlog events"
    - "Non-collapsible compact log entries for tool activity (no expand/collapse toggle)"

key-files:
  created: []
  modified:
    - src/lib/invoke-agent.ts
    - src/components/BuildLogPanel.tsx
    - src/app/deliverables/[id]/WorkspaceClient.tsx
    - public/cortex.css

key-decisions:
  - "Three distinct event types (tool_call, tool_activity, tool_summary) instead of overloading existing assistant/tool_progress types"
  - "Amber border-left for in-progress tools, green border-left for completed summaries"

patterns-established:
  - "Tool activity rendering: compact non-collapsible entries with monospace tool name and elapsed time"

requirements-completed: []

duration: 2min
completed: 2026-03-27
---

# Quick Task 260327-wry: Live Agent Activity Feed Summary

**Live tool call visibility in Build Log -- tool names in amber monospace, elapsed time, and completion summaries in green DONE badges**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-27T20:39:02Z
- **Completed:** 2026-03-27T20:40:48Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- invoke-agent.ts emits three new structured event types (tool_call, tool_activity, tool_summary) to the buildlog SSE channel
- BuildLogPanel renders tool calls with amber-badged TOOL entries showing tool names in monospace
- Tool progress updates display elapsed time in seconds
- Completion summaries appear as green-badged DONE entries with human-readable descriptions

## Task Commits

Each task was committed atomically:

1. **Task 1: Emit structured tool activity events from invoke-agent.ts** - `c69ccd2` (feat)
2. **Task 2: Render tool activity in BuildLogPanel with new CSS styles** - `a168c09` (feat)

## Files Created/Modified
- `src/lib/invoke-agent.ts` - Added SDKToolProgressMessage import; emit tool_call from assistant tool_use blocks, tool_activity from tool_progress, tool_summary from tool_use_summary
- `src/components/BuildLogPanel.tsx` - Extended BuildLogEntry interface; added tool_call/tool_activity/tool_summary renderers with badges
- `src/app/deliverables/[id]/WorkspaceClient.tsx` - Extended BuildLogEntry interface to pass through new fields
- `public/cortex.css` - Added .log-entry-tool, .log-entry-summary, .tool-name, .log-type-tool styles

## Decisions Made
- Three distinct event types rather than overloading existing types -- keeps existing assistant/stream_event/tool_progress entries unchanged
- Amber (--amber CSS var) for tool activity, green (--green CSS var) for completion summaries -- matches existing cortex.css color language

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

---
*Plan: quick/260327-wry*
*Completed: 2026-03-27*
