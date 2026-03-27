---
phase: quick
plan: 260327-wry
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/invoke-agent.ts
  - src/components/BuildLogPanel.tsx
  - public/cortex.css
autonomous: true
must_haves:
  truths:
    - "When an agent executes a task, the Build Log tab shows each tool call (tool name, elapsed time) as it happens in real-time"
    - "Tool use summary messages display a human-readable summary line after each tool completes"
    - "The live feed auto-scrolls and shows tool names with distinctive visual badges"
  artifacts:
    - path: "src/lib/invoke-agent.ts"
      provides: "Emits tool_progress and tool_use_summary as structured SSE events with tool name and timing"
    - path: "src/components/BuildLogPanel.tsx"
      provides: "Renders tool activity entries with tool name badges, elapsed time, and summaries"
    - path: "public/cortex.css"
      provides: "Tool activity badge styles"
  key_links:
    - from: "src/lib/invoke-agent.ts"
      to: "src/components/BuildLogPanel.tsx"
      via: "eventBus.emit('task:buildlog') -> SSE -> useSSE -> BuildLogPanel entries"
      pattern: "task:buildlog.*tool_name"
---

<objective>
Show live agent tool calls and actions in the Build Log panel during task execution -- like Claude Code's real-time activity feed but in the Cortex dashboard.

Purpose: The CEO can see exactly what an agent is doing (which tools it calls, how long each takes, summaries of completed actions) while a task is running, instead of just seeing generic "Assistant message" entries.

Output: Enhanced invoke-agent.ts emitting structured tool events, upgraded BuildLogPanel rendering tool activity with names and timing, new CSS styles for tool badges.
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/invoke-agent.ts
@src/lib/events.ts
@src/components/BuildLogPanel.tsx
@src/components/useSSE.ts
@src/app/deliverables/[id]/WorkspaceClient.tsx
@public/cortex.css

<interfaces>
<!-- Key types from the Claude Agent SDK that the executor needs -->

From @anthropic-ai/claude-agent-sdk (sdk.d.ts):
```typescript
// Already imported in invoke-agent.ts:
type SDKToolUseSummaryMessage = {
    type: 'tool_use_summary';
    summary: string;
    preceding_tool_use_ids: string[];
    uuid: UUID;
    session_id: string;
};

// Needs to be imported and used:
type SDKToolProgressMessage = {
    type: 'tool_progress';
    tool_use_id: string;
    tool_name: string;
    parent_tool_use_id: string | null;
    elapsed_time_seconds: number;
    task_id?: string;
    uuid: UUID;
    session_id: string;
};

// SDKAssistantMessage.message is BetaMessage which has content blocks.
// content blocks can be { type: 'tool_use', name: string, id: string, input: unknown }
```

From src/lib/events.ts:
```typescript
// eventBus.emit('task:buildlog', { taskId, event }) -- already used for assistant/stream/tool_progress
// Events flow: eventBus -> SSE /api/sse -> useSSE hook -> WorkspaceClient -> BuildLogPanel
```

