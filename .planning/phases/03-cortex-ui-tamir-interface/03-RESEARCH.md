# Phase 3: Cortex UI + Tamir Interface - Research

**Researched:** 2026-03-26
**Domain:** Next.js 14 App Router UI, SSE real-time updates, custom CSS design system, LLM structured output integration
**Confidence:** HIGH

## Summary

Phase 3 builds the full Cortex web dashboard (6 pages) and the Tamir planning interface. The foundation is solid: Next.js 14 App Router is already initialized, the SSE event bus is live, the state machine works, the orchestrator is registered with all 4 agents, and the A2A schemas for routing and planning turns are defined. The work is primarily frontend pages (Server Components + Client Components), API route handlers, and CSS implementation.

The biggest implementation complexities are: (1) the Tamir planning flow which involves multi-step routing -> handoff -> planning conversation -> canvas split -> configuration -> approval, all driven by structured output from the SDK; (2) the external tool/skill gallery which depends on 3 external APIs with varying availability; (3) the SSE-driven real-time updates that need to connect the existing event bus to multiple UI consumers.

**Primary recommendation:** Build in waves: CSS design system first, then static pages (Dashboard, Deliverables gallery, Org Context, Vault), then Tamir chat + routing API, then canvas + config + approval flow. External gallery APIs should use graceful fallback (company DB always works; external sources are best-effort).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Design system is fully specified in `docs/12_VISUAL_GUIDELINES.md` -- copy CSS variables verbatim into `public/cortex.css`. No improvisation on colors, fonts, or spacing. Dark terminal / Bloomberg + VS Code feel.
- **D-02:** All component CSS (badges, buttons, cards, chat bubbles, build log entries, gallery cards, tabs, markdown rendering, scrollbars, form inputs) is pre-defined in Doc 12. Implement exactly as specified.
- **D-03:** Only two animations: `fadeUp` (chat messages, 0.2s) and `blink` (typewriter cursor, 0.6s). No other transitions beyond `transition: all 0.15s` on hover states.
- **D-04:** Tamir routes immediately on the first CEO message -- no clarifying question. First message -> LLM routing with `ROUTING_SCHEMA` structured output -> task created -> routing buttons returned to UI.
- **D-05:** Routing buttons show: "Plan with [Dept Head name]" and "Plan with Tamir". CEO picks one. Planning conversation then goes directly with the chosen agent.
- **D-06:** Every planning agent response uses `AGENT_TURN_SCHEMA` structured output. No natural text parsing anywhere.
- **D-07:** `/tamir` page starts full-width chat. Canvas split pane slides in from the right only when agent returns `turn_type === "plan_ready"`.
- **D-08:** After `plan_ready`, canvas renders `plan_markdown` with typewriter effect (40-70ms/line via `marked.js`). CEO can toggle to raw markdown textarea edit mode.
- **D-09:** Phase 3 makes real API calls to external sources: Glama (free, no auth), ClawHub (free, no auth), Composio (API key in `.env.local`).
- **D-10:** Gallery default sort: stars descending.
- **D-11:** Agent-side MCP selection heuristic: prefer highest-starred option. Goes in soul.md, not code.
- **D-12:** Cross-dept tools/skills are grayed but selectable (`.gallery-card.other-dept { opacity: 0.5 }`). CEO hint text input per selected item.
- **D-13:** Default landing page is Dashboard (`/`).
- **D-14:** Sidebar nav order: Dashboard, Tamir, Deliverables, Org Context, Vault. Active state uses `--text` color + `--accent` left border.
- **D-15:** Dashboard live data via SSE. Agent status panel shows colored dot per active employee. Recent activity timeline = last 10 from activity_log.
- **D-16:** Chat history loaded from JSONL on page load via `GET /api/tasks/[taskId]/chat`.
- **D-17:** If CEO returns to ongoing planning task, `/tamir` page rehydrates from JSONL history.
- **D-18:** Hire approval button appears inline in build log when `task.state === 'input-required'` AND `task.metadata.inputType === 'hire_approval'`.

