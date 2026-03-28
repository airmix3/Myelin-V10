---
phase: quick
plan: 260328-bjv
subsystem: ui
tags: [sse, activity-indicators, chat, planning-ux]

requires:
  - phase: 03-ui-tamir-chat
    provides: ChatPanel component, Tamir page, SSE infrastructure
provides:
  - Live activity indicators in Tamir planning chat
  - Dynamic host resolution for deliverable page chat fetch
affects: [tamir-page, deliverable-page, chat-panel]

tech-stack:
  added: []
  patterns: [SSE activity listener in page component, forwarding activity via prop]

key-files:
  created: []
  modified:
    - src/components/ChatPanel.tsx
    - src/app/tamir/page.tsx
    - src/app/deliverables/[id]/page.tsx

key-decisions:
  - "formatToolName maps SDK tool names to human-readable labels inline in page component"
  - "SSE EventSource opened only when isLoading && taskId to minimize connections"

patterns-established:
  - "Activity text prop pattern: parent listens to SSE, passes text to ChatPanel via activityText prop"

requirements-completed: [inline-activity-indicators, fix-hardcoded-port]

duration: 1min
completed: 2026-03-28
---

# Quick Plan 260328-bjv: Add Inline Planning Activity Indicators Summary

**Live SSE-driven tool activity indicators in Tamir planning chat and dynamic host fix for deliverable page**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-28T05:21:43Z
- **Completed:** 2026-03-28T05:23:09Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Planning chat now shows live activity text ("CTO is reading a file...", "CTO is running a command... (12s)") instead of static "Thinking..."
- Activity updates with each SSE event and clears automatically when agent responds
- Deliverable page chat fetch uses dynamic host/protocol instead of hardcoded localhost:3000

## Task Commits

Each task was committed atomically:

1. **Task 1: Add activityText prop to ChatPanel** - `6e71725` (feat)
2. **Task 2: Connect SSE to Tamir page** - `d3a99c7` (feat)
3. **Task 3: Fix hardcoded localhost:3000** - `11a10c6` (fix)

## Files Created/Modified
- `src/components/ChatPanel.tsx` - Added optional activityText prop, displayed in loading bubble
- `src/app/tamir/page.tsx` - Added formatToolName helper, SSE useEffect listener, activityText state
- `src/app/deliverables/[id]/page.tsx` - Replaced hardcoded URL with headers()-based dynamic host

## Decisions Made
- formatToolName placed as module-level function in tamir/page.tsx (simple enough to not need a separate util)
- SSE EventSource connection lifecycle tied to isLoading + taskId to avoid unnecessary open connections

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Known Stubs
None

## User Setup Required
None - no external service configuration required.

---
*Plan: quick/260328-bjv*
*Completed: 2026-03-28*
