---
phase: quick-260328-tvl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/org-graph/OrgGraphClient.tsx
  - src/app/api/org-graph/route.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "Org graph renders as a hierarchical top-down tree: CEO → Tamir → dept heads → employees"
    - "Node cards show name, role, and department as styled rectangles, not canvas circles"
    - "Selecting a node loads recent historical activity_log entries immediately (not 'Waiting for activity...')"
    - "SSE live events append on top of historical entries in real time"
    - "Take His Role button is visible for any task in 'working' state (disabled when runId is null)"
  artifacts:
    - path: "src/app/org-graph/OrgGraphClient.tsx"
      provides: "Hierarchical div-based org graph with historical activity log"
    - path: "src/app/api/org-graph/route.ts"
      provides: "Org graph API returning nodes, edges, and recent activity per task"
  key_links:
    - from: "OrgGraphClient.tsx"
      to: "/api/org-graph"
      via: "fetch on mount"
      pattern: "fetch.*api/org-graph"
    - from: "OrgGraphClient.tsx"
      to: "/api/sse"
      via: "EventSource on selectedNode change"
      pattern: "EventSource.*sse.*task:"
---

<objective>
Fix the org graph page with three improvements: replace force-directed canvas with a hierarchical HTML/div tree layout, load historical activity_log entries on node selection instead of waiting only for SSE, and always show the Take His Role button for working tasks (even when runId is null).

Purpose: The org graph is the mission control view — it should show the company hierarchy clearly, show what agents are actually doing (not just "Waiting for activity..."), and allow CEO takeover of working tasks.
Output: Updated OrgGraphClient.tsx (div-based hierarchical layout + historical log load) and updated /api/org-graph route (returns recentActivity per task).
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add recentActivity to org-graph API</name>
  <files>src/app/api/org-graph/route.ts</files>
  <action>
Extend the GET handler to return recent activity_log entries per active task.

Changes:
1. After fetching activeTasks for an employee, for each task that is in 'working' or 'input-required' state, query the last 20 activity_log entries:
   ```sql
   SELECT id, actionType, description, createdAt
   FROM activity_log
   WHERE taskId = ?
   ORDER BY createdAt DESC
   LIMIT 20
   ```
   Reverse the result to chronological order before attaching.

2. Filter entries using the same logic as deliverables page: skip entries where actionType = 'SDK_ASSISTANT' AND description is null or equals 'Assistant message'.

3. Attach as `recentActivity: ActivityLogRow[]` to each activeTask object. Shape:
   ```ts
   interface ActivityLogRow {
     id: string;
     actionType: string;
     description: string | null;
     createdAt: string;
   }
   ```

4. Update the OrgNode type interfaces in this file to include `recentActivity` on the active task entries.

Do not change the edge-building or employee-fetching logic.
  </action>
  <verify>
    <automated>curl -s http://localhost:3011/api/org-graph | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); const n=j.nodes.find(n=>n.activeTasks?.length>0); console.log(n ? JSON.stringify(n.activeTasks[0]).slice(0,200) : 'no active tasks (ok)')"</automated>
  </verify>
  <done>API response includes recentActivity array on each activeTask. Entries filtered to exclude generic SDK_ASSISTANT noise. Returns empty array if no activity yet.</done>
</task>

<task type="auto">
  <name>Task 2: Replace canvas org graph with hierarchical div tree + historical log</name>
  <files>src/app/org-graph/OrgGraphClient.tsx</files>
  <action>
Rewrite OrgGraphClient.tsx. Remove all canvas/simulation code. Implement a div-based hierarchical tree layout.

## Layout algorithm

Assign a `level` to each node from the edges:
- CEO node: level 0
- Nodes that are targets of CEO edges: level 1 (Tamir)
- Nodes that are targets of level-1 edges: level 2 (dept heads)
- All others: level 3 (employees)

Group nodes by level. Within each level, space nodes horizontally with equal gaps.

## Visual design

Use divs, not canvas. Style with inline styles (no Tailwind, no CSS frameworks — custom CSS vars only).

Node card (for each node):
```
width: 140px, min-height: 64px
background: var(--surface-2, #1a1a2e)
border: 1px solid var(--border, #2a2a4a)
border-radius: 8px
padding: 10px 12px
position: relative (for status dot)
cursor: pointer
```

Card content:
- Top row: colored dot (dept color from DEPT_COLORS) + name in bold 13px
- Second row: role in 10px var(--text-dim)
- Third row (if activeTasks.length > 0): small badge "N active" in amber