### Claude's Discretion
- Exact Prisma queries for dashboard stats
- SSE reconnection logic (exponential backoff or simple 3s retry)
- Exact Composio browse endpoint URL and response shape
- Glama and ClawHub API endpoint discovery
- Loading / skeleton states for async data
- Empty state illustrations (unicode art or simple text)
- Exact typewriter cursor blink implementation

### Deferred Ideas (OUT OF SCOPE)
- Deliverable workspace (`/deliverables/[id]` split pane, build log, file browser) -- Phase 4
- Tamir 15-minute cron -- deferred to v2
- SSE streaming for plan generation (EXTUI-05) -- out of scope for v10
- Org Chart page (EXTUI-01), Budget tracking (EXTUI-02), Skills management page (EXTUI-03), DNA editor (EXTUI-04) -- all out of scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Global CSS design system in `public/cortex.css` | Doc 12 provides all CSS verbatim; UI-SPEC has spacing adjustments |
| UI-02 | App layout with sidebar (5 nav items) | Doc 05 layout structure + Doc 12 sidebar styles; existing layout.tsx is a stub needing full rewrite |
| UI-03 | Dashboard page (stats, agent status, activity timeline) | Prisma queries against employees, tasks, activity_log tables; SSE via existing eventBus |
| UI-04 | Deliverables gallery (card grid, filters) | Prisma query on deliverables table; Doc 12 card/badge styles |
| UI-05 | Org Context page (dept tabs, agent memory, knowledge, tools/skills, employees) | Multi-source data: MEMORY.md files, knowledge/ directory, skills DB, employees table |
| UI-06 | Vault page (FTS5 search, document list) | Existing `src/lib/fts.ts` provides search; 300ms debounce on client |
| UI-07 | Agent Profile stub (`/agents/[id]`) | card.json + MEMORY.md read + tasks query |
| UI-08 | Skill approval UI in Org Context | New API routes: approve, submit-to-ceo, dismiss |
| UI-09 | Hire request approval inline in build log | Existing `POST /api/hire_requests/[id]/approve` endpoint; UI renders button conditionally |
| UI-10 | SSE endpoint streams events | Existing `src/app/api/sse/route.ts` is live; client needs `EventSource` consumers |
| TAMIR-01 | `/tamir` page: full-width chat -> 40/60 split pane | Client Component with state-driven layout; structured output drives transitions |
| TAMIR-02 | `POST /api/tamir/route`: Tamir LLM routing | Uses `orchestrator.invoke()` with `ROUTING_SCHEMA` outputFormat; creates Task record |
| TAMIR-03 | `POST /api/tasks/[taskId]/message`: planning turns | Uses `orchestrator.invoke()` with `AGENT_TURN_SCHEMA`; appends JSONL; transitions state |
| TAMIR-04 | Canvas: typewriter rendering, edit mode | Client-side marked.js rendering with line-by-line animation; textarea toggle |
| TAMIR-05 | Configuration panel: autonomy slider, budget input, constraints | Prisma update on tasks table metadata/config fields |
| TAMIR-06 | `POST /api/tasks/[taskId]/approve`: create desk, enqueue run, redirect | Uses `createTaskWorkspace()`, creates Deliverable + TaskRun records |
| TAMIR-07 | Tool + skill gallery: search, source toggles, selection | External APIs (Glama, ClawHub, Composio) + company DB |
| TAMIR-08 | Supporting API routes: artifact update, task state, chat history, cancel | CRUD operations on tasks table + JSONL file reads |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14.2.35 | App Router -- Server Components + Client Components | Already installed; all pages are App Router routes |
| React | 18.3.1 | UI rendering | Already installed; no React 19 |
| marked | 17.0.5 | Markdown to HTML rendering | Already installed; used for plan canvas, chat bubbles, knowledge previews |
| Prisma | 7.5.0 | ORM for all DB queries | Already installed with better-sqlite3 adapter |
| pino | 10.3.1 | Structured logging | Already installed; use for API route logging |

