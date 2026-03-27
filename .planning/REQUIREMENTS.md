# Requirements: Myelin v10 — The Cortex

**Defined:** 2026-03-25
**Core Value:** Agents actually execute real business tasks end-to-end — not just generate text

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation Infrastructure

- [x] **FOUND-01**: Next.js 14 App Router project initialized with TypeScript strict mode and pnpm
- [x] **FOUND-02**: Prisma 7.5 + SQLite with WAL mode (`PRAGMA journal_mode=WAL`, `PRAGMA busy_timeout=5000`), zod v4 (NOT v3 — hard SDK peer dependency)
- [x] **FOUND-03**: FTS5 virtual table (`documents_fts`) + sync triggers created via raw SQL in migration + safety-net init in `instrumentation.ts` (Prisma cannot express FTS5)
- [x] **FOUND-04**: Task state machine with 6 standard A2A states only (submitted, working, input-required, completed, failed, canceled) — `transitionTask()` enforces valid transitions via WHERE-on-current-state atomic SQL
- [x] **FOUND-05**: Single shared SSE event bus (`src/lib/events.ts`) using Node.js EventEmitter — all emitters and subscribers import from this one module
- [x] **FOUND-06**: `instrumentation.ts` bootstrap: fire-and-forget worker loop + FTS5 init under `NEXT_RUNTIME === 'nodejs'` guard with singleton flag (must not block server startup or duplicate on HMR)
- [x] **FOUND-07**: Worker loop: polls `task_runs` table, claims with optimistic lock, enforces concurrency cap (max 3 concurrent SDK subprocesses), heartbeat every 15s, marks stale `executing` runs as failed on startup
- [x] **FOUND-08**: Company DNA template at `config/company-dna.template.md`; copied to `data/vault/company-dna.md` + indexed in FTS5 on first boot
- [x] **FOUND-09**: ID generation utility: `generateId(prefix)` → `${prefix}_${randomBytes(4).hex}` (e.g., `task_a1b2c3d4`)
- [x] **FOUND-10**: `createTaskWorkspace()`: creates `desk/` + `deliverables/` directories, symlinks active dept + global skills into `desk/.claude/skills/`, writes `desk/CLAUDE.md` with plan + constraints, creates stub `deliverable_manifest.json` in `deliverables/`
- [x] **FOUND-11**: Planning desk per department at `data/departments/{dept}/planning-desk/` with `.claude/skills/` symlinks and `chat/` subdirectory

### Agent System

- [x] **AGENT-01**: `invokeAgent()` wrapper around SDK `query()`: uses `systemPrompt: {type:'preset', preset:'claude_code', append:soul}` for CLAUDE.md auto-load, stores session_id AND absolute cwd in task record, streams partial messages for build log, logs cost to cost_events table
- [x] **AGENT-02**: Orchestrator singleton holding configs for all 4 agents; `invoke()` method exposes outputFormat, agents, maxBudgetUsd, cwd, sessionId options
- [x] **AGENT-03**: Self-contained agent directories (`src/agents/{tamir,cto,cmo,coo}/`): soul.md + card.json + agent.ts for each; 4 executive employees seeded to DB
- [x] **AGENT-04**: SDK structured output (`outputFormat: {type:'json_schema',schema:...}`) for ALL turn routing — no regex, no freeform parsing; planning turn schema and routing result schema defined in `src/a2a/types.ts`
- [x] **AGENT-05**: A2A TypeScript interfaces: AgentCard, A2ATask, A2AMessage, TaskState, TaskHandoff, TaskConfig, AgentTurnResult, RoutingResult
- [x] **AGENT-06**: Temp employee hire flow: `hire_employee` tool creates HireRequest, transitions task to `input-required` (metadata.inputType=hire_approval); on CEO approval, dept head re-invoked with employee as SDK AgentDefinition subagent; employee sandbox has read_knowledge, search_knowledge, promote_to_deliverable, propose_skill, submit_for_review only

