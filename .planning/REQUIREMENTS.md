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

- [ ] **AGENT-01**: `invokeAgent()` wrapper around SDK `query()`: uses `systemPrompt: {type:'preset', preset:'claude_code', append:soul}` for CLAUDE.md auto-load, stores session_id AND absolute cwd in task record, streams partial messages for build log, logs cost to cost_events table
- [ ] **AGENT-02**: Orchestrator singleton holding configs for all 4 agents; `invoke()` method exposes outputFormat, agents, maxBudgetUsd, cwd, sessionId options
- [ ] **AGENT-03**: Self-contained agent directories (`src/agents/{tamir,cto,cmo,coo}/`): soul.md + card.json + agent.ts for each; 4 executive employees seeded to DB
- [ ] **AGENT-04**: SDK structured output (`outputFormat: {type:'json_schema',schema:...}`) for ALL turn routing — no regex, no freeform parsing; planning turn schema and routing result schema defined in `src/a2a/types.ts`
- [ ] **AGENT-05**: A2A TypeScript interfaces: AgentCard, A2ATask, A2AMessage, TaskState, TaskHandoff, TaskConfig, AgentTurnResult, RoutingResult
- [ ] **AGENT-06**: Temp employee hire flow: `hire_employee` tool creates HireRequest, transitions task to `input-required` (metadata.inputType=hire_approval); on CEO approval, dept head re-invoked with employee as SDK AgentDefinition subagent; employee sandbox has read_knowledge, search_knowledge, promote_to_deliverable, propose_skill, submit_for_review only

### Custom Tools (MCP)

- [ ] **TOOL-01**: Single in-process MCP server via `createSdkMcpServer({name:'myelin'})` with per-invocation ToolContext closure factory (`buildMyelinMcpServer(ctx)`) — no shared mutable state between concurrent agents
- [ ] **TOOL-02**: `buildCanUseTool(agentId, department)` returns `(toolName,input) => {behavior:'allow'|'deny',message?}` — Tamir-only tools, dept-head-only tools, temp employee restrictions all enforced here
- [ ] **TOOL-03**: `read_memory` / `write_memory` — reads/writes `data/agents/{agentId}/MEMORY.md` via tool boundary (file lives outside desk CWD)
- [ ] **TOOL-04**: `promote_to_deliverable` — copies file from desk to `deliverables/`, creates/updates `deliverable_manifest.json`, indexes to FTS5 documents table
- [ ] **TOOL-05**: `read_knowledge` / `write_knowledge` — reads/writes `data/departments/{dept}/knowledge/*.md`; write_knowledge updates FTS5 index; concurrent write protection via proper-lockfile
- [ ] **TOOL-06**: `search_knowledge` — FTS5 BM25 search across vault + knowledge + task_deliverables; returns essence + file path (not full content); agent uses read_knowledge to load full file if needed
- [ ] **TOOL-07**: `submit_for_review` — sets `currentActorId` to supervisorAgentId (task stays in `working` state; lifecycle derives to review)
- [ ] **TOOL-08**: `approve_deliverable` (dept heads only) — sets `completedAt`, transitions task to `completed`, notifies Tamir inbox
- [ ] **TOOL-09**: `request_changes` (dept heads only) — stores feedback in `reviewFeedback`, increments `reviewRound`, sets `currentActorId` back to executor
- [ ] **TOOL-10**: `file_to_vault` (Tamir + dept heads) — copies file to `data/vault/`, upserts to documents table as source='vault', indexes FTS5
- [ ] **TOOL-11**: `propose_skill` — creates `data/departments/{dept}/skills/{name}/SKILL.md` + supporting files with status:pending; upserts DB skill record; approval chain: dept head → CEO
- [ ] **TOOL-12**: `read_inbox` (Tamir only) — reads and clears `data/agents/tamir/inbox.jsonl` with proper-lockfile; returns all pending notification events
- [ ] **TOOL-13**: `get_dept_status` (Tamir only) — returns summary of active tasks per department
- [ ] **TOOL-14**: `hire_employee` (dept heads only) — creates HireRequest record with taskId, transitions task to `input-required` with metadata.inputType=hire_approval

### Cortex UI