### No New Dependencies Needed

All required libraries are already in `package.json`. The phase is entirely about writing pages, components, CSS, and API routes using what's installed. No `npm install` needed.

Key existing utilities the planner should know about:
- `src/lib/db.ts` -- exports `prisma` (ORM) and `sqlite` (raw SQL for FTS5)
- `src/lib/events.ts` -- exports `eventBus` (SSE singleton)
- `src/lib/state-machine.ts` -- exports `transitionTask(taskId, fromState, toState)` and `VALID_TRANSITIONS`
- `src/lib/id.ts` -- exports `generateId(prefix)`
- `src/lib/workspace.ts` -- exports `createTaskWorkspace(taskId, department, plan?, constraints?)`
- `src/lib/orchestrator.ts` -- exports `orchestrator` singleton with `.invoke()` method
- `src/lib/invoke-agent.ts` -- exports `invokeAgent()` with full SDK integration
- `src/a2a/schemas.ts` -- exports `ROUTING_SCHEMA` and `AGENT_TURN_SCHEMA`
- `src/a2a/types.ts` -- exports all A2A TypeScript interfaces

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    layout.tsx                          # Full rewrite: sidebar + cortex.css link
    page.tsx                            # Dashboard (Server Component + Client island for SSE)
    tamir/
      page.tsx                          # Tamir interface (Client Component -- heavy interactivity)
    deliverables/
      page.tsx                          # Gallery (Server Component with client search)
    org-context/
      page.tsx                          # Dept tabs + panels (Client Component for tab switching)
    vault/
      page.tsx                          # FTS5 search (Client Component for debounced search)
    agents/
      [id]/
        page.tsx                        # Agent profile stub (Server Component)
    api/
      tamir/
        route/
          route.ts                      # POST /api/tamir/route
      tasks/
        [taskId]/
          route.ts                      # GET /api/tasks/[taskId]
          message/
            route.ts                    # POST /api/tasks/[taskId]/message
          config/
            route.ts                    # PUT /api/tasks/[taskId]/config
          artifact/
            route.ts                    # PUT /api/tasks/[taskId]/artifact
          approve/
            route.ts                    # POST /api/tasks/[taskId]/approve
          chat/
            route.ts                    # GET /api/tasks/[taskId]/chat
          cancel/
            route.ts                    # POST /api/tasks/[taskId]/cancel
      search/
        tools/
          route.ts                      # GET /api/search/tools
        skills/
          route.ts                      # GET /api/search/skills
      skills/
        [skillId]/
          approve/
            route.ts                    # POST /api/skills/[skillId]/approve
          submit-to-ceo/
            route.ts                    # POST /api/skills/[skillId]/submit-to-ceo
          dismiss/
            route.ts                    # POST /api/skills/[skillId]/dismiss
      org-context/
        [dept]/
          route.ts                      # GET /api/org-context/[dept]
      agents/
        [id]/
          route.ts                      # GET /api/agents/[id]
      vault/
        search/
          route.ts                      # GET /api/vault/search
  components/
    Sidebar.tsx                         # Sidebar nav (Client Component)
    ChatPanel.tsx                       # Reusable chat UI for Tamir page
    CanvasPanel.tsx                     # Plan canvas with typewriter + edit mode
    ConfigPanel.tsx                     # Autonomy/budget/constraints controls
    GalleryPanel.tsx                    # Tool/skill gallery with search
    SSEProvider.tsx                     # Client-side EventSource hook/wrapper
public/
  cortex.css                            # Complete design system
```

### Pattern 1: Server Component + Client Island
**What:** Pages that load data on the server but have interactive elements.
**When to use:** Dashboard, Deliverables gallery, Agent profile.
**Example:**
```typescript
// app/page.tsx (Dashboard) -- Server Component for initial data
import { prisma } from '@/lib/db';
import { DashboardClient } from '@/components/DashboardClient';

