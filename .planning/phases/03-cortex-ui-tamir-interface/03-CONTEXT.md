# Phase 3: Cortex UI + Tamir Interface - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Six core pages of The Cortex web dashboard + the complete Tamir planning flow (route → multi-turn chat with dept head → plan canvas → configure → approve → enqueue). Backed by `public/cortex.css` built from scratch per Doc 12. Phase 4 owns the deliverable workspace — this phase ends at the redirect to `/deliverables/[id]`.

Requirements covered: UI-01 through UI-10, TAMIR-01 through TAMIR-08.

</domain>

<decisions>
## Implementation Decisions

### Visual Design System

- **D-01:** Design system is fully specified in `docs/12_VISUAL_GUIDELINES.md` — copy CSS variables verbatim into `public/cortex.css`. No improvisation on colors, fonts, or spacing. Dark terminal / Bloomberg + VS Code feel: `--bg: #1a1a2e`, `--accent: #e94560`, JetBrains Mono monospace everywhere, 4px radius max.
- **D-02:** All component CSS (badges, buttons, cards, chat bubbles, build log entries, gallery cards, tabs, markdown rendering, scrollbars, form inputs) is pre-defined in Doc 12. Implement exactly as specified — no variations.
- **D-03:** Only two animations in the entire system: `fadeUp` (chat messages, 0.2s) and `blink` (typewriter cursor, 0.6s). No other transitions beyond `transition: all 0.15s` on hover states.

### Tamir Routing Flow

- **D-04:** Tamir routes immediately on the first CEO message — no clarifying question. First message → LLM routing with `ROUTING_SCHEMA` structured output → task created → routing buttons returned to UI.
- **D-05:** Routing buttons show: **"Plan with [Dept Head name]"** and **"Plan with Tamir"**. CEO picks one. Planning conversation then goes directly with the chosen agent — Tamir does NOT relay or summarize. Tamir is done after routing.
- **D-06:** Every planning agent response uses `AGENT_TURN_SCHEMA` structured output (already built in `src/a2a/schemas.ts`). Schema enforces `{ turn_type, message, plan_markdown? }` — no natural text parsing anywhere. Doc 00 decision #4 is absolute: all state-driving responses use `outputFormat`.

### Split Pane Trigger

- **D-07:** The `/tamir` page starts full-width chat. The canvas split pane slides in from the right **only when the agent returns `turn_type === "plan_ready"`** from `AGENT_TURN_SCHEMA`. No empty canvas placeholder during conversation — the split happens on the plan signal, not on routing.
- **D-08:** After `plan_ready`, the canvas renders `plan_markdown` with typewriter effect (40-70ms/line via `marked.js`). CEO can toggle to raw markdown textarea edit mode. Save/Edit button persists the edit via `PUT /api/tasks/[taskId]/artifact`.

### External Tool & Skill Registries

- **D-09:** Phase 3 makes **real API calls** to all three external sources in the tool/skill gallery (TAMIR-07):
  - **Glama**: free, no auth required — tools registry
  - **ClawHub**: free, no auth required — skills registry
  - **Composio**: API key required → stored as `COMPOSIO_API_KEY` in `.env.local` (never committed). Researcher must document the exact Composio browse/search endpoint and auth header pattern.
- **D-10:** Gallery default sort: **stars descending**. Highest-rated tools/skills appear first in all gallery views — plan mode selector and Org Context skill browser.
- **D-11:** Agent-side MCP selection heuristic: when an agent is uncertain which MCP server to use and Glama returns multiple options, **prefer the highest-starred option**. This rule goes in the soul.md / CLAUDE.md agent instructions, not in code.
- **D-12:** Cross-dept tools/skills are grayed but selectable (`.gallery-card.other-dept { opacity: 0.5 }`). CEO hint text input per selected item (free text, injected into desk CLAUDE.md on approval).

### Dashboard & Navigation