- [ ] **UI-01**: Global CSS design system in `public/cortex.css`: all CSS variables from Doc 12 (--bg, --accent, --green, --amber, --border, --font), badge classes, button variants, card/panel styles, chat bubbles, build log entries, gallery cards, tabs — no Tailwind
- [ ] **UI-02**: App layout (`app/layout.tsx`) with sidebar: 5 nav items (Dashboard ▣, Tamir ◐, Deliverables ◎, Org Context ◆, Vault ⬡), active state, logo + "v10 — The Cortex"
- [ ] **UI-03**: Dashboard page: stats row (active agents, active tasks, pending approvals, deliverables), live agent status panel (colored dots by last activity), recent activity timeline (last 10 from activity_log)
- [ ] **UI-04**: Deliverables gallery: card grid with title/dept badge/type badge/status/creator/date/preview; in-progress tasks at top with amber left border; dept filter tabs + search input
- [ ] **UI-05**: Org Context page: dept tabs (Tech/Marketing/Operations); left column (Agent Memory collapsible cards, Knowledge Library expandable cards, Tools + Skills gallery); right column (employee cards with avatar/status/memory preview/past tasks accordion)
- [ ] **UI-06**: Vault page: FTS5 search input (300ms debounce), document list with title/dept/filed_by/date, click to expand full rendered markdown
- [ ] **UI-07**: Agent Profile stub (`/agents/[id]`): read-only card.json + MEMORY.md + recent task list with deliverable links
- [ ] **UI-08**: Skill approval UI in Org Context: Approve / Submit to CEO / Dismiss buttons; `POST /api/skills/{skillId}/approve`, `POST /api/skills/{skillId}/submit-to-ceo`, `POST /api/skills/{skillId}/dismiss`
- [ ] **UI-09**: Hire request approval: approve button visible in deliverable workspace build log when task is `input-required` with metadata.inputType=hire_approval
- [ ] **UI-10**: SSE endpoint (`/api/sse`): streams task:transition, task:buildlog, task:heartbeat, task:review, hire:requested, agent:invoked events; removes listeners on stream cancel

### Tamir Interface (Plan Mode)

- [ ] **TAMIR-01**: `/tamir` page: full-width chat initially; 40/60 split pane (chat left, canvas right) when plan is ready; agent avatars with dept colors (Tamir=red, CTO=blue, CMO=pink, COO=green)
- [ ] **TAMIR-02**: `POST /api/tamir/route`: Tamir LLM routing with SDK structured output (routing schema), creates A2A Task with explicit actor roles (planningAgentId, executorAgentId, supervisorAgentId, currentActorId), returns {taskId, contextId, department, tamir_response}; Tamir is DONE after this call
- [ ] **TAMIR-03**: `POST /api/tasks/[taskId]/message` (export maxDuration=120): routes to currentActorId, uses SDK structured output for turn type, appends to JSONL chat file, transitions task state; returns {state, agent_id, turn}
- [ ] **TAMIR-04**: Canvas split pane: typewriter rendering (40-70ms/line via marked.js), raw markdown textarea edit mode, Save/Edit toggle; plan stored via `addArtifact()` when turn.type=plan_ready
- [ ] **TAMIR-05**: Configuration panel on canvas: autonomy slider (Minimal/Balanced/High/Full), max budget input (USD, default $10), constraints textarea; `PUT /api/tasks/[taskId]/config`
- [ ] **TAMIR-06**: `POST /api/tasks/[taskId]/approve`: creates NEW execution desk (separate from planning desk), injects selectedTools/selectedSkills into desk/CLAUDE.md under ## CEO Hints, creates Deliverable record, enqueues task_run row with status=queued, notifies Tamir inbox, redirects to /deliverables/{id}
- [ ] **TAMIR-07**: Tool + skill gallery: VS Code extension card layout, 300ms debounce live search, source toggles (Company DB + MCP Registry mcphub.io + Glama for tools; Company DB + ClawHub for skills), cross-dept items grayed but selectable, CEO hint text input per selected item
- [ ] **TAMIR-08**: `PUT /api/tasks/[taskId]/artifact` (update plan markdown), `GET /api/tasks/[taskId]` (full task state + derived lifecycle), `GET /api/tasks/[taskId]/chat` (load JSONL history), `POST /api/tasks/[taskId]/cancel`

### Deliverable Workspace

- [ ] **DELIV-01**: `/deliverables/[id]` split-pane: 400px chat left, tabbed workspace right (Deliverable | Agent Log | Build Log | Files(N)); metadata bar above tabs (ID, creator, dept, type, created, task description)
- [ ] **DELIV-02**: Chat panel: load + render planning JSONL history with correct avatars; "--- plan approved --- task executing ---" divider; agent greeting; continued chat via `POST /api/deliverables/[id]/chat` routing to currentActorId
- [ ] **DELIV-03**: Deliverable tab: renders primaryFile from `deliverable_manifest.json` (markdown via marked.js, image, video with controls, PDF iframe); clear empty state when no primary file
- [ ] **DELIV-04**: Build Log tab: live partial SDK events via SSE (`includePartialMessages:true`); expandable entries (chevron, type badge, agent, description, timestamp, metadata JSON); periodic heartbeat liveness entries
- [ ] **DELIV-05**: Files tab: two sections (Deliverables prominent, Desk/Working Files collapsible default); card grid (icon, filename, size); inline preview on click (image/video/PDF/markdown/code); `GET /api/deliverables/[id]/file?path=...` with path traversal prevention (path.resolve + startsWith workspace root)
- [ ] **DELIV-06**: Agent Log tab: durable SDK activity rows from activity_log table (SDK_SESSION_INIT, SDK_ASSISTANT, SDK_TOOL_PROGRESS, SDK_TOOL_SUMMARY, SDK_RESULT_SUCCESS, SDK_RESULT_ERROR); expandable metadata; action type badge colors from Doc 12
- [ ] **DELIV-07**: Supervisor review flow: when executor calls submit_for_review (currentActorId → supervisor), system triggers supervisor agent invocation; supervisor calls approve_deliverable → task:completed or request_changes → currentActorId back to executor
- [ ] **DELIV-08**: Skill extraction trigger: after supervisor approves deliverable, supervisor agent performs extraction pass using skill-extractor global skill; proposes reusable patterns via propose_skill tool

