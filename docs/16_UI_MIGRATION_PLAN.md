# UI Migration Plan: Cortex V1 → Cortex V2

## Overview

Migrate the current Cortex V1 UI (custom CSS, React 18, Next.js 14) to the Cortex V2 glass-morphism UI (Tailwind 4, Framer Motion, React 19-style components) while preserving all existing backend functionality. The new UI lives at `~/Cortex-V2-Frontend/`.

**Principle**: Only wire features that have working backend implementations. Drop spec-only features from the new UI. For old-UI features without a V2 equivalent, build them in the V2 theme.

---

## Terminology Mapping

The V2 UI uses different names for the same backend concepts:

| V2 UI Term | V1 / Backend Term | Notes |
|---|---|---|
| Mission | Task | `tasks` table in DB. V2 calls them "missions" everywhere. |
| MissionPlan | task.planMarkdown | V1 stores plan as markdown on the task record |
| DispatchRun | task_run | `task_runs` table. V2 calls execution "dispatch" |
| DispatchStep | (not modeled) | V1 doesn't have per-step tracking; execution is atomic per agent |
| Deliverable | Deliverable | Same concept, same table |
| Escalation | Escalation | Same concept, same table |
| Founder | CEO | V2 calls the user "founder" |
| Thread | Conversation / Chat | V1 uses conversation IDs and JSONL chat files |
| Agent | Employee/Agent | V1 has both `employees` and `agents` tables |
| Vault | Vault + Knowledge | V1 vault is in `data/vault/` and knowledge in `data/departments/*/knowledge/` |

---

## Layout & Navigation Migration

### AppShell + Sidebar

**V2 Source**: `~/Cortex-V2-Frontend/src/components/layout/AppShell.tsx`, `Sidebar.tsx`
**V1 Source**: `src/app/layout.tsx`, `src/components/Sidebar.tsx`

**Plan**: Replace V1's simple sidebar with V2's collapsible glass sidebar. Map navigation groups:

| V2 Nav Group | V2 Items | V1 Equivalent | Action |
|---|---|---|---|
| CEO Desk | Tamir, Calendar, Deliverables, Think | Tamir, Deliverables | Keep Tamir + Deliverables. **Drop Calendar** (no backend). **Drop Think** (no backend). |
| Command | Home, Control Center, Escalations | Dashboard, Escalations | Home = Dashboard. **Drop Control Center** (no backend for agent orchestration dashboard; fold live activity into Dashboard). Escalations = Escalations. |
| Agents | People, Workspace, Evaluations | Org Context, Agents | People = new roster page (data from `/api/org-context/[dept]`). **Keep Workspace** — shows active running tasks with deep per-task view (see Section 3 below). **Drop Evaluations** (no backend). |
| Intelligence | Vault, Timeline, Missions | Vault, Search, Deliverables | Vault = Vault. **Drop Timeline** (no audit log backend yet). **Drop Missions** (redundant with Deliverables). |
| System | Terminal, Settings | Settings | Terminal = agent logs (reuse build log). Settings = Settings. **Note**: Tools and Skills are NOT standalone pages — they live inside Org Context per department (see Section 8). |
| Docs | Docs, Manifesto, Guide, etc. | (none) | **Drop all** (no content backend). |

**Additional V1 pages to carry over in V2 theme:**
- **Routines** → Add to Command group (backend: `/api/routines`)
- **Assets** → Add to Intelligence group (backend: `/api/assets`)
- **Org Context** → Keep as its own page (backend: `/api/org-context/[dept]`). Retains the V1 structure: department tabs with employees, agent memories, knowledge, skills, and tools all per-department. Styled in V2 glass theme.
- **Org Graph** → Embed in People page or keep as standalone (backend: `/api/org-graph`)

### StatusBar

**V2 Source**: `~/Cortex-V2-Frontend/src/components/layout/StatusBar.tsx`
**V1 Source**: Dashboard hero stats in `src/app/DashboardClient.tsx`

**Plan**: Adopt V2 StatusBar as persistent bottom strip. Wire to existing data:
- Active Agents → count from `/api/org-context/[dept]` employee records with status=active
- Tasks Completed → count from DB tasks with state=completed
- Deliverables → count from DB deliverables
- System Uptime → derive from worker started timestamp

### CommandPalette

**V2 Source**: `~/Cortex-V2-Frontend/src/components/layout/CommandPalette.tsx`
**V1 Source**: `/search` page + `SearchClient.tsx`

**Plan**: Replace dedicated search page with V2's Cmd+K command palette. Wire to existing search endpoint:
- Skills search: `GET /api/search/skills?q=...`
- Tools search: `GET /api/search/tools?q=...`
- Full search: `POST /api/search`

