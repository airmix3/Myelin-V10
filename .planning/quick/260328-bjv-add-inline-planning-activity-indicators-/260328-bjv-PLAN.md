---
phase: quick
plan: 260328-bjv
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ChatPanel.tsx
  - src/app/tamir/page.tsx
  - src/app/deliverables/[id]/page.tsx
autonomous: true
requirements: [inline-activity-indicators, fix-hardcoded-port]
must_haves:
  truths:
    - "During planning wait, user sees live tool activity (e.g. 'CTO is reading src/lib/worker.ts...')"
    - "Activity text updates with each new SSE event, showing only the latest activity"
    - "Activity indicator disappears when agent response arrives"
    - "Deliverable page loads chat history without hardcoded port"
  artifacts:
    - path: "src/components/ChatPanel.tsx"
      provides: "Loading indicator that shows optional activityText"
    - path: "src/app/tamir/page.tsx"
      provides: "SSE connection during loading, activityText state"
    - path: "src/app/deliverables/[id]/page.tsx"
      provides: "Relative URL for chat fetch"
  key_links:
    - from: "src/app/tamir/page.tsx"
      to: "/api/sse"
      via: "EventSource connection when isLoading && taskId"
      pattern: "new EventSource.*api/sse"
    - from: "src/app/tamir/page.tsx"
      to: "src/components/ChatPanel.tsx"
      via: "activityText prop"
      pattern: "activityText="
---

<objective>
Add live activity indicators to the Tamir planning chat so users see what the agent is doing during the 30-60s planning wait, and fix a hardcoded localhost:3000 URL.

Purpose: Planning waits are opaque -- user sees "Thinking..." for up to a minute with no feedback. SSE events are already emitted during planning (task:buildlog with tool_call, tool_activity, tool_summary). We just need to connect them to the UI.

Output: Enhanced ChatPanel loading indicator with live activity text, SSE listener in Tamir page, fixed port in deliverable page.
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/ChatPanel.tsx
@src/app/tamir/page.tsx
@src/app/deliverables/[id]/page.tsx
@src/lib/events.ts
@src/app/api/sse/route.ts

<interfaces>
<!-- SSE event envelope (from src/lib/events.ts): -->
<!-- EventSource receives named events where event name = type, data = JSON -->
<!-- For task:buildlog, the SSE event name is "task:buildlog" and data is: -->

From src/lib/invoke-agent.ts (emitted during planning):
```typescript
// tool_call event
{ taskId: string, event: { type: 'tool_call', agentId: string, tool_name: string, tool_use_id: string, timestamp: string } }

// tool_activity event (progress)
{ taskId: string, event: { type: 'tool_activity', agentId: string, tool_name: string, elapsed_time_seconds: number, tool_use_id: string, timestamp: string } }

// tool_summary event
{ taskId: string, event: { type: 'tool_summary', agentId: string, summary: string, timestamp: string } }
```

From src/components/ChatPanel.tsx:
```typescript
interface ChatPanelProps {
  messages: ChatMessage[];
  routingButtons: RoutingButton[] | null;
  onSend: (message: string) => void;
  onRouteSelect: (agentId: string) => void;
  isLoading: boolean;
  placeholder?: string;
}
```