export default async function Dashboard() {
  const [stats, agents, activities] = await Promise.all([
    getDashboardStats(),
    getAgentStatuses(),
    getRecentActivity(),
  ]);
  return <DashboardClient initialStats={stats} initialAgents={agents} initialActivities={activities} />;
}
```

### Pattern 2: Full Client Component
**What:** Pages with heavy interactivity that are entirely client-rendered.
**When to use:** Tamir interface (chat + canvas + config), Org Context (tab switching + expandable panels).
**Example:**
```typescript
// app/tamir/page.tsx
'use client';
// All state management via useState/useRef
// SSE via EventSource
// API calls via fetch()
```

### Pattern 3: SSE Consumer Hook
**What:** Custom hook that connects to `/api/sse` and dispatches events.
**When to use:** Any component needing real-time updates.
**Example:**
```typescript
// components/useSSE.ts
'use client';
import { useEffect, useRef, useCallback } from 'react';

export function useSSE(handlers: Record<string, (data: unknown) => void>) {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/sse');
    esRef.current = es;

    es.addEventListener('message', (evt) => {
      // SSE route uses named events: event.type maps to handler key
      // But current implementation sends on default 'message' with type in data
    });

    // Current SSE endpoint emits named events (event: task:transition)
    // Client must listen with addEventListener for each event type
    // OR: current implementation wraps all into 'event' channel
    // -- actual: SSE route uses `event: ${event.type}\ndata:...`
    // So client should listen to specific named events:
    for (const [type, handler] of Object.entries(handlers)) {
      es.addEventListener(type, (evt: MessageEvent) => {
        handler(JSON.parse(evt.data));
      });
    }

    es.onerror = () => {
      // Simple reconnect -- EventSource auto-reconnects by spec
      // Add 3-second delay if needed
    };

    return () => es.close();
  }, []); // Handlers should be stable refs
}
```

### Pattern 4: API Route with maxDuration
**What:** Agent-invoking API routes need extended timeout.
**When to use:** `/api/tamir/route`, `/api/tasks/[taskId]/message`.
**Example:**
```typescript
// app/api/tasks/[taskId]/message/route.ts
export const maxDuration = 120; // 2 minutes for LLM calls

