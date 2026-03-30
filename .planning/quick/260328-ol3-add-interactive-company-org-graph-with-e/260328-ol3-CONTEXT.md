# Quick Task 260328-ol3: Interactive Company Org Graph with Session Takeover - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Task Boundary

Add an interactive graph visualization of the company org on a dynamic movable grid where each employee/executive is a vertex. Clicking an employee shows an overlay with their working assignments and streams running logs. Each assignment has a "Take His Role" button that pauses the SDK agent session and opens a web-based Claude Code terminal (xterm.js) where the CEO can take over interactively. On exit, control returns to the SDK agent.

</domain>

<decisions>
## Implementation Decisions

### Graph Layout & Interaction
- Force-directed graph with physics simulation
- Edges represent reporting lines (CEO→Tamir→CTO/CMO/COO→temp employees)
- Nodes are draggable with spring-back physics
- Zoom and pan support on the canvas

### Session Takeover Mechanism
- Graceful pause: use AbortController to stop the SDK query() loop cleanly
- Persist sessionId from the running agent
- Spawn `claude --dangerously-skip-permissions --resume <sessionId>` in a node-pty PTY on the task's working directory
- On CEO exit: kill PTY process, re-invoke query() with same sessionId to resume where human left off
- Flow: CEO clicks → abort SDK → spawn PTY → xterm.js connects → CEO works → exits → SDK resumes

### Web-based Claude Code UI
- xterm.js frontend terminal emulator connected to node-pty backend via WebSocket
- Full interactive terminal: colors, cursor movement, resize support, keyboard input
- Rendered in a large overlay/modal when "Take His Role" is clicked
- "Exit Role" button to gracefully disconnect and return control to SDK

### Claude's Discretion
- Graph library choice (d3-force, vis.js, or similar)
- WebSocket implementation details for PTY streaming
- Overlay/modal styling and transitions
- Log streaming format and buffering strategy

</decisions>

<specifics>
## Specific Ideas

- Each node should show agent status (idle/working/paused) with visual indicator
- Assignment overlay should show both deliverable-producing tasks and non-deliverable tasks
- Live log streaming should use the existing SSE eventBus infrastructure where possible
- The PTY WebSocket endpoint should be a new API route (e.g., /api/terminal/[sessionId])
- node-pty is a native addon — needs to be in serverExternalPackages

</specifics>

<canonical_refs>
## Canonical References

- `src/lib/invoke-agent.ts` — Current SDK query() wrapper with sessionId handling
- `src/lib/events.ts` — SSE eventBus for real-time updates
- `src/lib/worker.ts` — Background worker that runs agent task_runs
- Claude Agent SDK docs — query() abort/resume semantics

</canonical_refs>
