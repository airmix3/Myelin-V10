# Myelin v10 — The Cortex

## What This Is

Myelin v10 is a TypeScript/Next.js "one-man company" operating system for Omer Shalev, sole founder of Myelin (a neurotech startup building BDaS — Brain Data as a Service). It is a system of autonomous AI agents (Tamir as Chief of Staff, CTO, CMO, COO, and dynamically hired temp employees) that execute real business tasks end-to-end: research, code, deployment, content, analysis. The CEO interacts through The Cortex — a web dashboard at localhost:3000 — and the agents do the work.

This is NOT a chatbot. It is a functioning company with hierarchy, budgets, skills, deliverables, task state machines, and accountability. Every task flows through planning (CEO <-> dept head), approval, execution (agent in a sandboxed desk), supervisor review, and delivery.

## Core Value

Agents actually execute real business tasks end-to-end — write and run real code, call real APIs, produce real deliverables — not just generate text. If everything else fails, this must work.

## Requirements

### Validated

#### Phase 1: Foundation Infrastructure

- [x] Next.js 14 App Router project initialized with TypeScript strict mode and pnpm — *Validated in Phase 1*
- [x] Prisma 7 + SQLite (WAL mode) + better-sqlite3 dual-access adapter — all 10 tables created — *Validated in Phase 1*
- [x] FTS5 virtual table + sync triggers (INSERT/DELETE/UPDATE) + BM25 search — *Validated in Phase 1*
- [x] Task state machine: 6 A2A states, atomic transitions, activity logging — *Validated in Phase 1*
- [x] SSE event bus singleton + `/api/sse` streaming endpoint with abort cleanup — *Validated in Phase 1*
- [x] Worker loop: 2s polling, optimistic locking, max 3 concurrent, 15s heartbeat, stale recovery on startup — *Validated in Phase 1*
- [x] `instrumentation.ts` startup hook: FTS5 init, planning desks, DNA first-boot copy, worker start — *Validated in Phase 1*
- [x] Company DNA template at `config/company-dna.template.md` — production-quality, no placeholders — *Validated in Phase 1*
- [x] `generateId(prefix)` utility using `randomBytes(4).toString('hex')` — *Validated in Phase 1*
- [x] `createTaskWorkspace()` + `ensurePlanningDesks()` with dept structure and symlinks — *Validated in Phase 1*

### Active

#### Foundation
- [ ] Next.js 14 App Router project initialized with TypeScript strict mode and pnpm
- [ ] Prisma + SQLite schema with all 9 tables (employees, tasks, task_runs, deliverables, hire_requests, cost_events, skills, mcp_servers, documents, activity_log)
- [ ] FTS5 virtual table + sync triggers for full-text search across vault/knowledge/deliverables
- [ ] `invokeAgent()` wrapper around Claude Agent SDK `query()` with session resume, cost tracking, and activity logging
- [ ] Orchestrator singleton holding all 4 agent configs (tamir, cto, cmo, coo) — no class hierarchy
- [ ] Agent directories (soul.md + card.json + agent.ts) for all 4 executives
- [ ] Worker loop: DB-backed job queue (task_runs table), concurrent execution, heartbeat, stale-run recovery on restart
- [ ] Tamir cron: invoked every 15 minutes to process inbox and maintain project registry
- [ ] `instrumentation.ts` startup hook for worker loop + Tamir cron + FTS init
- [ ] Company DNA template at `config/company-dna.template.md`, copied to `data/vault/company-dna.md` on first boot

#### A2A Protocol + Tools
- [ ] A2A TypeScript interfaces: AgentCard, A2ATask, A2AMessage, TaskState, TaskHandoff, TaskConfig, AgentTurnResult, RoutingResult
- [ ] Task state machine with standard A2A states only (submitted, working, input-required, completed, failed, canceled) — no custom states
- [ ] `transitionTask()` with valid-transition enforcement, DB update, and activity logging
- [ ] LLM-based routing in Tamir using SDK structured output (not keyword matching)
- [ ] Department library filesystem structure: `data/departments/{tech,marketing,operations,global}/`
- [ ] `createTaskWorkspace()`: creates desk/ + deliverables/, symlinks active dept + global skills, writes CLAUDE.md
- [ ] Planning desk per department at `data/departments/{dept}/planning-desk/` with .claude/skills/ symlinks
- [ ] Custom Myelin tools via single in-process MCP server (`createSdkMcpServer`): read_memory, write_memory, read_inbox, promote_to_deliverable, read_knowledge, write_knowledge, search_knowledge, file_to_vault, consult_agent, hire_employee, submit_for_review, approve_deliverable, request_changes, propose_skill, get_dept_status
- [ ] Role-based tool access control via `canUseTool` callback (single server, runtime enforcement)
- [ ] ToolContext closure factory: per-invocation context (taskId, agentId, dept, paths) injected into all tools
- [ ] `consultAgent()`: A2A cross-department consultation with multi-turn support
- [ ] SDK subagent provisioning for temp employees (AgentDefinition, not custom process)
- [ ] Deliverable manifest (`deliverable_manifest.json`) created at workspace approval, updated by promote_to_deliverable