### Custom Tools (MCP)

- [x] **TOOL-01**: Single in-process MCP server via `createSdkMcpServer({name:'myelin'})` with per-invocation ToolContext closure factory (`buildMyelinMcpServer(ctx)`) — no shared mutable state between concurrent agents
- [x] **TOOL-02**: `buildCanUseTool(agentId, department)` returns `(toolName,input) => {behavior:'allow'|'deny',message?}` — Tamir-only tools, dept-head-only tools, temp employee restrictions all enforced here
- [x] **TOOL-03**: `read_memory` / `write_memory` — reads/writes `data/agents/{agentId}/MEMORY.md` via tool boundary (file lives outside desk CWD)
- [x] **TOOL-04**: `promote_to_deliverable` — copies file from desk to `deliverables/`, creates/updates `deliverable_manifest.json`, indexes to FTS5 documents table
- [x] **TOOL-05**: `read_knowledge` / `write_knowledge` — reads/writes `data/departments/{dept}/knowledge/*.md`; write_knowledge updates FTS5 index; concurrent write protection via proper-lockfile
- [x] **TOOL-06**: `search_knowledge` — FTS5 BM25 search across vault + knowledge + task_deliverables; returns essence + file path (not full content); agent uses read_knowledge to load full file if needed
- [x] **TOOL-07**: `submit_for_review` — sets `currentActorId` to supervisorAgentId (task stays in `working` state; lifecycle derives to review)
- [x] **TOOL-08**: `approve_deliverable` (dept heads only) — sets `completedAt`, transitions task to `completed`, notifies Tamir inbox
- [x] **TOOL-09**: `request_changes` (dept heads only) — stores feedback in `reviewFeedback`, increments `reviewRound`, sets `currentActorId` back to executor
- [x] **TOOL-10**: `file_to_vault` (Tamir + dept heads) — copies file to `data/vault/`, upserts to documents table as source='vault', indexes FTS5
- [x] **TOOL-11**: `propose_skill` — creates `data/departments/{dept}/skills/{name}/SKILL.md` + supporting files with status:pending; upserts DB skill record; approval chain: dept head → CEO
- [x] **TOOL-12**: `read_inbox` (Tamir only) — reads and clears `data/agents/tamir/inbox.jsonl` with proper-lockfile; returns all pending notification events
- [x] **TOOL-13**: `get_dept_status` (Tamir only) — returns summary of active tasks per department
- [x] **TOOL-14**: `hire_employee` (dept heads only) — creates HireRequest record with taskId, transitions task to `input-required` with metadata.inputType=hire_approval

### Cortex UI

- [x] **UI-01**: Global CSS design system in `public/cortex.css`: all CSS variables from Doc 12 (--bg, --accent, --green, --amber, --border, --font), badge classes, button variants, card/panel styles, chat bubbles, build log entries, gallery cards, tabs — no Tailwind
- [x] **UI-02**: App layout (`app/layout.tsx`) with sidebar: 5 nav items (Dashboard ▣, Tamir ◐, Deliverables ◎, Org Context ◆, Vault ⬡), active state, logo + "v10 — The Cortex"
- [x] **UI-03**: Dashboard page: stats row (active agents, active tasks, pending approvals, deliverables), live agent status panel (colored dots by last activity), recent activity timeline (last 10 from activity_log)
- [x] **UI-04**: Deliverables gallery: card grid with title/dept badge/type badge/status/creator/date/preview; in-progress tasks at top with amber left border; dept filter tabs + search input
- [x] **UI-05**: Org Context page: dept tabs (Tech/Marketing/Operations); left column (Agent Memory collapsible cards, Knowledge Library expandable cards, Tools + Skills gallery); right column (employee cards with avatar/status/memory preview/past tasks accordion)
- [x] **UI-06**: Vault page: FTS5 search input (300ms debounce), document list with title/dept/filed_by/date, click to expand full rendered markdown
- [x] **UI-07**: Agent Profile stub (`/agents/[id]`): read-only card.json + MEMORY.md + recent task list with deliverable links
- [x] **UI-08**: Skill approval UI in Org Context: Approve / Submit to CEO / Dismiss buttons; `POST /api/skills/{skillId}/approve`, `POST /api/skills/{skillId}/submit-to-ceo`, `POST /api/skills/{skillId}/dismiss`
- [x] **UI-09**: Hire request approval: approve button visible in deliverable workspace build log when task is `input-required` with metadata.inputType=hire_approval
- [x] **UI-10**: SSE endpoint (`/api/sse`): streams task:transition, task:buildlog, task:heartbeat, task:review, hire:requested, agent:invoked events; removes listeners on stream cancel