---

## Page-by-Page Migration

### 1. Home (Dashboard)

**V2 Source**: `~/Cortex-V2-Frontend/src/app/page.tsx` + center-board components
**V1 Source**: `src/app/page.tsx` + `src/app/DashboardClient.tsx`
**V1 API**: SSE `/api/sse`, DB queries for stats

#### Components to Adopt

| V2 Component | What It Shows | Backend Hook |
|---|---|---|
| MissionBoard | Kanban of tasks by status | DB query: tasks grouped by state. Map V1 states (submitted/working/completed/failed) to V2 columns (act-now/approve-decide/review). |
| MissionCard | Individual task card | Task record: title, department, assignee, state, deliverable count. CTA = current action (approve plan, view deliverable, etc.) |
| StatusBar | Metrics strip | Same stats as V1 hero banner |
| EscalationBanner | Pending escalation count/preview | `GET /api/escalations?status=pending` |

#### MissionBoard Column Mapping

| V2 Column | V1 Task States | Description |
|---|---|---|
| act-now | `submitted`, `working` | Tasks needing attention or in progress |
| approve-decide | `input-required` | Tasks waiting for CEO input (plan approval, escalation) |
| review | `completed` | Completed tasks to review deliverables |

#### Activity Overlay

V1 has a real-time activity log overlay on the dashboard (tool use, agent invocations). V2 doesn't have an exact equivalent on the home page.

