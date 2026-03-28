---
phase: quick-260328-tvl
plan: 01
subsystem: ui
tags: [org-graph, hierarchical-layout, activity-log, sse, css]

provides:
  - Hierarchical div-based org graph with top-down tree layout
  - Historical activity_log entries loaded on node selection
  - Take His Role button for all working tasks
affects: [org-graph, cortex-ui]

tech-stack:
  added: []
  patterns:
    - BFS level assignment for tree hierarchy from edges
    - useLayoutEffect + getBoundingClientRect for SVG connector line positioning
    - Historical log pre-population from API response before SSE append

key-files:
  created: []
  modified:
    - src/app/api/org-graph/route.ts
    - src/app/org-graph/OrgGraphClient.tsx
    - public/cortex.css

key-decisions:
  - "SSE listens on task:activity named event (matching eventBus envelope format) instead of per-task channel"
  - "Connector lines drawn via SVG overlay with useLayoutEffect measurements"
  - "Take His Role button shown for all working tasks, disabled when runId is null"

requirements-completed: []

duration: 2min
completed: 2026-03-28
---

# Quick 260328-tvl: Org Graph Hierarchical Layout + Activity Log Summary

**Replaced force-directed canvas org graph with hierarchical div-based tree layout, historical activity log on node selection, and always-visible Take His Role button**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T18:34:09Z
- **Completed:** 2026-03-28T18:36:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Org graph now renders as a clear top-down tree: CEO -> Tamir -> dept heads -> employees
- Selecting a node immediately shows historical activity_log entries (no more "Waiting for activity...")
- Take His Role button visible for all working tasks (disabled when runId is null, clickable when available)
- SSE live events continue to append on top of historical entries in real time

## Task Commits

1. **Task 1: Add recentActivity to org-graph API** - `02100a0` (feat)
2. **Task 2: Replace canvas org graph with hierarchical div tree + historical log** - `953fe96` (feat)

## Files Created/Modified
- `src/app/api/org-graph/route.ts` - Added recentActivity query per active task with SDK_ASSISTANT noise filtering
- `src/app/org-graph/OrgGraphClient.tsx` - Complete rewrite: div-based tree with BFS levels, SVG connectors, historical log, Take His Role for all working tasks
- `public/cortex.css` - Replaced canvas styles with tree layout classes (org-tree, org-node-card, org-tree-level, org-tree-connectors)

## Decisions Made
- SSE uses `task:activity` named event listener (matching the eventBus envelope type) rather than per-task channels
- SVG connector lines drawn via `useLayoutEffect` measuring card positions after render, with 50ms delay for DOM stability
- Historical activity loaded from API response data (no additional fetch needed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SSE channel listening approach**
- **Found during:** Task 2
- **Issue:** Plan suggested `EventSource(/api/sse?channel=task:${taskId})` but SSE route has no channel filtering -- it broadcasts all events. The eventBus wraps events in `{type, data}` envelope and SSE sends them as named events.
- **Fix:** Listen on single `/api/sse` connection with `addEventListener('task:activity', ...)` to match the eventBus envelope type. Filter by taskId in the handler.
- **Files modified:** src/app/org-graph/OrgGraphClient.tsx
- **Committed in:** 953fe96

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** SSE approach corrected to match actual server event format. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in unrelated files (ApprovalCard.tsx, BuildLogPanel.tsx, WorkspaceChatPanel.tsx) -- not caused by this plan, not fixed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Org graph is now functional with clear hierarchy and live activity display
- Future improvement: zoom/pan controls for large org charts with many temp employees

---
*Quick: 260328-tvl*
*Completed: 2026-03-28*