#### Cortex UI (6 Core Pages)
- [ ] Global CSS design system from `public/cortex.css`: CSS variables, badges, buttons, cards, chat bubbles, tabs, gallery cards, build log entries, markdown render styles
- [ ] `app/layout.tsx` with sidebar (5 nav items: Dashboard, Tamir, Deliverables, Org Context, Vault)
- [ ] SSE endpoint (`/api/sse`) streaming task:transition, task:buildlog, task:heartbeat, hire:requested events
- [ ] Dashboard page: stats row, live agent status panel, recent activity timeline
- [ ] Deliverables gallery page: card grid, in-progress tasks at top with amber border, dept filter + search
- [ ] Org Context page: dept tabs, left column (agent memory, knowledge library, tools/skills gallery), right column (employee cards with past tasks accordion)
- [ ] Vault page: FTS5 search, document list, expandable markdown content
- [ ] Agent Profile stub page (`/agents/[id]`): read-only card.json + MEMORY.md + task history
- [ ] Skill approval UI in Org Context: Approve / Submit to CEO / Dismiss buttons

#### Tamir Interface (Plan Mode)
- [ ] `/tamir` page: full-width chat evolving to 40/60 split pane when plan is ready
- [ ] `POST /api/tamir/route`: Tamir LLM routing with structured output, creates A2A Task, returns taskId + routing buttons
- [ ] `POST /api/tasks/[taskId]/message`: routes to current planning actor, SDK structured output for turn type, saves to chat JSONL, transitions task state
- [ ] Canvas split pane: typewriter plan rendering (40-70ms/line), raw markdown edit mode, Save/Edit toggle
- [ ] Configuration panel: autonomy slider (Minimal/Balanced/High/Full), max budget input, constraints text
- [ ] Tool + skill gallery: VS Code extension card layout, live 300ms debounce search, source toggles (Company / MCP Registry / Glama / ClawHub), CEO hint text per selection
- [ ] `PUT /api/tasks/[taskId]/config` and `PUT /api/tasks/[taskId]/artifact`
- [ ] `POST /api/tasks/[taskId]/approve`: creates task execution desk (separate from planning desk), injects CEO hints into CLAUDE.md + extraSystemPrompt, creates deliverable record, enqueues task_run, redirects to /deliverables/[id]
- [ ] Chat history stored as filesystem JSONL; `GET /api/tasks/[taskId]/chat` reads from correct JSONL file

#### Deliverable Workspace
- [ ] `/deliverables/[id]` split-pane: 400px chat left, tabbed workspace right
- [ ] Chat panel: restored planning history from JSONL, participant avatars, divider, agent greeting, continued chat routing to currentActorId
- [ ] Deliverable tab: renders primaryFile from deliverable_manifest.json (markdown, image, video, PDF)
- [ ] Agent Log tab: durable SDK activity entries from activity_log table (SDK_SESSION_INIT, SDK_ASSISTANT, SDK_TOOL_PROGRESS, SDK_RESULT_SUCCESS, etc.)
- [ ] Build Log tab: live partial SDK events via SSE + includePartialMessages:true, expandable entries, heartbeat liveness
- [ ] Files tab: two sections (Deliverables prominent, Desk/Working Files collapsible), card grid, inline preview per file type
- [ ] `GET /api/deliverables/[id]/file?path=...` with path traversal prevention
- [ ] Supervisor review flow: executor finishes -> currentActorId = supervisor -> supervisor invoked -> approve or request_changes
- [ ] Skill extraction trigger after task completion (skill-extractor global skill)

#### Global Skills (Ship with System)
- [ ] `memory-management` global skill: read/write MEMORY.md at task start/end
- [ ] `skill-extractor` global skill: analyze deliverables for reusable patterns, propose via propose_skill
- [ ] `system-reset` global skill: clears operational tables, preserves vault + DNA + skills