export async function POST(req: Request, { params }: { params: { taskId: string } }) {
  // ...
}
```

### Anti-Patterns to Avoid
- **Do NOT use React state management libraries** (Redux, Zustand, etc.) -- useState + useRef only
- **Do NOT use CSS frameworks** -- all styling in cortex.css
- **Do NOT parse LLM output with regex** -- use structured output schemas exclusively
- **Do NOT build custom SSE library** -- use native EventSource API
- **Do NOT create separate Express/Fastify server** -- all HTTP through Next.js API routes
- **Do NOT import from `@a2a-js/sdk`** -- project uses in-house types in `src/a2a/types.ts`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom parser | `marked.parse()` (already installed v17.0.5) | Full GFM support, fast, zero-dependency |
| Real-time updates | WebSocket server, polling loop | `EventSource` + existing SSE endpoint | SSE auto-reconnects, no extra server needed |
| YAML frontmatter parsing | Regex extraction | `gray-matter` (already installed v4.0.3) | Handles edge cases in YAML parsing |
| State machine transitions | Manual SQL UPDATE | `transitionTask()` from `src/lib/state-machine.ts` | Atomic WHERE-on-current-state, auto-logs, auto-emits SSE |
| Task workspace creation | Manual mkdir/symlink | `createTaskWorkspace()` from `src/lib/workspace.ts` | Handles skill symlinks, CLAUDE.md, manifest creation |
| Agent invocation | Direct Anthropic API calls | `orchestrator.invoke()` | Manages MCP server, access control, cost tracking, session |
| ID generation | `crypto.randomUUID()` | `generateId(prefix)` from `src/lib/id.ts` | Consistent prefix format used across all tables |

## Common Pitfalls

### Pitfall 1: transitionTask() Requires fromState
**What goes wrong:** Doc 06 examples show `transitionTask(taskId, newState)` (2 args), but the actual implementation requires 3 args: `transitionTask(taskId, fromState, toState)`.
**Why it happens:** The atomic WHERE-on-current-state pattern needs to know the expected current state.
**How to avoid:** Always read the task's current state before transitioning. The actual signature is `transitionTask(taskId: string, fromState: TaskState, toState: TaskState, metadata?: Record<string, unknown>)`.
**Warning signs:** TypeScript error on argument count.

### Pitfall 2: orchestrator.invoke() Has Complex Signature
**What goes wrong:** Doc 06 shows `orch.invoke('tamir', ceoMessage, {...})` but the real signature requires `taskId`, `runId`, `agentId`, `prompt`, `deskDir`, `delivDir`, `manifestPath` and more.
**Why it happens:** The orchestrator was built for worker execution context, not lightweight planning API calls.
**How to avoid:** For planning turns (TAMIR-02, TAMIR-03), the API route must create appropriate context (e.g., a temporary task_run record, use planning desk paths). Alternatively, the orchestrator may need a lighter `invokePlanning()` method that doesn't require a full workspace.
**Warning signs:** Missing required parameters when calling orchestrator.

### Pitfall 3: Schema Field Name Mismatch Between Docs and Code
**What goes wrong:** Doc 06 references `type` and `planMarkdown` (camelCase) but actual `AGENT_TURN_SCHEMA` in `src/a2a/schemas.ts` uses `turn_type` and `plan_markdown` (snake_case).
**Why it happens:** Docs were written before implementation. The code is authoritative.
**How to avoid:** Always reference `src/a2a/schemas.ts` and `src/a2a/types.ts` as the source of truth. The actual schema fields are: `turn_type`, `message`, `plan_markdown`.
**Warning signs:** Frontend checking `turn.type` instead of `turn.turn_type`.

### Pitfall 4: SSE Event Format
**What goes wrong:** Assuming SSE sends JSON on the default message channel, but the actual implementation uses named events.
**Why it happens:** The SSE route uses `event: ${event.type}\ndata: ...` format, meaning the client must use `es.addEventListener('task:transition', ...)` not `es.onmessage`.
**How to avoid:** The existing SSE endpoint (`src/app/api/sse/route.ts`) wraps all events through the `eventBus.on('event', handler)` pattern. It emits named events. The client should use `addEventListener` for each event type, OR listen to the generic `message` event if the data envelope includes the type.
**Warning signs:** Events received but handler never fires.

### Pitfall 5: Prisma Column Names Are camelCase in Raw SQL
**What goes wrong:** Writing raw SQL queries using snake_case column names.
**Why it happens:** Phase 1 decision: Prisma camelCase column names in raw SQL -- no `@map()` overrides in schema.
**How to avoid:** Use `taskId` not `task_id`, `actionType` not `action_type`, `createdAt` not `created_at` in all raw SQL. Or better: use Prisma client for most queries.
**Warning signs:** SQLite returns empty results or throws column-not-found errors.

### Pitfall 6: External API Endpoints Are Uncertain
**What goes wrong:** Hardcoding external API URLs that don't exist or have changed.
**Why it happens:** Glama has no documented public search API. ClawHub (`hub.openclaw.ai`) domain does not resolve. MCP Registry (`registry.mcphub.io`) 404s on `/api/v1/servers`. Composio requires API key and returns 401 without it.
**How to avoid:** Build external gallery search with graceful degradation. Company DB is always the primary source. External APIs should be wrapped in try/catch with timeout. If an external source fails, show "source unavailable" in the UI rather than breaking.
**Warning signs:** Network errors in production when external APIs are down.

### Pitfall 7: Next.js 14 App Router Dynamic Route Params
**What goes wrong:** Accessing `params.taskId` synchronously in route handlers.
**Why it happens:** In Next.js 14.2.x, route handler params are still synchronous (unlike Next.js 15 where they become async). But the pattern may vary between page components and route handlers.
**How to avoid:** For API routes in Next.js 14: `{ params }: { params: { taskId: string } }` works synchronously. For page components with `generateMetadata`, params may need to be awaited in some edge cases. Test locally.
**Warning signs:** TypeScript errors about `Promise<{ taskId: string }>`.

### Pitfall 8: Task Table Missing Approval/Config Fields
**What goes wrong:** Trying to store `autonomyLevel`, `maxBudgetCents`, `selectedTools`, `selectedSkills` on the task record.
**Why it happens:** The Prisma schema has `metadata` (JSON string) but no dedicated config columns.
**How to avoid:** Store task configuration in the `metadata` JSON field. Parse with `JSON.parse(task.metadata)` and serialize with `JSON.stringify(config)`. The `TaskConfig` interface in `src/a2a/types.ts` defines the shape.
**Warning signs:** Prisma schema error when trying to add fields without a migration.

## Code Examples

### SSE Client Hook (Recommended)
```typescript
// src/components/useSSE.ts
'use client';
import { useEffect, useRef } from 'react';