### Tamir Interface (Plan Mode)

- [x] **TAMIR-01**: `/tamir` page: full-width chat initially; 40/60 split pane (chat left, canvas right) when plan is ready; agent avatars with dept colors (Tamir=red, CTO=blue, CMO=pink, COO=green)
- [x] **TAMIR-02**: `POST /api/tamir/route`: Tamir LLM routing with SDK structured output (routing schema), creates A2A Task with explicit actor roles (planningAgentId, executorAgentId, supervisorAgentId, currentActorId), returns {taskId, contextId, department, tamir_response}; Tamir is DONE after this call
- [x] **TAMIR-03**: `POST /api/tasks/[taskId]/message` (export maxDuration=120): routes to currentActorId, uses SDK structured output for turn type, appends to JSONL chat file, transitions task state; returns {state, agent_id, turn}
- [x] **TAMIR-04**: Canvas split pane: typewriter rendering (40-70ms/line via marked.js), raw markdown textarea edit mode, Save/Edit toggle; plan stored via `addArtifact()` when turn.type=plan_ready
- [x] **TAMIR-05**: Configuration panel on canvas: autonomy slider (Minimal/Balanced/High/Full), max budget input (USD, default $10), constraints textarea; `PUT /api/tasks/[taskId]/config`
- [x] **TAMIR-06**: `POST /api/tasks/[taskId]/approve`: creates NEW execution desk (separate from planning desk), injects selectedTools/selectedSkills into desk/CLAUDE.md under ## CEO Hints, creates Deliverable record, enqueues task_run row with status=queued, notifies Tamir inbox, redirects to /deliverables/{id}
- [x] **TAMIR-07**: Tool + skill gallery: VS Code extension card layout, 300ms debounce live search, source toggles (Company DB + MCP Registry mcphub.io + Glama for tools; Company DB + ClawHub for skills), cross-dept items grayed but selectable, CEO hint text input per selected item
- [x] **TAMIR-08**: `PUT /api/tasks/[taskId]/artifact` (update plan markdown), `GET /api/tasks/[taskId]` (full task state + derived lifecycle), `GET /api/tasks/[taskId]/chat` (load JSONL history), `POST /api/tasks/[taskId]/cancel`

### Deliverable Workspace