- **D-13:** Default landing page is **Dashboard (`/`)** — stats row + live agent status panel + recent activity timeline. Not `/tamir`.
- **D-14:** Sidebar nav order: Dashboard ▣ → Tamir ◐ → Deliverables ◎ → Org Context ◆ → Vault ⬡. Active state uses `--text` color + `--accent` left border. Logo shows "v10 — The Cortex" in `--accent`.
- **D-15:** Dashboard live data via SSE (`EventSource` to `/api/sse`). Agent status panel shows colored dot per active employee (green = executing within last 30s, amber = heartbeat >30s old, gray = idle). Recent activity timeline = last 10 rows from `activity_log` table, polled on mount + updated via `task:transition` SSE events.

### Chat History & Page State

- **D-16:** Chat history is loaded from JSONL on page load via `GET /api/tasks/[taskId]/chat`. Planning chat path: `data/departments/{dept}/planning-desk/chat/{taskId}.jsonl` (per Doc 00 decision #17).
- **D-17:** If CEO navigates away and returns to an ongoing planning task, the `/tamir` page rehydrates from JSONL history. If `task.state === 'working'` and an artifact exists, render the split pane immediately (canvas pre-populated, no typewriter replay).

### Hire Request Approval UI

- **D-18:** Hire approval button (UI-09) appears inline in the build log when `task.state === 'input-required'` AND `task.metadata.inputType === 'hire_approval'`. Calls `POST /api/hire_requests/[id]/approve` (built in Phase 2). No separate page.

### Claude's Discretion

- Exact Prisma queries for dashboard stats (total active agents, tasks in flight, pending approvals, deliverable count)
- SSE reconnection logic on client (exponential backoff or simple 3s retry)
- Exact Composio browse endpoint URL and response shape — researcher must document this
- Glama and ClawHub API endpoint discovery — researcher investigates
- Loading / skeleton states for async data
- Empty state illustrations (unicode art or simple text — no image assets)
- Exact typewriter cursor blink implementation (already specified in Doc 12: `@keyframes blink`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual Design (MANDATORY — single source of truth)
- `docs/12_VISUAL_GUIDELINES.md` — ALL CSS variables, component styles, typography, animations, badges, buttons, cards, chat bubbles, build log, gallery cards, tabs, scrollbars. Copy verbatim. This file wins over any other visual definition.

### Cortex UI Pages
- `docs/05_CORTEX_UI.md` — All 6 core pages: layout, sidebar, Dashboard, Deliverables gallery, Org Context, Vault, Agent Profile stub, Skill approval UI, SSE wiring
- `docs/00_VISION_PRODUCT_BACKGROUND.md` §Canonical Implementation Decisions — 27 locked decisions (especially #4 structured output, #17 chat JSONL paths, #16 planning desk, #11 visual authority)

### Tamir Interface
- `docs/06_TAMIR_INTERFACE.md` — Full Tamir chat, plan mode, canvas, configuration panel, tool/skill gallery, approval flow
- `docs/08_TOOLS_SKILLS_MCP.md` — Tool/skill gallery data sources, search endpoints, external registry patterns

### A2A & Task State
- `docs/03_A2A_PROTOCOL.md` — Task actor model (planningAgentId, executorAgentId, currentActorId), state machine, routing schema, turn schema
- `src/a2a/schemas.ts` — `ROUTING_SCHEMA` and `AGENT_TURN_SCHEMA` (already built, Phase 3 consumes these)
- `src/a2a/types.ts` — TypeScript interfaces matching the schemas

### Integration Points (Phase 1 + 2 outputs Phase 3 consumes)
- `src/app/api/sse/route.ts` — Live SSE endpoint, event envelope format
- `src/lib/events.ts` — `eventBus` singleton — emit patterns already established
- `src/app/api/hire_requests/[id]/approve/route.ts` — Hire approval endpoint (Phase 2, Phase 3 calls it)
- `src/app/api/hire_requests/[id]/reject/route.ts` — Hire rejection endpoint
- `src/lib/state-machine.ts` — `transitionTask()`, valid state transitions
- `prisma/schema.prisma` — All 10 tables available for data fetching

### End-to-End Scenarios
- `docs/09_TASK_SCENARIOS.md` — Full task lifecycle scenarios the UI must support

### Environment / Config
- `docs/10_CONFIGURATION_DEPLOYMENT.md` — `.env.local` keys including `COMPOSIO_API_KEY`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/api/sse/route.ts`: SSE endpoint is live — client uses `new EventSource('/api/sse')`, listens for `task:transition`, `task:buildlog`, `task:heartbeat`, `hire:requested` event types
- `src/lib/events.ts`: `eventBus` singleton — all Phase 2 emitters already use it; Phase 3 UI subscribes client-side
- `src/lib/state-machine.ts`: `TaskState` type and `VALID_TRANSITIONS` — use these for derived UI states (e.g. "can approve?" = state is `working` and actor is CEO)
- `src/a2a/schemas.ts`: `ROUTING_SCHEMA` + `AGENT_TURN_SCHEMA` — Phase 3 API routes pass these as `outputFormat` to `orchestrator.invoke()`
- `src/lib/worker.ts`: `WORKER_*` constants now in `src/lib/config.ts` — dashboard can display these as system info
- `src/lib/seed-agents.ts`: `seedAgents()` — agents in DB on first boot; dashboard can read from `employees` table

### Established Patterns
- No React state management libraries — `useState` + `useRef` for local UI state, `EventSource` for live data, Server Components for initial data load
- Custom CSS only — `public/cortex.css` is the single stylesheet, imported in `app/layout.tsx`
- API routes export `maxDuration = 120` for agent-invoking endpoints (Doc 00 decision #27)
- Chat JSONL on filesystem, not in DB — `GET /api/tasks/[taskId]/chat` reads from `data/departments/{dept}/planning-desk/chat/{taskId}.jsonl`
- No auth required — single-user localhost app

### Integration Points
- `app/layout.tsx` needs full rewrite: add `<link rel="stylesheet" href="/cortex.css">`, implement sidebar with 5 nav items
- `app/page.tsx` (Dashboard) replaces the placeholder — reads from `employees`, `tasks`, `activity_log` tables
- New routes needed: `app/tamir/page.tsx`, `app/deliverables/page.tsx`, `app/org-context/page.tsx`, `app/vault/page.tsx`, `app/agents/[id]/page.tsx`
- New API routes needed: `POST /api/tamir/route`, `POST /api/tasks/[taskId]/message`, `PUT /api/tasks/[taskId]/config`, `PUT /api/tasks/[taskId]/artifact`, `POST /api/tasks/[taskId]/approve`, `GET /api/tasks/[taskId]`, `GET /api/tasks/[taskId]/chat`, `GET /api/search/tools`, `GET /api/search/skills`

</code_context>

<specifics>
## Specific Ideas

- Tamir's first response after routing should include a brief framing sentence about why it's routing to that dept — matching his voice from D-04 in Phase 2 context: "Routing to CTO — this maps to the EEG data pipeline work." Not just "Routing to: Tech."
- Gallery sort: stars descending by default across all sources. When Glama returns results with star counts, sort before rendering. Same for Composio and ClawHub if they expose a rating/popularity field.
- Agent-side MCP preference (D-11): this is a soul.md instruction, not a code rule. Something like: "When selecting between MCP tools from external registries, prefer the option with the highest community rating (stars) when capability is equivalent."
- The `/tamir` page should feel like iMessage or Linear's comment thread — not a generic chatbot. Agent avatars (colored circles with initials) on every message, timestamps, smooth fadeUp animations per Doc 12.

</specifics>

<deferred>
## Deferred Ideas

- Deliverable workspace (`/deliverables/[id]` split pane, build log, file browser) — Phase 4 scope (DELIV-01 through DELIV-05)
- Tamir 15-minute cron — deferred to v2 per Phase 2 decisions
- SSE streaming for plan generation (EXTUI-05) — out of scope for v10
- Org Chart page (EXTUI-01), Budget tracking (EXTUI-02), Skills management page (EXTUI-03), DNA editor (EXTUI-04) — all out of scope

</deferred>

---

*Phase: 03-cortex-ui-tamir-interface*
*Context gathered: 2026-03-26*