type SSEHandler = (data: Record<string, unknown>) => void;

export function useSSE(handlers: Record<string, SSEHandler>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const es = new EventSource('/api/sse');

    // The SSE endpoint emits named events via `event: ${type}\n`
    // Listen to each event type the component cares about
    const eventTypes = Object.keys(handlersRef.current);
    const listeners: Array<[string, EventListener]> = [];

    for (const type of eventTypes) {
      const listener = (evt: Event) => {
        const data = JSON.parse((evt as MessageEvent).data);
        handlersRef.current[type]?.(data);
      };
      es.addEventListener(type, listener);
      listeners.push([type, listener]);
    }

    // Reconnect on error (EventSource auto-reconnects by spec)
    // Add explicit reconnection with 3-second delay as fallback
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    es.onerror = () => {
      reconnectTimeout = setTimeout(() => {
        // EventSource will auto-reconnect; this is just for logging
      }, 3000);
    };

    return () => {
      clearTimeout(reconnectTimeout);
      for (const [type, listener] of listeners) {
        es.removeEventListener(type, listener);
      }
      es.close();
    };
  }, []);
}
```

### Dashboard Stats Query Pattern
```typescript
// Server-side data fetching for dashboard
import { prisma } from '@/lib/db';

async function getDashboardStats() {
  const [activeAgents, activeTasks, pendingApprovals, deliverableCount] = await Promise.all([
    prisma.employee.count({ where: { status: 'active' } }),
    prisma.task.count({ where: { state: { in: ['submitted', 'working', 'input-required'] } } }),
    prisma.hireRequest.count({ where: { status: 'pending' } }),
    prisma.deliverable.count(),
  ]);
  return { activeAgents, activeTasks, pendingApprovals, deliverableCount };
}
```

### JSONL Chat History Reading
```typescript
import { readFileSync, existsSync } from 'fs';

interface ChatLine {
  role: 'user' | 'agent' | 'system';
  content: string;
  ts: string;
  agentId?: string;
  turnType?: string;
}