- [x] **DELIV-01**: `/deliverables/[id]` split-pane: 400px chat left, tabbed workspace right (Deliverable | Agent Log | Build Log | Files(N)); metadata bar above tabs (ID, creator, dept, type, created, task description)
- [x] **DELIV-02**: Chat panel: load + render planning JSONL history with correct avatars; "--- plan approved --- task executing ---" divider; agent greeting; continued chat via `POST /api/deliverables/[id]/chat` routing to currentActorId
- [x] **DELIV-03**: Deliverable tab: renders primaryFile from `deliverable_manifest.json` (markdown via marked.js, image, video with controls, PDF iframe); clear empty state when no primary file
- [x] **DELIV-04**: Build Log tab: live partial SDK events via SSE (`includePartialMessages:true`); expandable entries (chevron, type badge, agent, description, timestamp, metadata JSON); periodic heartbeat liveness entries
- [x] **DELIV-05**: Files tab: two sections (Deliverables prominent, Desk/Working Files collapsible default); card grid (icon, filename, size); inline preview on click (image/video/PDF/markdown/code); `GET /api/deliverables/[id]/file?path=...` with path traversal prevention (path.resolve + startsWith workspace root)
- [x] **DELIV-06**: Agent Log tab: durable SDK activity rows from activity_log table (SDK_SESSION_INIT, SDK_ASSISTANT, SDK_TOOL_PROGRESS, SDK_TOOL_SUMMARY, SDK_RESULT_SUCCESS, SDK_RESULT_ERROR); expandable metadata; action type badge colors from Doc 12
- [x] **DELIV-07**: Supervisor review flow: when executor calls submit_for_review (currentActorId → supervisor), system triggers supervisor agent invocation; supervisor calls approve_deliverable → task:completed or request_changes → currentActorId back to executor
- [x] **DELIV-08**: Skill extraction trigger: after supervisor approves deliverable, supervisor agent performs extraction pass using skill-extractor global skill; proposes reusable patterns via propose_skill tool

### Global Skills (Ship with System)

- [x] **GSKILL-01**: `memory-management` active global skill at `data/departments/global/skills/memory-management/SKILL.md` — teaches agents when/how to read_memory at task start and write_memory at task end
- [x] **GSKILL-02**: `skill-extractor` active global skill at `data/departments/global/skills/skill-extractor/SKILL.md` — teaches agents to analyze completed deliverables for reusable patterns and call propose_skill
- [x] **GSKILL-03**: `system-reset` active global skill at `data/departments/global/skills/system-reset/SKILL.md` — clears operational tables, preserves vault + DNA + skills + permanent employees

### Integration & Acceptance Tests

- [x] **INT-01**: LLM error handling: exponential backoff on 503 (2s/4s/8s + jitter), agent empty response retry once with nudge, tool execution failures logged + returned to agent
- [x] **INT-02**: Budget enforcement: SDK `maxBudgetUsd` on every `query()` call; on budget exceeded task → `input-required` with metadata.inputType=budget_increase; CEO can increase and resume
- [x] **INT-03**: System reset: clears task_runs, cost_events, activity_log, hire_requests, deliverables, tasks; deletes non-vault documents; resets employee spent budgets; terminates temp employees; preserves vault docs + DNA + skills + permanent employees
- [ ] **INT-04**: Acceptance Scenario A passes: AI-generated brand video for X — routes to CMO, agent discovers AI video tools via web search, produces video deliverable, skill extracted and approved, skill auto-triggers on second similar request
- [ ] **INT-05**: Acceptance Scenario B passes: EEG SVM classifier — routes to CTO, temp data scientist hired, real Python code executes in desk, real metrics and plots produced, CTO review gate works, all files viewable in workspace

### Langfuse Observability

- [x] **LANG-01**: `@langfuse/tracing@5.0.1` + `@langfuse/otel@5.0.1` + `@opentelemetry/sdk-node@0.214.0` + `@opentelemetry/api@1.9.1` installed via pnpm; single copy of `@opentelemetry/api` verified
- [x] **LANG-02**: `src/lib/langfuse.ts` singleton module: `initLangfuse()` initializes OTel NodeSDK with `LangfuseSpanProcessor` on `globalThis.__langfuseOtelSdk` (HMR-safe); `isLangfuseEnabled()` returns true when `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` env vars present; conditional activation -- silently disabled when keys absent
- [x] **LANG-03**: `initLangfuse()` called in `instrumentation.ts` between orchestrator init and worker loop start (OTel must be ready before any agent invocations)
- [x] **LANG-04**: `withAgentObservation()` wraps `invokeAgent()` query loop: creates one Langfuse agent observation per invocation with metadata (taskId, agentId, department, soulExcerpt, prompt excerpt); deterministic traceId from `createTraceId(taskId)` so all invocations for same task nest under one trace; `propagateAttributes()` sets userId='founder', sessionId=taskId, tags=[department, agentId]
- [x] **LANG-05**: Fail-silent design: all Langfuse operations wrapped in try/catch with Pino warn logging; Langfuse SDK background queue handles async batching/retry; agent execution never blocked by Langfuse unavailability
- [x] **LANG-06**: `GET /api/system/info` returns `langfuseStatus: 'active'|'inactive'` based on env var presence
- [x] **LANG-07**: Settings page (`src/app/settings/page.tsx`) shows "Observability" badge with green dot (`var(--green)`) when active, muted dot (`var(--text-muted)`) when inactive, matching existing Worker status dot pattern

