# Roadmap: Myelin v10 — The Cortex

## Overview

Myelin v10 delivers a functioning AI company operating system where autonomous agents execute real business tasks end-to-end. The build follows hard architectural dependencies: foundation infrastructure first (database, state machine, worker loop), then the agent execution layer (SDK integration, MCP tools, workspace isolation), then the full CEO-facing interface (Cortex UI + Tamir routing in one phase since they share SSE and state contracts), and finally the deliverable workspace with end-to-end acceptance testing. Four phases, each delivering a verifiable capability layer that the next phase depends on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation Infrastructure** - Database, state machine, SSE bus, worker loop, and project bootstrap
- [ ] **Phase 2: Agent Execution Layer** - SDK integration, MCP tool server, workspace isolation, agent identity, and global skills
- [ ] **Phase 3: Cortex UI + Tamir Interface** - Six core pages, CSS design system, Tamir routing, planning flow, and tool gallery
- [ ] **Phase 4: Deliverable Workspace + Integration** - Split-pane workspace, supervisor review, skill extraction, and acceptance scenarios

## Phase Details

### Phase 1: Foundation Infrastructure
**Goal**: A runnable Next.js application with correct SQLite configuration, task state machine, SSE event bus, worker loop, and FTS5 search — the substrate every other component depends on
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, FOUND-11
**Success Criteria** (what must be TRUE):
  1. Running `pnpm dev` starts a Next.js server at localhost:3000 with TypeScript strict mode, Prisma client generated, and SQLite database created with all tables
  2. FTS5 virtual table exists and survives server restart (instrumentation.ts safety net recreates if missing)
  3. Task state transitions enforce valid A2A state graph — invalid transitions are rejected atomically
  4. Worker loop polls task_runs table, respects concurrency cap, heartbeats every 15s, and marks stale runs as failed on startup
  5. SSE endpoint at /api/sse streams events to connected clients and cleans up on disconnect
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Project bootstrap + Prisma schema + database + utilities
- [x] 01-02-PLAN.md — FTS5 full-text search + A2A state machine + SSE event bus
- [x] 01-03-PLAN.md — Task workspace creation + planning desks + company DNA template
- [x] 01-04-PLAN.md — Worker loop + instrumentation.ts bootstrap

### Phase 2: Agent Execution Layer
**Goal**: Agents actually execute tasks — SDK query() runs in isolated workspaces with MCP tools, cost tracking, session resume, and role-based access control
**Depends on**: Phase 1
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, AGENT-06, TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06, TOOL-07, TOOL-08, TOOL-09, TOOL-10, TOOL-11, TOOL-12, TOOL-13, TOOL-14, GSKILL-01, GSKILL-02, GSKILL-03
**Success Criteria** (what must be TRUE):
  1. An agent can be invoked via invokeAgent() and executes in an isolated desk directory with symlinked skills, producing output files
  2. All 16 custom MCP tools are registered and enforce role-based access — a temp employee cannot call dept-head-only tools, Tamir-only tools reject other agents
  3. Agent sessions resume correctly across restarts (session_id + absolute cwd stored and reused)
  4. Cost is tracked per invocation in cost_events table and budget limits are enforced via SDK maxBudgetUsd
  5. Four executive agent directories exist with soul.md + card.json + agent.ts, seeded to the database, and can be invoked through the orchestrator
**Plans**: 6 plans

Plans:
- [x] 02-01-PLAN.md — A2A types + MCP server factory + core tools (memory, knowledge, deliverable) + access control
- [x] 02-02-PLAN.md — Agent identity (4 executives: soul.md, card.json, agent.ts) + DB seed
- [ ] 02-03-PLAN.md — invokeAgent() wrapper + orchestrator singleton + worker integration + concurrent isolation validation
- [ ] 02-04-PLAN.md — Remaining MCP tools (review, vault, skills, inbox, hire) + server update
- [ ] 02-05-PLAN.md — Hire approval API endpoints + structured output schemas
- [x] 02-06-PLAN.md — 3 global skills (memory-management, skill-extractor, system-reset)

### Phase 3: Cortex UI + Tamir Interface
**Goal**: The CEO can interact with the system through a complete web dashboard and submit tasks through Tamir's planning flow — route, plan, configure, and approve for execution
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, TAMIR-01, TAMIR-02, TAMIR-03, TAMIR-04, TAMIR-05, TAMIR-06, TAMIR-07, TAMIR-08
**Success Criteria** (what must be TRUE):
  1. All six core pages render with the custom CSS design system — Dashboard shows live agent status and activity, Deliverables shows card gallery, Org Context shows department tabs with agent/knowledge/skill panels, Vault shows FTS5 search results
  2. CEO can type a task request on the /tamir page and Tamir routes it to the correct department via LLM structured output
  3. Planning conversation proceeds as multi-turn chat with the department head, plan appears on the canvas with typewriter rendering, and CEO can edit the plan
  4. CEO can configure autonomy level, max budget, constraints, select tools/skills with hints, and approve the plan — approval creates an execution desk, enqueues a task_run, and redirects to the deliverable page
  5. SSE-driven live updates flow to the dashboard (agent status, activity timeline) and Tamir page (task state changes)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Deliverable Workspace + Integration
**Goal**: The CEO can monitor executing tasks in real-time, review deliverables, and the full system passes end-to-end acceptance scenarios proving agents do real work
**Depends on**: Phase 3
**Requirements**: DELIV-01, DELIV-02, DELIV-03, DELIV-04, DELIV-05, DELIV-06, DELIV-07, DELIV-08, INT-01, INT-02, INT-03, INT-04, INT-05
**Success Criteria** (what must be TRUE):
  1. /deliverables/[id] shows split-pane workspace with chat history (including planning phase), deliverable preview, live build log via SSE, agent activity log, and file browser with inline preview
  2. Supervisor review flow works end-to-end: executor submits for review, supervisor is auto-invoked, supervisor approves or requests changes, task transitions correctly
  3. Skill extraction triggers after task completion — supervisor analyzes deliverables and proposes reusable skills via propose_skill
  4. Acceptance Scenario A passes: a task routes to CMO, agent discovers tools, produces a video deliverable, and a skill is extracted
  5. Acceptance Scenario B passes: a task routes to CTO, a temp employee is hired, real Python executes in the desk, real metrics/plots are produced, and the CTO review gate works
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Infrastructure | 4/4 | Complete | - |
| 2. Agent Execution Layer | 0/6 | Planned | - |
| 3. Cortex UI + Tamir Interface | 0/3 | Not started | - |
| 4. Deliverable Workspace + Integration | 0/3 | Not started | - |