From src/app/api/sse/route.ts:
```typescript
// SSE sends: event: {type}\ndata: {JSON}\n\n
// Client listens via: eventSource.addEventListener('task:buildlog', handler)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add activityText prop to ChatPanel and enhance loading indicator</name>
  <files>src/components/ChatPanel.tsx</files>
  <action>
Add an optional `activityText?: string` prop to ChatPanelProps.

In the loading indicator section (around line 147), replace the static "Thinking..." text with dynamic content:
- If `activityText` is provided and non-empty, show it instead of "Thinking..."
- Keep the same `.msg.agent` wrapper with avatar "..." and `.bubble` styling
- Add a subtle CSS animation: the bubble text should have `opacity: 0.6` (already there) and add a trailing ellipsis animation or just show the text as-is (the text itself is descriptive enough)
- Example rendered text: "CTO is reading src/lib/worker.ts..." or "Thinking..." as fallback

This is a minimal change -- just add the prop and use it in the existing loading indicator JSX.
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit src/components/ChatPanel.tsx 2>&1 | head -20</automated>
  </verify>
  <done>ChatPanel accepts optional activityText prop and displays it in the loading bubble when provided, falls back to "Thinking..." when not provided</done>
</task>

<task type="auto">
  <name>Task 2: Connect SSE to Tamir page and pipe activity to ChatPanel</name>
  <files>src/app/tamir/page.tsx</files>
  <action>
Add SSE-driven activity text to the Tamir planning page:

1. Add state: `const [activityText, setActivityText] = useState<string | null>(null);`

2. Add a useEffect that opens an EventSource connection to `/api/sse` ONLY when `isLoading && taskId`:
   ```
   useEffect(() => {
     if (!isLoading || !taskId) {
       setActivityText(null);
       return;
     }
     const es = new EventSource('/api/sse');
     es.addEventListener('task:buildlog', (e) => {
       const payload = JSON.parse(e.data);
       if (payload.taskId !== taskId) return;
       const evt = payload.event;
       if (evt.type === 'tool_call') {
         const label = formatToolName(evt.tool_name);
         setActivityText(`${evt.agentId.toUpperCase()} is ${label}...`);
       } else if (evt.type === 'tool_activity') {
         const label = formatToolName(evt.tool_name);
         setActivityText(`${evt.agentId.toUpperCase()} is ${label}... (${Math.round(evt.elapsed_time_seconds)}s)`);
       } else if (evt.type === 'tool_summary') {
         setActivityText(evt.summary);
       }
     });
     return () => es.close();
   }, [isLoading, taskId]);
   ```

3. Add a helper function `formatToolName` at the top of the component (or inside it) that converts SDK tool names to human-readable labels:
   - `Read` -> "reading a file"
   - `Write` -> "writing a file"
   - `Edit` -> "editing a file"
   - `Bash` -> "running a command"
   - `Grep` -> "searching code"
   - `Glob` -> "finding files"
   - `WebFetch` -> "fetching a webpage"
   - Default: tool_name lowercased (e.g. "using list_tools")

4. Pass `activityText={activityText ?? undefined}` to both ChatPanel instances (the full-width one and the split-pane one).

5. Clear activityText when isLoading becomes false (already handled by the useEffect cleanup since it checks `isLoading`).

Key details:
- EventSource reconnects automatically on disconnect -- that is fine for this use case
- Only filter events where `payload.taskId === taskId` to avoid cross-task noise
- The SSE connection is lightweight -- close it as soon as loading ends
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit src/app/tamir/page.tsx 2>&1 | head -20</automated>
  </verify>
  <done>During planning waits, the Tamir chat shows live activity like "CTO is reading a file..." that updates with each new tool call and disappears when the response arrives</done>
</task>

<task type="auto">
  <name>Task 3: Fix hardcoded localhost:3000 in deliverable page</name>
  <files>src/app/deliverables/[id]/page.tsx</files>
  <action>
On line 21, replace:
```typescript
const chatRes = await fetch(`http://localhost:3000/api/tasks/${deliverable.taskId}/chat`, { cache: 'no-store' });
```

With a relative URL using the headers() API to build an absolute URL (required for server-side fetch in Next.js server components):
```typescript
import { headers } from 'next/headers';
// ... inside the function:
const headersList = headers();
const host = headersList.get('host') || 'localhost:3000';
const protocol = headersList.get('x-forwarded-proto') || 'http';
const chatRes = await fetch(`${protocol}://${host}/api/tasks/${deliverable.taskId}/chat`, { cache: 'no-store' });
```

This way the URL dynamically matches whatever port the server runs on (3011, 3000, or any other).
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit src/app/deliverables/[id]/page.tsx 2>&1 | head -20</automated>
  </verify>
  <done>Deliverable page fetches chat history using the actual server host/port instead of hardcoded localhost:3000</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors for all three modified files
2. Start dev server on port 3011, navigate to /tamir, send a message -- during agent thinking, the loading bubble should show live tool activity instead of static "Thinking..."
3. Navigate to a deliverable page -- it should load without ECONNREFUSED errors regardless of which port the server runs on
</verification>

<success_criteria>
- Planning chat shows live activity indicators (tool names, elapsed time) during agent waits
- Activity text updates with each new SSE event (latest only, not accumulated)
- Activity clears automatically when agent response arrives
- Deliverable page works on any port (no hardcoded localhost:3000)
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/260328-bjv-add-inline-planning-activity-indicators-/260328-bjv-SUMMARY.md`
</output>