### Global Skills (Ship with System)

- [x] **GSKILL-01**: `memory-management` active global skill at `data/departments/global/skills/memory-management/SKILL.md` — teaches agents when/how to read_memory at task start and write_memory at task end
- [x] **GSKILL-02**: `skill-extractor` active global skill at `data/departments/global/skills/skill-extractor/SKILL.md` — teaches agents to analyze completed deliverables for reusable patterns and call propose_skill
- [x] **GSKILL-03**: `system-reset` active global skill at `data/departments/global/skills/system-reset/SKILL.md` — clears operational tables, preserves vault + DNA + skills + permanent employees

### Integration & Acceptance Tests

- [ ] **INT-01**: LLM error handling: exponential backoff on 503 (2s/4s/8s + jitter), agent empty response retry once with nudge, tool execution failures logged + returned to agent
- [ ] **INT-02**: Budget enforcement: SDK `maxBudgetUsd` on every `query()` call; on budget exceeded task → `input-required` with metadata.inputType=budget_increase; CEO can increase and resume
- [ ] **INT-03**: System reset: clears task_runs, cost_events, activity_log, hire_requests, deliverables, tasks; deletes non-vault documents; resets employee spent budgets; terminates temp employees; preserves vault docs + DNA + skills + permanent employees
- [ ] **INT-04**: Acceptance Scenario A passes: AI-generated brand video for X — routes to CMO, agent discovers AI video tools via web search, produces video deliverable, skill extracted and approved, skill auto-triggers on second similar request
- [ ] **INT-05**: Acceptance Scenario B passes: EEG SVM classifier — routes to CTO, temp data scientist hired, real Python code executes in desk, real metrics and plots produced, CTO review gate works, all files viewable in workspace

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
| AGENT-01 | Phase 2 | Pending |
| AGENT-02 | Phase 2 | Pending |
| AGENT-03 | Phase 2 | Pending |
| AGENT-04 | Phase 2 | Pending |
| AGENT-05 | Phase 2 | Pending |
| AGENT-06 | Phase 2 | Pending |
| TOOL-01 | Phase 2 | Pending |
| TOOL-02 | Phase 2 | Pending |
| TOOL-03 | Phase 2 | Pending |
| TOOL-04 | Phase 2 | Pending |
| TOOL-05 | Phase 2 | Pending |
| TOOL-06 | Phase 2 | Pending |
| TOOL-07 | Phase 2 | Pending |
| TOOL-08 | Phase 2 | Pending |
| TOOL-09 | Phase 2 | Pending |
| TOOL-10 | Phase 2 | Pending |
| TOOL-11 | Phase 2 | Pending |
| TOOL-12 | Phase 2 | Pending |
| TOOL-13 | Phase 2 | Pending |
| TOOL-14 | Phase 2 | Pending |
| GSKILL-01 | Phase 2 | Complete |
| GSKILL-02 | Phase 2 | Complete |
| GSKILL-03 | Phase 2 | Complete |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| UI-06 | Phase 3 | Pending |
| UI-07 | Phase 3 | Pending |
| UI-08 | Phase 3 | Pending |
| UI-09 | Phase 3 | Pending |
| UI-10 | Phase 3 | Pending |
| TAMIR-01 | Phase 3 | Pending |
| TAMIR-02 | Phase 3 | Pending |
| TAMIR-03 | Phase 3 | Pending |
| TAMIR-04 | Phase 3 | Pending |
| TAMIR-05 | Phase 3 | Pending |
| TAMIR-06 | Phase 3 | Pending |
| TAMIR-07 | Phase 3 | Pending |
| TAMIR-08 | Phase 3 | Pending |
| DELIV-01 | Phase 4 | Pending |
| DELIV-02 | Phase 4 | Pending |
| DELIV-03 | Phase 4 | Pending |
| DELIV-04 | Phase 4 | Pending |
| DELIV-05 | Phase 4 | Pending |
| DELIV-06 | Phase 4 | Pending |
| DELIV-07 | Phase 4 | Pending |
| DELIV-08 | Phase 4 | Pending |
| INT-01 | Phase 4 | Pending |
| INT-02 | Phase 4 | Pending |
| INT-03 | Phase 4 | Pending |
| INT-04 | Phase 4 | Pending |
| INT-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 65 total
- Mapped to phases: 65
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*