### Agent Sandboxing

- [ ] **SANDBOX-01**: `buildCanUseTool()` extended with `workspaceBoundaries` parameter; built-in tools (Read, Write, Edit, Glob, Grep) denied when targeting absolute paths outside `deskDir` or `delivDir`; `isPathAllowed()` helper resolves relative paths against deskDir before checking boundaries
- [ ] **SANDBOX-02**: Bash tool file operations denied when command contains absolute paths outside workspace boundaries; relative paths allowed (resolve within CWD); no restrictions on bash commands themselves per D-08
- [ ] **SANDBOX-03**: `invokeAgent()` passes `settingSources: []` (not `['project']`) and passes `{ deskDir, delivDir }` workspace boundaries to `buildCanUseTool()` for all invocations
- [x] **SANDBOX-04**: `createTaskWorkspace()` writes approved plan to separate `desk/PLAN.md` file; `desk/CLAUDE.md` is a minimal pointer with task context, MCP tool reference, workspace boundary reminder, and pointer to PLAN.md
- [x] **SANDBOX-05**: Planning desks get their own `CLAUDE.md` with planning mode instructions; combined with `settingSources: []`, agent's entire instruction set comes from workspace CLAUDE.md only per D-07

## v2 Requirements

Deferred to next milestone.

### Cross-Agent Coordination

- **COORD-01**: Cross-department consultation: `consult_agent` tool (CTO/CMO/COO only) creates child A2A task, routes to target dept head, returns answer; multi-turn via contextId
- **COORD-02**: Tamir 15-minute cron: processes inbox.jsonl, updates MEMORY.md project registry, identifies stalled tasks, escalates to CEO if needed

### Extended UI