#### Integration + Acceptance Tests
- [ ] Error handling: LLM 503 exponential backoff (3 retries: 2s/4s/8s), budget exceeded -> input-required, empty response retry
- [ ] System reset utility (preserves vault + DNA + skills + permanent employees)
- [ ] Acceptance Scenario A: AI-generated brand video for X (CMO + tool discovery + skill creation)
- [ ] Acceptance Scenario B: EEG SVM classifier (CTO + real Python code execution + temp employee hire + deliverable charts)

### Out of Scope

- HTTP/JSON-RPC A2A transport — v10 uses internal function calls only; HTTP transport is v10.1+
- Org Chart, Sessions, Budget, standalone Skills page, DNA editor pages — deferred to v10.1
- Mobile responsiveness — single-user localhost, not a priority
- Multi-user authentication — single-user system, no auth on Cortex
- External vector database (ChromaDB, Mem0) — SQLite FTS5 is sufficient for v10
- Docker/serverless deployment — persistent self-hosted Node.js only
- Real-time streaming plan generation over SSE — one-shot JSON response first; SSE streaming is v10.1 enhancement
- OAuth/magic-link for the product itself — this system IS the company OS, not BDaS

## Context

Myelin is a neurotech startup building BDaS (Brain Data as a Service) — a privacy-first BCI integration layer. The founder Omer Shalev has a background in cryptography (Prime Minister's Office elite unit) and neuroscience research (EEG/fMRI, Prof. Amir Amedi's lab, Hebrew University). The company is in a 300-day sprint at pre-seed stage.

Previous versions (v1-v5) were Python. v10 is a full TypeScript rewrite to leverage:
- Anthropic's TypeScript Agent SDK as first-class
- Next.js App Router (SSR + API routes in one framework)
- A2A protocol (Google's Agent-to-Agent spec) for inter-agent communication
- Single-language full stack

The agent system IS the entire company workforce. Every real business task — EEG research, AWS deployments, content creation, project planning — flows through this system.

**AWS Bedrock** is the current LLM provider (using existing AWS infrastructure). Configured via `CLAUDE_CODE_USE_BEDROCK=1` + AWS credentials in `.env`. Zero provider-specific code — the Claude Agent SDK reads env vars automatically.

## Constraints

- **Tech Stack**: TypeScript/Node.js only — no Python in the application layer (agents may run Python scripts via SDK bash tool in their desk)
- **CSS**: Custom CSS variables only — no Tailwind, no Bootstrap, no CSS frameworks
- **LLM Provider**: AWS Bedrock via CLAUDE_CODE_USE_BEDROCK=1 initially
- **Runtime**: Persistent self-hosted Node.js only — not designed for serverless or edge runtimes
- **Database**: SQLite (local file, no external services required) via Prisma
- **A2A States**: Standard A2A states only — submitted, working, input-required, completed, failed, canceled. No custom states.
- **SDK First**: Use Claude Agent SDK built-ins before any custom implementation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude Agent SDK `query()` exclusively for all agent execution | Official SDK handles tool loop, sessions, skills, cost tracking — no reimplementation needed | — Pending |
| Single in-process MCP server for all custom tools, `canUseTool` for access control | Avoids per-role server proliferation; access enforced at runtime | — Pending |
| SDK `outputFormat` structured output for all turn routing | Eliminates regex/heuristic parsing bugs; SDK guarantees valid JSON | — Pending |
| LLM-based routing in Tamir (not keyword/tag scoring) | Handles ambiguity, adapts to new departments, uses company DNA as truth | — Pending |
| Filesystem JSONL for chat history (not SQLite columns) | Append-only, no queries needed, survives DB migrations | — Pending |
| MEMORY.md per agent over vector DB | Simpler, agent-owned, survives system resets | — Pending |
| SQLite FTS5 over ChromaDB/Mem0 | Zero external services, sufficient for single-user search needs | — Pending |
| Department library filesystem over DB-stored content | Enables SDK native skill discovery, agent desk isolation, symlink-based skill sharing | — Pending |
| Task lifecycle derived from timestamps + currentActorId (no phase field) | Follows A2A spec; planning/execution/review are derived, not stored | — Pending |
| Temp employees as SDK subagents (AgentDefinition) | SDK manages lifecycle, no custom provisioning process needed | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-26 after Phase 2: Agent Execution Layer — invokeAgent(), 14 MCP tools, 4 executive agents, RBAC, hire flow, structured output schemas complete*