From src/components/BuildLogPanel.tsx:
```typescript
interface BuildLogEntry {
  type?: string;
  agentId?: string;
  content?: unknown;
  message?: string;
  timestamp?: string;
  // Will add: tool_name, elapsed_time_seconds, summary
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Emit structured tool activity events from invoke-agent.ts</name>
  <files>src/lib/invoke-agent.ts</files>
  <action>
Enhance the SDK message handler loop (the `for await (const msg of q)` block) in `invokeAgent()` to emit richer tool activity events:

1. **Import `SDKToolProgressMessage`** from the SDK (add to existing import list at line 14).

2. **Enhance the existing `tool_progress` handler** (currently line 166-169). Instead of just forwarding the raw msg, emit a structured buildlog event with extracted fields:
```typescript
if (msg.type === 'tool_progress') {
  const toolMsg = msg as SDKToolProgressMessage;
  eventBus.emit('task:buildlog', {
    taskId: opts.taskId,
    event: {
      type: 'tool_activity',
      agentId: opts.agentId,
      tool_name: toolMsg.tool_name,
      elapsed_time_seconds: toolMsg.elapsed_time_seconds,
      tool_use_id: toolMsg.tool_use_id,
      timestamp: new Date().toISOString(),
    },
  });
}
```

3. **Enhance the existing `tool_use_summary` handler** (currently line 172-178). In addition to the activity_log DB insert, also emit a buildlog event so the UI can show summaries:
```typescript
if (msg.type === 'tool_use_summary') {
  const summaryMsg = msg as SDKToolUseSummaryMessage;
  // Existing DB insert stays
  sqlite.prepare(`...`).run(...);
  // NEW: also emit to buildlog for live UI
  eventBus.emit('task:buildlog', {
    taskId: opts.taskId,
    event: {
      type: 'tool_summary',
      agentId: opts.agentId,
      summary: summaryMsg.summary,
      timestamp: new Date().toISOString(),
    },
  });
}
```

4. **Extract tool_use blocks from assistant messages** (enhance the existing `assistant` handler at line 148-159). After the existing activity_log insert and buildlog emit, also extract tool_use content blocks from the BetaMessage and emit them individually:
```typescript
if (msg.type === 'assistant') {
  const assistantMsg = msg as SDKAssistantMessage;
  // Existing activity_log insert stays
  // Existing eventBus.emit stays

  // NEW: Extract tool_use blocks for richer activity feed
  const content = assistantMsg.message?.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'tool_use') {
        eventBus.emit('task:buildlog', {
          taskId: opts.taskId,
          event: {
            type: 'tool_call',
            agentId: opts.agentId,
            tool_name: block.name,
            tool_use_id: block.id,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  }
}
```

Do NOT remove any existing event emissions -- only add new ones alongside them.
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit src/lib/invoke-agent.ts 2>&1 | head -20</automated>
  </verify>
  <done>invoke-agent.ts emits three new event types to buildlog: tool_call (from assistant tool_use blocks), tool_activity (from tool_progress with name and elapsed time), and tool_summary (from tool_use_summary). All existing events unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Render tool activity in BuildLogPanel with new CSS styles</name>
  <files>src/components/BuildLogPanel.tsx, public/cortex.css</files>
  <action>
**BuildLogPanel.tsx changes:**

1. **Extend the BuildLogEntry interface** to include the new fields:
```typescript
interface BuildLogEntry {
  type?: string;
  agentId?: string;
  content?: unknown;
  message?: string;
  timestamp?: string;
  tool_name?: string;
  elapsed_time_seconds?: number;
  summary?: string;
  tool_use_id?: string;
}
```

2. **Add entries to ENTRY_TYPE_BADGES** for the new event types:
```typescript
'tool_call': { className: 'log-type-tool', label: 'TOOL' },
'tool_activity': { className: 'log-type-tool', label: 'TOOL' },
'tool_summary': { className: 'log-type-summary', label: 'SUMMARY' },
```

3. **Add rendering for `tool_call` entries** in the entries.map block, BEFORE the standard log entry fallthrough. Render as a compact non-collapsible line showing the tool name prominently:
```tsx
if (entry.type === 'tool_call') {
  return (
    <div key={i} className="log-entry log-entry-tool">
      <div className="log-entry-header">
        <span className="badge log-type-tool">TOOL</span>
        <span className="tool-name">{entry.tool_name}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: '10px', flexShrink: 0 }}>
          {formatTimestamp(entry.timestamp)}
        </span>
      </div>
    </div>
  );
}
```

4. **Add rendering for `tool_activity` entries** showing tool name + elapsed time (in-progress indicator):
```tsx
if (entry.type === 'tool_activity') {
  return (
    <div key={i} className="log-entry log-entry-tool">
      <div className="log-entry-header">
        <span className="badge log-type-tool">TOOL</span>
        <span className="tool-name">{entry.tool_name}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
          {entry.elapsed_time_seconds !== undefined
            ? `${Math.round(entry.elapsed_time_seconds)}s`
            : ''}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: '10px', flexShrink: 0 }}>
          {formatTimestamp(entry.timestamp)}
        </span>
      </div>
    </div>
  );
}
```

5. **Add rendering for `tool_summary` entries** showing the summary text with a distinct style:
```tsx
if (entry.type === 'tool_summary') {
  return (
    <div key={i} className="log-entry log-entry-summary">
      <div className="log-entry-header">
        <span className="badge log-type-summary">DONE</span>
        <span style={{ flex: 1, fontSize: '11px' }}>{entry.summary}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: '10px', flexShrink: 0 }}>
          {formatTimestamp(entry.timestamp)}
        </span>
      </div>
    </div>
  );
}
```

**cortex.css changes:**

Add these styles after the existing `.log-type-error` rule (around line 1073):

```css
/* Tool activity entries */
.log-entry-tool {
  border-left: 3px solid var(--amber);
  background: rgba(255,179,71,0.03);
}

.log-entry-summary {
  border-left: 3px solid var(--green);
  background: rgba(0,214,143,0.03);
}

.tool-name {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--amber);
  flex: 1;
}
```

Also update the `BuildLogEntry` interface in `src/app/deliverables/[id]/WorkspaceClient.tsx` to match -- add the same optional fields (tool_name, elapsed_time_seconds, summary, tool_use_id) so TypeScript is happy when passing SSE data through.
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit src/components/BuildLogPanel.tsx src/app/deliverables/[id]/WorkspaceClient.tsx 2>&1 | head -20</automated>
  </verify>
  <done>BuildLogPanel renders three new entry types (tool_call, tool_activity, tool_summary) with tool names displayed in monospace amber text, elapsed time in seconds, and completion summaries in green. CSS styles match the existing cortex.css design system using CSS variables. WorkspaceClient BuildLogEntry interface updated to pass through new fields.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors: `npx tsc --noEmit`
2. Dev server starts: `node_modules/.bin/next dev -p 3011` (no runtime errors)
3. Manual: Submit a task to an agent, navigate to the workspace Build Log tab, observe tool_call / tool_activity / tool_summary entries appearing in real-time as the agent works
</verification>

<success_criteria>
- When an agent runs a task, the Build Log shows individual tool calls with tool names (e.g., "Read", "Write", "Bash") as amber-badged entries
- Tool progress updates show elapsed time in seconds
- Tool completion summaries appear as green-badged "DONE" entries with human-readable descriptions
- Existing build log functionality (assistant messages, heartbeats, retries, budget exceeded, approval cards) remains unchanged
- All TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/260327-wry-live-agent-activity-feed-show-claude-age/260327-wry-SUMMARY.md`
</output>