function readChatHistory(chatPath: string): ChatLine[] {
  if (!existsSync(chatPath)) return [];
  const raw = readFileSync(chatPath, 'utf-8').trim();
  if (!raw) return [];
  return raw.split('\n').map(line => JSON.parse(line));
}
```

### Typewriter Effect (Client-Side)
```typescript
// Per D-08: 40-70ms per line via marked.js
function typewriterRender(
  markdown: string,
  container: HTMLElement,
  onComplete: () => void
) {
  const lines = markdown.split('\n');
  let i = 0;
  let accumulated = '';

  function writeLine() {
    if (i >= lines.length) {
      onComplete();
      return;
    }
    accumulated += lines[i] + '\n';
    // marked is already installed -- import { marked } from 'marked';
    container.innerHTML = marked.parse(accumulated) as string;
    container.scrollTop = container.scrollHeight;
    i++;
    setTimeout(writeLine, 40 + Math.random() * 30); // 40-70ms per line
  }
  writeLine();
}
```

## External API Research

### Glama (Tool Search)
**Confidence:** LOW -- no documented public API found
**What we know:** Glama.ai hosts a searchable directory of 20,000+ MCP servers. The website at `https://glama.ai/mcp/servers` has a React-based search UI with facets (category, language, environment). Results include stars, weekly downloads, date added.
**What's unclear:** No public REST API endpoint was found. The search page uses server-side rendering with embedded data. There may be an undocumented API at `/mcp/api` but it returned no useful documentation.
**Recommendation:** Attempt `GET https://glama.ai/api/mcp/servers?search={query}&limit=20` as shown in Doc 08. If it works, use it. If it returns HTML or 404, implement a fallback: skip Glama as a source and log a warning. The company DB and MCP Registry are alternative sources.

### MCP Registry (mcphub.io) (Tool Search)
**Confidence:** LOW -- API returned 404
**What we know:** `https://registry.mcphub.io` returns `{"message":"Welcome to MCP Registry API"}` on root. The documented endpoint `GET /api/v1/servers?q={query}&limit=20` returned 404.
**What's unclear:** Whether the API path has changed, requires auth, or is deprecated.
**Recommendation:** Same fallback strategy as Glama. Try the endpoint from Doc 08. If it fails, gracefully degrade. Consider that the API may have moved to a v2 path.

### ClawHub (Skill Search)
**Confidence:** LOW -- domain does not resolve
**What we know:** `hub.openclaw.ai` DNS lookup fails entirely (ENOTFOUND). The domain appears to not exist.
**What's unclear:** Whether ClawHub was renamed, moved, or was a proposed service that never launched.
**Recommendation:** Implement the ClawHub toggle in the gallery UI but show "source unavailable" when the API call fails. Company DB is the reliable skill source.

### Composio (Tool Search)
**Confidence:** MEDIUM -- API exists but requires auth
**What we know:** Composio has a documented API at `https://backend.composio.dev/api/v3/`. The toolkits endpoint is `GET /api/v3/toolkits`. Auth is via `x-api-key` header. Returns 401 without key.
**What's unclear:** Exact query parameters for search/filter. Response shape for toolkit listing.
**Recommendation:** Use `GET https://backend.composio.dev/api/v3/toolkits?limit=20` with header `x-api-key: ${process.env.COMPOSIO_API_KEY}`. Wrap in try/catch. If no API key is configured, skip Composio source silently. Store `COMPOSIO_API_KEY` in `.env.local`.

### External API Strategy Summary
Build all external API integrations with this pattern:
1. Company DB query runs first (always works)
2. External sources fire in parallel with 5-second timeout
3. Failed sources show "unavailable" badge in UI
4. Results merge into unified gallery with source badges
5. Sort by stars descending across all sources (D-10)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for updates | SSE via EventSource | Already built (Phase 1) | No polling code needed; subscribe to eventBus |
| Custom agent loop | Claude Agent SDK `query()` | Already built (Phase 2) | All agent calls go through `orchestrator.invoke()` |
| String parsing LLM output | SDK structured output | Already built (Phase 2) | All turn types from JSON schema, not regex |
| Separate CSS per component | Single `cortex.css` | Doc 12 mandate | All CSS in one file, class-based |

## Open Questions