Selected card: border-color changes to var(--accent, #6496ff), box-shadow: 0 0 0 2px var(--accent).

Status dot (top-right corner): 8px circle, green (#00d68f) if any activeTask.state === 'working', else transparent.

## Tree container

Render level rows top-to-bottom with 80px vertical gap between levels. Within each level row, center nodes horizontally. The overall container should be scrollable (overflow: auto) with min-height 400px.

Draw connector lines between parent and child nodes using SVG overlaid absolutely over the container. Use a `useRef` + `useLayoutEffect` to measure card positions after render, then draw SVG lines from parent card bottom-center to child card top-center. Lines: stroke='#2a2a4a', strokeWidth=1.5.

Wrap the tree + SVG in a `position: relative` div so the SVG can be `position: absolute, top:0, left:0, width:100%, height:100%, pointerEvents:none`.

## Interaction

Click a card → setSelectedNode (toggle: click same = deselect). No drag needed (static tree). Keep pan/zoom via mouse wheel on the outer container using CSS `transform: scale()` on a wrapper div (simpler than canvas camera).

## Activity log panel (right side overlay — keep same structure as before)

Keep the existing `org-overlay-panel` div structure. Changes:

1. **Historical load**: When selectedNode changes, if it has activeTasks, fetch historical entries from the data already included in the API response (passed as prop via the node data). Pre-populate `logEntries` state with `recentActivity` entries from each task:
   ```ts
   useEffect(() => {
     if (!selectedNode) return;
     const initial: Record<string, string[]> = {};
     for (const task of selectedNode.activeTasks) {
       if (task.recentActivity && task.recentActivity.length > 0) {
         initial[task.taskId] = task.recentActivity.map(a => a.description || a.actionType);
       }
     }
     setLogEntries(initial);
   }, [selectedNode]);
   ```

2. **SSE live updates**: Keep the existing SSE EventSource logic. It should append NEW entries to the existing `logEntries` state (after the historical ones are loaded above). The SSE effect depends on `selectedNode` — put the historical load effect BEFORE the SSE effect so initial state is set first.

3. **Take His Role button**: Show for ANY task where `task.state === 'working'` — do NOT require `task.runId && task.sessionId`. When runId is null, show the button as disabled (`disabled={!task.runId}`, `title="Agent not yet running"`). When runId exists, clicking opens TerminalOverlay as before.

## ActiveTask type update

Add `recentActivity` to the ActiveTask interface:
```ts
interface ActiveTask {
  taskId: string;
  title: string;
  state: string;
  runId: string | null;
  sessionId: string | null;
  workspaceCwd: string | null;
  recentActivity: Array<{ id: string; actionType: string; description: string | null; createdAt: string }>;
}
```

## Remove

Remove: SimNode interface, all canvas refs (canvasRef, nodesRef, simRef), all force simulation useEffect, all canvas rendering useEffect, drag state (dragRef), handleMouseDown/Move/Up, handleWheel, hitTest, screenToWorld, DEPT_COLORS constant (move inline or keep), all canvas-specific state (nodes as SimNode[] → nodes as OrgNode[] or just derive positions).

Keep: OrgNode, OrgEdge interfaces, fetchData, selectedNode state, logEntries state, activeTerminal state, handleTakeRole, handleTerminalClose, TerminalOverlay import.
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && node_modules/.bin/tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>TypeScript compiles clean. Org graph renders as a top-down tree with card nodes. Selecting a node immediately shows historical activity entries. Take His Role button visible for working tasks (disabled when runId is null). SSE events still append live.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors: `node_modules/.bin/tsc --noEmit`
2. Visit http://localhost:3011/org-graph — tree renders top-down (CEO at top, Tamir below, dept heads below that, employees at bottom)
3. Cards show name + role + dept badge
4. Click a node with active tasks — panel opens immediately with historical log entries (not "Waiting for activity...")
5. A working task shows "Take His Role" button. If runId is null, button exists but is disabled
6. SSE events continue to append during live execution
</verification>

<success_criteria>
- Hierarchical tree layout renders correctly with connectors between levels
- Historical activity_log entries appear immediately on node click
- Take His Role button visible for all 'working' tasks
- TypeScript compiles clean
- No canvas or force-simulation code remains
</success_criteria>

<output>
After completion, create `.planning/quick/260328-tvl-fix-org-graph-hierarchical-layout-activi/260328-tvl-SUMMARY.md`
</output>