- **EXTUI-01**: Org Chart page
- **EXTUI-02**: Budget tracking page (per-agent monthly spend)
- **EXTUI-03**: Standalone Skills management page
- **EXTUI-04**: Company DNA editor in UI
- **EXTUI-05**: SSE streaming for plan generation (vs one-shot JSON)
- **EXTUI-06**: A2A HTTP/JSON-RPC transport for external agent discovery

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-tenancy / authentication | Single-user localhost system — no auth surface needed |
| Vector databases (ChromaDB, Mem0) | SQLite FTS5 sufficient for single-user search needs |
| Docker / serverless deployment | Persistent self-hosted Node.js only; serverless is architecturally incompatible with worker loop |
| Tailwind CSS / UI frameworks | Custom CSS variables are Myelin's identity — never Bootstrap/Tailwind |
| React state management libraries | Server Components + minimal client state only |
| WebSocket / Socket.IO | SSE is simpler, one-directional, native to Next.js |
| Python in application layer | TypeScript-only; agents may run Python scripts in their desk via SDK bash tool |
| Microservices / separate API server | Single Next.js process |
| Visual workflow builder | Not appropriate for the technical founder use case |
| Chat-first UI (no persistent state) | Deliverable-centric OS, not a chat app |
| Multi-model support | Claude via AWS Bedrock only for v10; env vars control provider |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| FOUND-06 | Phase 1 | Complete |
| FOUND-07 | Phase 1 | Complete |
| FOUND-08 | Phase 1 | Complete |
| FOUND-09 | Phase 1 | Complete |
| FOUND-10 | Phase 1 | Complete |
| FOUND-11 | Phase 1 | Complete |
| AGENT-01 | Phase 2 | Complete |
| AGENT-02 | Phase 2 | Complete |
| AGENT-03 | Phase 2 | Complete |
| AGENT-04 | Phase 2 | Complete |
| AGENT-05 | Phase 2 | Complete |
| AGENT-06 | Phase 2 | Complete |
| TOOL-01 | Phase 2 | Complete |
| TOOL-02 | Phase 2 | Complete |
| TOOL-03 | Phase 2 | Complete |
| TOOL-04 | Phase 2 | Complete |
| TOOL-05 | Phase 2 | Complete |
| TOOL-06 | Phase 2 | Complete |
| TOOL-07 | Phase 2 | Complete |
| TOOL-08 | Phase 2 | Complete |
| TOOL-09 | Phase 2 | Complete |
| TOOL-10 | Phase 2 | Complete |
| TOOL-11 | Phase 2 | Complete |
| TOOL-12 | Phase 2 | Complete |
| TOOL-13 | Phase 2 | Complete |
| TOOL-14 | Phase 2 | Complete |
| GSKILL-01 | Phase 2 | Complete |
| GSKILL-02 | Phase 2 | Complete |
| GSKILL-03 | Phase 2 | Complete |
| UI-01 | Phase 3 | Complete |
| UI-02 | Phase 3 | Complete |
| UI-03 | Phase 3 | Complete |
| UI-04 | Phase 3 | Complete |
| UI-05 | Phase 3 | Complete |
| UI-06 | Phase 3 | Complete |
| UI-07 | Phase 3 | Complete |
| UI-08 | Phase 3 | Complete |
| UI-09 | Phase 3 | Complete |
| UI-10 | Phase 3 | Complete |
| TAMIR-01 | Phase 3 | Complete |
| TAMIR-02 | Phase 3 | Complete |
| TAMIR-03 | Phase 3 | Complete |
| TAMIR-04 | Phase 3 | Complete |
| TAMIR-05 | Phase 3 | Complete |
| TAMIR-06 | Phase 3 | Complete |
| TAMIR-07 | Phase 3 | Complete |
| TAMIR-08 | Phase 3 | Complete |
| DELIV-01 | Phase 4 | Complete |
| DELIV-02 | Phase 4 | Complete |
| DELIV-03 | Phase 4 | Complete |
| DELIV-04 | Phase 4 | Complete |
| DELIV-05 | Phase 4 | Complete |
| DELIV-06 | Phase 4 | Complete |
| DELIV-07 | Phase 4 | Complete |
| DELIV-08 | Phase 4 | Complete |
| INT-01 | Phase 4 | Complete |
| INT-02 | Phase 4 | Complete |
| INT-03 | Phase 4 | Complete |
| INT-04 | Phase 4 | Pending |
| INT-05 | Phase 4 | Pending |
| LANG-01 | Phase 5 | Complete |
| LANG-02 | Phase 5 | Complete |
| LANG-03 | Phase 5 | Complete |
| LANG-04 | Phase 5 | Complete |
| LANG-05 | Phase 5 | Complete |
| LANG-06 | Phase 5 | Complete |
| LANG-07 | Phase 5 | Complete |
| SANDBOX-01 | Phase 6 | Pending |
| SANDBOX-02 | Phase 6 | Pending |
| SANDBOX-03 | Phase 6 | Pending |
| SANDBOX-04 | Phase 6 | Complete |
| SANDBOX-05 | Phase 6 | Complete |

**Coverage:**
- v1 requirements: 77 total
- Mapped to phases: 77
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-27 after Phase 6 planning*