1. **orchestrator.invoke() for planning turns**
   - What we know: The current `orchestrator.invoke()` requires `runId`, `deskDir`, `delivDir`, `manifestPath` -- parameters designed for execution context with a full workspace.
   - What's unclear: Planning turns (TAMIR-02, TAMIR-03) run in the planning desk, not an execution workspace. There's no `delivDir` or `manifestPath` for planning. A temporary `task_run` record may need to be created, or `orchestrator.invoke()` may need a lightweight planning variant.
   - Recommendation: For planning calls, create a minimal task_run record (status: 'executing') and use the planning desk paths. The `delivDir` and `manifestPath` can point to empty/temp locations since planning turns don't produce deliverables. Alternatively, add a `invokePlanning()` method to the orchestrator that doesn't require workspace paths. The planner should decide which approach is cleaner.

2. **Task table missing `approvedAt` column**
   - What we know: Doc 06 derives lifecycle from `approvedAt` timestamp, but the Prisma schema only has `completedAt` -- no `approvedAt` field.
   - What's unclear: Whether to add it via migration or derive it from activity_log.
   - Recommendation: Add `approvedAt DateTime?` to the Task model in `schema.prisma` and run a migration. This is a simple schema addition that enables the lifecycle derivation pattern from Doc 06.

3. **External gallery API availability**
   - What we know: 2 of 3 external APIs failed basic connectivity tests (ClawHub DNS failure, MCP Registry 404). Glama has no documented API.
   - What's unclear: Whether these services will be available at implementation time.
   - Recommendation: Build with graceful degradation. Company DB always works. External sources are best-effort extras.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Assumed (project runs) | 22.x LTS | -- |
| pnpm | Package management | Assumed (packages installed) | latest | -- |
| SQLite (via better-sqlite3) | All DB queries | Yes | 12.8.0 | -- |
| marked | Markdown rendering | Yes | 17.0.5 (installed) | -- |
| gray-matter | YAML frontmatter | Yes | 4.0.3 (installed) | -- |
| Composio API key | Tool gallery search | Unknown | -- | Skip Composio source if no key |
| Glama API | Tool gallery search | Unknown (no documented API) | -- | Company DB + other sources |
| ClawHub API | Skill gallery search | No (domain doesn't resolve) | -- | Company DB only |
| MCP Registry API | Tool gallery search | Unknown (404 on v1 endpoint) | -- | Company DB + Glama |

**Missing dependencies with no fallback:** None (all are code-only changes)

**Missing dependencies with fallback:**
- External gallery APIs: all 3 external sources have uncertain availability; company DB is the reliable fallback
- `COMPOSIO_API_KEY`: must be in `.env.local` if Composio integration is desired

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/`, `src/a2a/`, `src/app/api/`, `prisma/schema.prisma` -- verified current implementation
- `docs/12_VISUAL_GUIDELINES.md` -- complete CSS specification
- `docs/05_CORTEX_UI.md` -- page layout and behavior specification
- `docs/06_TAMIR_INTERFACE.md` -- full Tamir flow specification with API contracts
- `docs/08_TOOLS_SKILLS_MCP.md` -- tool/skill gallery and external search endpoints

### Secondary (MEDIUM confidence)
- Composio API docs at `docs.composio.dev` -- confirmed toolkits endpoint exists with API key auth

### Tertiary (LOW confidence)
- Glama API endpoint from Doc 08 (`glama.ai/api/mcp/servers?search=...`) -- not verified, may not exist as documented
- ClawHub API endpoint from Doc 08 (`hub.openclaw.ai/api/skills?q=...`) -- domain does not resolve
- MCP Registry API endpoint from Doc 08 (`registry.mcphub.io/api/v1/servers?q=...`) -- returns 404

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- everything is already installed and working from Phase 1+2
- Architecture: HIGH -- Next.js 14 App Router patterns are well-established, existing code shows clear patterns
- UI implementation: HIGH -- Doc 12 provides verbatim CSS, Doc 05/06 provide exact page specs
- External APIs: LOW -- 3 of 3 external endpoints have uncertain availability
- Pitfalls: HIGH -- derived from reading actual code and comparing to documentation

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (30 days -- stack is stable, external APIs may change)