**Plan**: Add a compact LiveActivityFeed component (adapted from V2's `LiveActivityFeed.tsx`) to the home page. Wire to existing SSE events:
- `task:heartbeat` → agent alive indicator
- `agent:invoked` → agent started event
- `task:transition` → task state change
- `task:buildlog` → tool execution

#### What to Drop from V2 Home
- TamirPanel right rail (V1 doesn't have Tamir suggestions on dashboard)
- Focus Mode / Deep Work Mode layouts (no backend for layout preference persistence beyond localStorage)
- AmbientBg animation (keep if lightweight, drop if heavy)

---

### 2. Tamir Chat

**V2 Source**: `~/Cortex-V2-Frontend/src/components/tamir/TamirChatPage.tsx` + subcomponents
**V1 Source**: `src/app/tamir/page.tsx`
**V1 APIs**: `/api/tamir/consult`, `/api/tamir/consult/[conversationId]`, `/api/tamir/route`, `/api/tamir/conversations`, `/api/tamir/chats`, `/api/tasks/[taskId]/message`, `/api/tasks/[taskId]/approve`, `/api/tasks/[taskId]/cancel`

This is the most complex migration. V1's Tamir page is a single mega-component handling consultation, routing, planning, approval, and execution. V2 splits this into modular components with rich message types.

#### Chat Flow Mapping

| V1 Flow Step | V1 Trigger | V2 Component | V2 Wiring |
|---|---|---|---|
| New consultation | Type message, no active task | ChatInput → `POST /api/tamir/consult` | Send message, receive classification (task_detected or chat) |
| Follow-up consultation | Type message, active conversation | ChatInput → `POST /api/tamir/consult/[conversationId]` | Continue conversation thread |
| Task routing | Tamir returns `routing_buttons` | **ActionConfirmation** or custom routing component | Show department buttons (CTO/CMO/COO). Click → `POST /api/tamir/route` |
| Asset selection | After routing | V1's AssetTargetSelector (port to V2 theme) | Show asset picker. Selection → first `POST /api/tasks/[id]/message` |
| Planning turns | Agent asks questions | **PlanningQuestions** component | Display question, collect answer → `POST /api/tasks/[id]/message` |
| Plan ready | Agent returns plan_ready | **MissionBriefSummary** + CanvasPanel | Show plan markdown in canvas. Approve button visible. |
| Plan approval | Click "Approve" | **ActionConfirmation** → `POST /api/tasks/[id]/approve` | Creates deliverable + task_run, starts execution |
| Execution streaming | After approval | **LiveExecutionPanel** | SSE `task:buildlog` events render as execution steps |
| Execution complete | Agent finishes | **MissionReport** or completion message | `agent:completed` SSE event. Show deliverable link. |
| Cancel task | Click cancel | Button → `POST /api/tasks/[id]/cancel` | Confirmation dialog, then cancel |

#### V2 Message Type → V1 Backend Event Mapping

| V2 Message Type | When to Render | V1 Data Source |
|---|---|---|
| TextBubble | Consultation responses, general chat | Tamir consult response with classification=chat |
| MissionBriefSummary | After routing, task created | Response from `/api/tamir/route` with task summary |
| DispatchFlow | After approval, showing execution plan | Task's planMarkdown rendered as steps |
| PlanningQuestions | Agent asks clarifying question | Agent turn with type=question from `/api/tasks/[id]/message` |
| ActionConfirmation | Routing buttons, approval prompts | Routing buttons from Tamir, plan_ready state |
| EscalationAlert | Escalation created during execution | SSE `escalation:created` event |
| AgentDeliverable | Agent produces file | Deliverable record after execution completes |
| HandoffCTA | Tamir suggests connecting to dept head | Can reuse routing_buttons concept |

#### ChatSidebar

**V2 Source**: `~/Cortex-V2-Frontend/src/components/tamir/ChatSidebar.tsx`
**V1 Source**: `src/components/ChatSidebar.tsx`

Wire to:
- `GET /api/tamir/conversations` → list threads
- `POST /api/tamir/chats` → list past task chats
- Thread selection → load conversation history

#### CanvasPanel (Plan View)

**V2 Source**: `~/Cortex-V2-Frontend/src/components/tamir/PlanningCanvas.tsx`
**V1 Source**: `src/components/CanvasPanel.tsx`

V1's canvas shows plan markdown with typewriter animation. V2's PlanningCanvas is more interactive (drag-drop steps, skill/tool toggles).

**Plan**: Use V2's visual style but keep V1's read-only markdown rendering (since the backend only stores `planMarkdown` as a string, not structured steps). The plan is produced by the agent, not edited by the CEO.

Wire to: `task.planMarkdown` from task record after plan_ready.

#### What to Drop from V2 Tamir
- PlanningCanvas drag-and-drop editing (no backend for structured plan editing)
- ContextPanel (no backend for mission/agent context lookup from chat)
- CampaignFlowDiagram (no backend for multi-step flow visualization)
- MorningBrief message type (no backend for daily summaries)
- DepartmentSummary message type (no backend for department health snapshots)
- PushNotification message type (notifications not implemented)
- Voice input (no backend for speech-to-text)
- File attachments in chat input (no backend for file upload in chat)

---

### 3. Workspace (Active Task Deep View)

**V2 Source**: `~/Cortex-V2-Frontend/src/app/workspace/page.tsx`
**V1 Source**: `src/app/deliverables/[id]/WorkspaceClient.tsx` (closest equivalent — the deliverable workspace split view)
**V1 APIs**: `GET /api/tasks/[taskId]`, `GET /api/tasks/[taskId]/chat`, SSE `/api/sse` (buildlog, activity), `GET /api/escalations?taskId=...`, `GET /api/deliverables/[id]/file`, `POST /api/deliverables/[id]/chat`, `POST /api/hire_requests/[id]/approve|reject`, `POST /api/tasks/[taskId]/budget`

The Workspace page shows **only actively running tasks** — tasks that have been approved and are currently being executed by an agent (i.e. tasks with an active `task_run`, not tasks in planning/ideation/conversation). Each task is owned by a department head (CTO/CMO/COO).

A **tab bar at the top** lets the CEO switch between active tasks (similar to V2's mission selector tabs).

#### Layout: 3-Column for Each Active Task

##### LEFT COLUMN (~22%)

From top to bottom:

| Section | Backend Hook | Notes |
|---|---|---|
| **Task Description** | `task.description` from DB | Full description of what this task is about |
| **Owner** | `task.currentActorId` → employee record | The dept head agent in charge. Show avatar, name, role, department. |
| **Open Escalations** | `GET /api/escalations?status=pending` filtered by taskId | All escalations blocking this task. Each shows type, urgency, summary. If none, show "No open escalations". (V2 mockup called this "Blockers" — rename to "Open Escalations".) |
| **Budget** | Token usage from SDK cost tracking in `cost_events` table | **Current**: actual tokens/cost consumed so far. **Projection**: show "N/A" (not yet implemented — keep the box for future use). **Limit**: `task.maxBudgetUsd` from DB. Display as a visual progress bar. |
| **Activity Log** | `activityLog` records from DB + SSE `task:activity` events | Scrollable log of everything the agent is doing. Color-coded entries by type: tools (one color), assistant messages (another), skills, loading states. Same format as V1's AgentLogPanel but in V2 glass theme. This log extends beneath all the above sections and fills remaining vertical space. |

**Removed from V2 mockup**: Escalation Path box (not needed), Background box (not needed — reclaim space for activity log).

##### CENTER COLUMN (~48%)

From top to bottom:

| Section | Backend Hook | Notes |
|---|---|---|
| **CEO Decisions** (conditional) | `hireRequests` with status=pending, escalations needing response | Only shown if the task has pending decisions (hire request approvals, escalation responses, budget increases). If none, this section is hidden and everything below shifts up. Shows action cards with approve/reject/respond buttons. |
| **Agent Reasoning** | (not yet implemented) | Keep the bounding box but show "Not available" inside. Future: will show agent's thinking steps. |
| **Agents** | Currently 1 agent per task | Show the executor agent card. Keep space for multiple agents in the future. |
| **Age / Metrics** | `task.createdAt`, deliverable count | Time since task started execution, number of deliverables produced. |
| **Deliverables** | `deliverables` table filtered by taskId | Show every deliverable produced via the `promote_deliverable` tool. Each shows: file name, type icon, status badge (**Ready**, **Approved**, **Not Approved**, **In Progress**). Clicking a deliverable opens it (file preview or download via `GET /api/deliverables/[id]/file`). Note: during active execution, this may be empty — show "No deliverables yet" placeholder. |

**Removed from V2 mockup**: Impact Analysis (not needed — reclaim space for deliverables).

##### RIGHT COLUMN (~28%)

| Section | Backend Hook | Notes |
|---|---|---|
| **Chat with Executor** | `GET/POST /api/deliverables/[id]/chat` or `POST /api/tasks/[taskId]/message` | Embedded chat panel — a compact version of V1's WorkspaceChatPanel. Already in the context of this task. The same chat is accessible from the Deliverables detail page. Shows Tamir header with task context, message thread, quick prompts, and text input. |

#### Tab Selector (Top)

A horizontal tab bar showing all currently active tasks:
- Each tab: priority dot + task title + department badge
- Active tab highlighted
- Data: query `task_runs` where status = 'running', join with tasks

---

### 4. Deliverables

**V2 Source**: `~/Cortex-V2-Frontend/src/app/tamir/deliverables/` (file browser)
**V1 Source**: `src/app/deliverables/page.tsx` + `DeliverablesClient.tsx`, `src/app/deliverables/[id]/page.tsx` + `WorkspaceClient.tsx`
**V1 APIs**: `GET /api/deliverables/[id]/chat`, `GET /api/deliverables/[id]/file`, `POST /api/deliverables/[id]/promote`

#### Deliverables List

Adopt V2's visual styling (glass cards, V2 badges, V2 color palette) but keep V1's card-based layout with department tab filtering. Each deliverable card shows:
- Title (from deliverable record)
- Type icon (document/code/etc. from deliverable type)
- Status badge (in-progress/completed/reviewed/failed)
- Department badge
- Creator agent
- Date

Data source: Server-side query on `deliverables` table, same as V1.

#### Deliverable Detail/Workspace (Split View)

**Keep the V1 split-view format** — this is the proven layout. Do NOT use V2's file-browser style for the detail view. Port to V2 glass theme but preserve V1's layout structure:

**Left half**: Chat panel (WorkspaceChatPanel) — full-height chat with the task executor agent.

**Right half**: Tabbed workspace panel with:

| Tab | V1 Component | Backend Hook |
|---|---|---|
| Deliverable | DeliverablePanel (file preview/content) | `GET /api/deliverables/[id]/file` with primaryFile |
| Agent Log | AgentLogPanel (color-coded activity entries) | DB `activityLog` records + SSE `task:activity` |
| Files | FilesPanel (workspace file browser) | `GET /api/deliverables/[id]/file?list=true` |

Above the tabs: MetadataBar showing deliverable ID, creator, department, type, date, task description.

Header actions:
- "Promote to Asset" button (`POST /api/deliverables/[id]/promote`)
- Hire request approval cards (if pending) — `POST /api/hire_requests/[id]/approve|reject`
- Budget increase action — `POST /api/tasks/[taskId]/budget`

The key difference from the Workspace page: the Deliverable detail focuses on a **single deliverable's output and files**, while the Workspace focuses on the **running task as a whole** (budget, escalations, all deliverables, activity).

---

### 5. Escalations

**V2 Source**: `~/Cortex-V2-Frontend/src/app/escalations/page.tsx`
**V1 Source**: `src/app/escalations/page.tsx` + `EscalationsClient.tsx`
**V1 APIs**: `GET /api/escalations`, `POST /api/escalations/[id]/respond`, `POST /api/escalations/[id]/resolve`

#### Component Mapping

| V2 Escalation Feature | V1 Equivalent | Action |
|---|---|---|
| Level badges (L1-L4) | Type badges (critical, needs-info, etc.) | Map V1 escalation types to L1-L4 levels. Or add a `level` field to escalation records. |
| Priority badges | Urgency badges | Same concept, rename |
| Escalation chain (person pills) | Agent ID display | V1 shows originator agent. V2 shows chain. Use single agent for now. |
| Send Directive | Custom response textarea | `POST /api/escalations/[id]/respond` with `{content, resolution_type: "directive"}` |
| Resolve | Dismiss | `POST /api/escalations/[id]/resolve` |
| Defer | (not in V1) | **New**: Add `POST /api/escalations/[id]/defer` endpoint or use respond with type=defer |
| Ask Tamir | (not in V1) | **New**: Open Tamir chat with escalation context. `POST /api/tamir/consult` with escalation reference. |
| Level threshold filter | (not in V1) | Frontend-only filter via SettingsContext |

#### What to Drop from V2 Escalations
- `deferred_until` scheduling (no cron to re-surface deferred escalations)
- Skill gap and financial impact fields (not in V1 schema)

---

### 6. People (Agent Roster)

**V2 Source**: `~/Cortex-V2-Frontend/src/app/people/page.tsx`
**V1 Source**: No direct equivalent (agents shown in Org Context)
**V1 APIs**: `/api/org-context/[dept]` returns employees, `/api/agents/[id]`

**Plan**: New page in V2 theme showing agent roster. Data from Org Context endpoint.

| V2 Feature | Backend Hook |
|---|---|
| Agent cards with avatar, name, role | Employee records from `/api/org-context/[dept]` for each dept |
| Status dot (active/busy/idle) | Derive from SSE heartbeats or last task_run state |
| Current task display | Latest task_run record for each agent |
| Department badge | Employee department field |
| Type badge (executive/permanent/temp) | Employee role field |

Click agent card → navigate to `/agents/[id]`.

---

### 7. Agent Detail

**V2 Source**: `~/Cortex-V2-Frontend/src/app/agents/[id]/page.tsx`
**V1 Source**: `src/app/agents/[id]/page.tsx`
**V1 API**: `GET /api/agents/[id]`

#### Section Mapping

| V2 Section | V1 Data Source | Action |
|---|---|---|
| Profile (bio, type, dept) | card.json from agent directory | Wire to `/api/agents/[id]` |
| Skills list | card.json skills array | Wire to same |
| Memory | MEMORY.md content | Wire to same (already in V1 API response) |
| Recent Tasks | DB tasks by agent | Wire to same |
| Performance charts | (not in V1) | **Drop** — no performance metrics backend |
| Weekly Activity bars | (not in V1) | **Drop** |
| Evaluations | (not in V1) | **Drop** |

---

### 8. Org Context (Department Hub — Skills & Tools Embedded)

**V2 Source**: Borrow V2 glass styling, but keep V1's organizational structure
**V1 Source**: `src/app/org-context/page.tsx`
**V1 APIs**: `GET /api/org-context/[dept]`, plus skills and tools mutation endpoints

This page keeps the V1 concept: a **single page with department tabs** (Tech, Marketing, Operations). Each department tab shows its employees, agent memories, knowledge library, skills, and tools — all in one view. This is NOT decomposed into separate Skills/Tools pages.

Style in V2 glass theme but preserve V1's information architecture.

#### Per-Department Sections

| Section | V1 Data Source | Backend Hook | Notes |
|---|---|---|---|
| **Employees** | Employee records | `GET /api/org-context/[dept]` → employees | Agent cards with avatar, name, role, status, memory preview, past tasks. Click → `/agents/[id]`. |
| **Agent Memories** | MEMORY.md per agent | `GET /api/org-context/[dept]` → agentMemories | Expandable sections showing each agent's memory content (markdown rendered). |
| **Knowledge Library** | `data/departments/[dept]/knowledge/` | `GET /api/org-context/[dept]` → knowledgeFiles | Expandable articles written by agents. |
| **Skills** | Skill records per department | `GET /api/org-context/[dept]` → skills | Skill cards in a grid. Actions: create, approve, submit-to-CEO, dismiss, refresh, remove. |
| **Tools** | Tool records per department | `GET /api/org-context/[dept]` → tools | Tool cards in a grid. Actions: install, refresh, remove. |

#### Skills Actions (embedded in Org Context)

| Action | Backend Hook |
|---|---|
| Create skill | `POST /api/org-context/[dept]/skills/create` (modal with description textarea) |
| Approve skill | `POST /api/skills/[skillId]/approve` |
| Submit to CEO | `POST /api/skills/[skillId]/submit-to-ceo` |
| Dismiss skill | `POST /api/skills/[skillId]/dismiss` |
| Refresh skill | `POST /api/org-context/[dept]/skills/[id]/refresh` |
| Remove skill | `POST /api/org-context/[dept]/skills/[id]/remove` |

#### Tools Actions (embedded in Org Context)

| Action | Backend Hook |
|---|---|
| Install tool | `POST /api/org-context/[dept]/tools/install` (modal with package name + hint) |
| Refresh tool | `POST /api/org-context/[dept]/tools/[name]/refresh` |
| Remove tool | `POST /api/org-context/[dept]/tools/[name]/remove` |

#### What to Drop from V2 Skills/Tools Pages
- NexusCore graph, QuestBoard, XP/Level progression, SkillsTamirPanel (no backend)
- OAuth connect/disconnect for tools (V1 tools are MCP-based, not OAuth)
- TamirToolsChat (no tool-specific chat backend)
- Standalone `/skills` and `/tools` routes (everything lives in Org Context)

---

### 9. Vault (unchanged)

**V2 Source**: `~/Cortex-V2-Frontend/src/app/vault/page.tsx`
**V1 Source**: `src/app/vault/page.tsx` + `VaultClient.tsx`
**V1 API**: `POST /api/vault/search`

| V2 Feature | V1 Backend | Action |
|---|---|---|
| Entry cards with category icons | Vault documents from filesystem | Wire to vault search |
| Category filter (mission/strategy/decision/policy/preference/knowledge) | V1 vault has simpler categories | Map V1 categories to V2 icons |
| Search | `POST /api/vault/search` | Wire search input |
| Tag system | (partially in V1) | Display tags if available in vault entry metadata |

---

### 10. Terminal

**V2 Source**: `~/Cortex-V2-Frontend/src/app/terminal/page.tsx`
**V1 Source**: No exact equivalent (build log is per-deliverable)
**V1 API**: SSE `/api/sse` for `task:buildlog` events, `GET /api/terminal/[runId]`

**Plan**: Adopt V2 terminal page. Wire to:
- SSE `task:buildlog` events (all agents, not filtered by task)
- Agent selector tabs filter by agent ID
- Log entries show timestamp + tool_name + detail from buildlog events

---

### 11. Settings

**V2 Source**: `~/Cortex-V2-Frontend/src/app/settings/page.tsx`
**V1 Source**: `src/app/settings/page.tsx`
**V1 API**: `GET /api/system/info`, `POST /api/system/reset`

**Plan**: Merge V1 and V2 settings:

| Section | Source | Backend |
|---|---|---|
| Layout presets (overview/focus/deep-work) | V2 | Frontend-only (localStorage) |
| Escalation threshold | V2 | Frontend-only (localStorage) |
| Status bar metrics config | V2 | Frontend-only (localStorage) |
| Nav group visibility | V2 | Frontend-only (localStorage) |
| System info (Node version, DB path, worker status) | V1 | `GET /api/system/info` |
| Reset system | V1 | `POST /api/system/reset` |

---

## Features to Build in V2 Theme (V1-only, no V2 equivalent)

These features exist in V1 with working backends but have no V2 counterpart. Build them in V2's glass-morphism style.

### 12. Routines Page

**V1 Source**: `src/app/routines/page.tsx` + `RoutinesClient.tsx`
**V1 APIs**: `GET /api/routines`, `POST /api/routines/[routineId]/approve`, `POST /api/routines/[routineId]/trigger`

**Plan**: Create `/routines` page in V2 theme. Add to Command nav group.
- Routine cards with glass-card styling
- Name, schedule, last run, status badges (V2 badge style)
- Approve/Trigger buttons (V2 button style)
- No complex UI needed — straightforward card list

### 13. Assets Page

**V1 Source**: `src/app/assets/page.tsx` + `AssetsClient.tsx`
**V1 APIs**: `GET /api/assets`, `/api/assets/[assetId]/chat`, `/api/assets/[assetId]/annotations`

**Plan**: Create `/assets` page in V2 theme. Add to Intelligence nav group.
- Asset cards with type/status badges
- Detail view with chat panel (reuse V2 chat components)
- Annotation interface

### 14. Org Graph

**V1 Source**: `src/app/org-graph/page.tsx`
**V1 API**: `GET /api/org-graph`

**Plan**: Embed org graph visualization in the People page as a toggle view (list vs graph). Or keep as standalone `/org-graph` route.

---

## Features to DROP from V2 (no backend implementation)

These are spec'd in `BACKEND_FEATURE_SPEC.md` and/or have V2 UI components, but have no working backend. Remove from the migrated UI.

| Feature | V2 Components | Why Drop |
|---|---|---|
| Think Sessions | ThinkPage, ThinkingInput, ThinkingStream, SessionList, InsightsPanel | No `/api/think/*` backend |
| Calendar | `/tamir/calendar` | No calendar backend |
| Evaluations | `/evaluations` page | No evaluation/review backend |
| Control Center (full) | AgentDependencyGraph, MissionTheater | No agent orchestration dashboard backend. Reuse LiveActivityFeed on dashboard. |
| Timeline page | `/timeline` | No audit trail backend (`timeline_events` table doesn't exist) |
| Missions page | `/missions` | Redundant with Deliverables tab (overlapping intent confirmed) |
| Standalone Skills page | `/skills` | Skills are embedded per-department in Org Context, not standalone |
| Standalone Tools page | `/tools` | Tools are embedded per-department in Org Context, not standalone |
| Onboarding flow | OnboardingChat | No onboarding backend |
| Docs pages | manifesto, guide, metabolism, onboarding | No content backend |
| Structured MissionPlan editing | PlanningCanvas drag-drop | Backend stores plan as markdown string, not structured steps |
| DispatchStep approval/redirect | Step-level approval UI | V1 execution is atomic per agent, not step-by-step |
| MissionReport with grades | Reviewer scores, learnings | No report/learning backend |
| Tool OAuth flows | Connect/disconnect with OAuth | V1 tools are MCP-based, not OAuth |
| DeliverableRevisionRequest | Revision request form | No revision request backend |
| AgentSkill proficiency cycling | Skill detail with XP | V1 skills are simple approve/dismiss |
| Vault entry creation from UI | "Push to Vault" flow | V1 vault is filesystem-based, no write API |

---

## CSS/Styling Migration

### Current V1 Approach
- Custom CSS in `public/cortex.css` with CSS variables
- No framework

### V2 Approach
- Tailwind CSS 4 + CSS variables in `globals.css`
- Framer Motion for animations
- Glass morphism design system

### Migration Strategy
1. Install Tailwind CSS 4 and Framer Motion in the myelin-gsd project
2. Copy V2's `globals.css` (color palette, glass effects, shadows)
3. Port components one page at a time, converting V2's Tailwind classes
4. Remove old `cortex.css` classes as pages are migrated
5. **Important**: CLAUDE.md says "no Tailwind" — this constraint needs CEO approval to override for V2 migration

### Constraint Conflict: Tailwind Ban

CLAUDE.md explicitly bans Tailwind CSS. Options:
1. **Override**: Update CLAUDE.md to allow Tailwind since V2 uses it
2. **Convert**: Port V2 components from Tailwind to custom CSS variables (significant effort)
3. **Hybrid**: Use Tailwind for V2 components, keep custom CSS for existing backend code

**Recommendation**: Option 1 — override the constraint. The V2 UI is designed around Tailwind and converting would defeat the purpose of adopting it.

---

## React Version

V1 uses React 18 (required by Next.js 14). V2 uses React 19.

**Plan**: Stay on React 18 / Next.js 14 for now. V2 components don't use React 19-specific features (no `use()`, no server actions). Framer Motion and Tailwind 4 work with React 18.

---

## Dependencies to Add

```
pnpm add tailwindcss@4 framer-motion lucide-react
```

Optional (evaluate if V2 uses it meaningfully):
```
pnpm add liquid-glass-react
```

---

## Migration Order

Execute in this order to get visible progress quickly while minimizing risk:

### Phase 1: Foundation
1. Install Tailwind 4, Framer Motion, Lucide React
2. Port V2 globals.css (color palette, glass effects)
3. Port AppShell + Sidebar (navigation structure)
4. Port StatusBar
5. Port CommandPalette (replaces /search page)

### Phase 2: Dashboard
6. Port Home page with MissionBoard
7. Wire MissionCard to task data
8. Add activity log overlay (adapted from V2 LiveActivityFeed)
9. Wire StatusBar metrics to existing endpoints

### Phase 3: Tamir Chat (Core Flow)
10. Port TamirChatPage layout (sidebar + thread + canvas)
11. Port ChatInput, ChatThread, ChatSidebar
12. Wire consultation flow (consult → route → plan → approve)
13. Port message type components (TextBubble, ActionConfirmation, PlanningQuestions)
14. Port CanvasPanel for plan display
15. Wire execution streaming (LiveExecutionPanel with SSE buildlog events)

### Phase 4: Workspace (Active Task View)
16. Build Workspace page with 3-column layout
17. Wire task selector tabs (query active task_runs)
18. Wire left column: task description, owner, open escalations, budget, activity log
19. Wire center column: CEO decisions (conditional), agent placeholder, deliverables (promote_deliverable tool output)
20. Wire right column: embedded executor chat (reuse WorkspaceChatPanel)

### Phase 5: Deliverables
21. Port deliverables list with V2 glass styling (keep V1 card layout + department tabs)
22. Port deliverable detail as V1 split-view in V2 theme (chat left, tabs right: deliverable/agent-log/files)
23. Wire all deliverable APIs + promote-to-asset + hire request approvals

### Phase 6: Escalations
24. Port escalation cards with V2 styling
25. Wire respond/resolve/dismiss
26. Add level badges and priority badges

### Phase 7: Agents & Org Context
27. Port People page (agent roster)
28. Port Agent detail page
29. Port Org Context page in V2 theme (department tabs with employees, memories, knowledge, skills, tools)
30. Wire all org-context, skills, and tools APIs

### Phase 8: Remaining Pages
31. Port Vault page
32. Port Terminal page
33. Build Routines page in V2 theme
34. Build Assets page in V2 theme
35. Port Settings page (merge V1 system info + V2 layout settings)
36. Embed Org Graph in People page

### Phase 9: Cleanup
37. Remove old V1 components
38. Remove old cortex.css
39. Update CLAUDE.md with new conventions
40. Test all flows end-to-end

---

## Key API Surface (Complete Reference)

All existing APIs that the new UI must wire to:

### SSE
- `GET /api/sse` — real-time events (heartbeat, invoked, transition, buildlog, escalation, completed)

### Tamir
- `POST /api/tamir/consult` — new consultation
- `POST /api/tamir/consult/[conversationId]` — follow-up
- `GET /api/tamir/conversations` — list conversations
- `PATCH /api/tamir/conversations` — link conversation to task
- `POST /api/tamir/route` — route to department
- `POST /api/tamir/chats` — list past chats

### Tasks
- `GET /api/tasks/[taskId]` — task details
- `GET /api/tasks/[taskId]/chat` — chat history
- `POST /api/tasks/[taskId]/message` — planning message
- `POST /api/tasks/[taskId]/approve` — approve plan
- `POST /api/tasks/[taskId]/cancel` — cancel task
- `POST /api/tasks/[taskId]/config` — update config

### Deliverables
- `GET /api/deliverables/[id]/chat` — load chat
- `POST /api/deliverables/[id]/chat` — send message
- `GET /api/deliverables/[id]/file` — download file
- `POST /api/deliverables/[id]/promote` — promote

### Escalations
- `GET /api/escalations` — list
- `POST /api/escalations/[id]/respond` — respond
- `POST /api/escalations/[id]/resolve` — resolve/dismiss

### Org Context
- `GET /api/org-context/[dept]` — department context
- `POST /api/org-context/[dept]/skills/create` — create skill
- `POST /api/org-context/[dept]/skills/[id]/refresh` — refresh
- `POST /api/org-context/[dept]/skills/[id]/remove` — remove
- `POST /api/org-context/[dept]/tools/install` — install tool
- `POST /api/org-context/[dept]/tools/[name]/refresh` — refresh
- `POST /api/org-context/[dept]/tools/[name]/remove` — remove

### Skills
- `POST /api/skills/[id]/approve`
- `POST /api/skills/[id]/submit-to-ceo`
- `POST /api/skills/[id]/dismiss`

### Agents
- `GET /api/agents/[id]`

### Other
- `GET /api/org-graph`
- `GET /api/assets` + CRUD
- `GET /api/routines` + approve/trigger
- `POST /api/vault/search`
- `GET /api/system/info`
- `POST /api/system/reset`
- `POST /api/search`
- `GET /api/hire_requests/[id]/approve` + `/reject`

---

## Risk & Decisions Needed

1. **Tailwind ban override** — V2 is built on Tailwind. Need explicit approval to lift the CLAUDE.md constraint.
2. **React version** — Stay on 18 or upgrade to 19? Recommendation: stay on 18.
3. **Framer Motion bundle size** — ~30KB gzipped. Acceptable for localhost app?
4. **Liquid Glass library** — V2 uses `liquid-glass-react`. Is the visual effect worth the dependency?
5. **Mission vs Task naming** — Do we rename "Task" to "Mission" in the UI only, or also update DB/API? Recommendation: UI-only rename, keep backend as "task".

### Decisions Already Made
- **Org Context stays as one page** — Skills and Tools are embedded per-department in Org Context, not standalone pages. Same API endpoints, no refactoring needed.
- **Workspace is kept** — shows active running tasks with deep 3-column view (not the same as deliverable detail).
- **Deliverable detail keeps V1 split-view format** — chat on left, tabs on right. NOT V2 file-browser style.
- **Missions page dropped** — redundant with Deliverables (confirmed overlap).
