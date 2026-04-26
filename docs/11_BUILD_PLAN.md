# 11 -- Build Plan: Phases, Tasks & Dependencies

## Principles

- Each phase produces a working increment that can be tested
- Later phases depend on earlier ones -- strict ordering
- No time estimates -- focus on correctness, not speed
- Test each phase before moving on
- Refer to the specific doc number for detailed specs
- Prefer Claude Agent SDK built-ins over custom Myelin reimplementation whenever possible

---

## Phase 1: Foundation

**Goal**: Project skeleton, database, config, agent runtime, LLM connectivity (via Agent SDK env vars).

### Tasks

1. Initialize Next.js 14 project (pnpm, TypeScript strict mode, App Router)
2. Set up Prisma with SQLite
   - Define all schema models from Doc 04
   - Run initial migration
   - Seed 4 executive employees (Tamir, CTO, CMO, COO)
   - Add `TaskRun` / `task_runs` for durable execution (no `phase` field -- lifecycle derived from timestamps and currentActorId)
3. Set up FTS5 virtual table + sync triggers (raw SQL, see Doc 04)
4. Implement config loader
   - `.env` parsing (AWS creds, API token, paths)
   - Company DNA template loader (`config/company-dna.template.md`) + first-boot vault copy (`data/vault/company-dna.md`)
5. Implement LLM provider setup (env vars only -- no code)
   - No code needed -- Agent SDK reads ANTHROPIC_API_KEY or CLAUDE_CODE_USE_BEDROCK from env
   - Region, model ID from env
6. Implement agent config types and `invokeAgent()` wrapper around SDK `query()` (Doc 02)
   - No `think()` method or custom tool recursion layer
   - Cost tracking per LLM call (tokens + cents to `cost_events` table)
   - Activity logging per action
   - Reuse SDK session resume, permissions, hooks, and MCP integration rather than rebuilding equivalents
7. Implement session tracking (store SDK session_id on task records for resume)
   - SDK handles sessions natively via session_id -- just store the ID in the task record
   - CLAUDE.md generation for task desks (plan + constraints injected by SDK automatically)
   - Use systemPrompt preset: `{ type: 'preset', preset: 'claude_code', append: soul }` for CLAUDE.md loading
   - Set up planning desk directories: `data/departments/{dept}/planning-desk/`
8. Implement ID generation utility (`generateId('task')` -> `task_a1b2c3d4`)
9. Create self-contained agent directories (each has agent.ts + soul.md + card.json):
   - `src/agents/tamir/`, `src/agents/cto/`, `src/agents/cmo/`, `src/agents/coo/`
10. Implement agent config modules inside their directories (no class hierarchy required)
11. Implement `Orchestrator` singleton (holds agent configs, invokes via SDK `query()`)

### Verify
- Can instantiate all agents
- `orch.invoke('cto', 'Hello')' calls SDK query() and returns a response
- SDK session_id stored in task record, resume works on next query()
- Cost event written to DB
- Activity log entry created

### Dependencies
None.

---

## Phase 2: A2A Protocol + Custom Tools

**Goal**: A2A type system, task state machine, LLM-based routing, custom Myelin tools, department library structure.

### Tasks

1. Define A2A TypeScript interfaces (Doc 03)
   - `AgentCard`, `A2ATask`, `A2AMessage`, `TextPart`, `FilePart`, `DataPart`, `A2AArtifact`
   - `TaskState` type with standard A2A states only: submitted, working, input-required, completed, failed, canceled
   - `TaskHandoff`, `TaskConfig`, and explicit actor-role fields (`planningAgentId`, `executorAgentId`, `supervisorAgentId`, `currentActorId`)
   - All type definitions use Zod schemas for validation
2. Implement Agent Cards for all 4 executives (`src/agents/{agent_id}/card.json (loaded by src/a2a/cards.ts)`, Doc 03)
3. Implement task state machine (`src/a2a/state-machine.ts`, Doc 03)
   - Valid transition map
   - `canTransition()` and `transitionTask()` with DB update + activity logging
4. Implement LLM-based routing in Tamir (Doc 03, Doc 09)
   - Load company DNA from vault
   - Build routing prompt with org structure + Agent Card capabilities
   - Parse structured response (department + reason)
5. Create department library filesystem structure (Doc 02)
   - `data/departments/{tech,marketing,operations}/knowledge/`
   - `data/departments/{tech,marketing,operations}/skills/`
   - `data/departments/{tech,marketing,operations}/tasks/`
   - `data/departments/global/skills/`
6. Implement `createTaskWorkspace()` (Doc 02)
   - Creates `desk/` and `deliverables/` dirs for a task
   - Creates `desk/.claude/skills/` directory
   - Symlinks department skills + global skills into `desk/.claude/skills/`
   - Returns paths object
   - Agent sessions use `settingSources: ["project"]`, built-in `tools: [...]`, `mcpServers: { myelin: ... }`, and `canUseTool` for permission control (Doc 08)
7. Implement custom Myelin tools (Doc 08)
   - Only for company-specific resources or policies not already covered by SDK built-ins
   - Define each custom tool with Zod schemas and correct handler return format
   - Mount them on an in-process `createSdkMcpServer({ name: "myelin", ... })`
   - Expose them to `query()` via `mcpServers`
   - Use SDK `outputFormat` for structured output where needed
   - `promote_to_deliverable` -- copy from desk to deliverables, index to FTS5
   - `read_knowledge` / `write_knowledge` -- dept knowledge library access
   - `search_knowledge` -- FTS5 search across vault + knowledge + past tasks
   - `file_to_vault` -- permanent vault storage
   - `consult_agent` -- A2A cross-department consultation (Doc 03)
   - `get_dept_status` -- Tamir's department overview
8. Implement role-based tool access control via `canUseTool` (Doc 08)
   - Use SDK `canUseTool` callback to filter tool access per role
   - Dept heads: all custom tools
   - Temp employees (SDK AgentDefinition subagents): read_knowledge, search_knowledge, promote_to_deliverable only
9. Implement FTS5 indexing functions (Doc 04)
   - `indexDepartmentKnowledge()` -- scan knowledge/ dirs, upsert to documents table
   - `indexTaskDeliverables()` -- index promoted deliverables
   - Call `indexDepartmentKnowledge()` at startup
10. Implement employee provisioning as SDK subagents (Doc 02)
    - Temp employees are SDK AgentDefinition instances, not custom provisioned processes
    - `provisionEmployee()` -- create DB record, configure AgentDefinition, set CWD to task desk
    - Use `maxBudgetUsd` SDK option for budget enforcement
    - Terminate after task: archive session, update status
11. Implement `consult_agent` with multi-turn support (Doc 03)
    - Create A2A Task for consultation
    - Handle `input-required` state for follow-up questions
    - Track active consultations by fromAgent->toAgent key

### Verify
- Tamir routes a request to correct department via LLM
- A2A Task created with correct state transitions (submitted -> working -> input-required -> working -> completed)
- Invalid transitions throw errors
- Custom tools execute correctly (promote, knowledge read/write, search, consult)
- Temp employees cannot access write_knowledge or consult_agent
- FTS5 returns relevant results across vault + knowledge + task deliverables
- Cross-department consultation works with multi-turn

### Dependencies
Phase 1 (Agent configs, DB, SDK connectivity, Orchestrator).

---

## Phase 3: Cortex UI Shell (6 Core Pages)

**Goal**: Next.js app with design system, sidebar, and the 6 core pages rendering with real data.

### Tasks

1. Implement global CSS design system (Doc 05)
   - All CSS variables (colors, fonts, radius)
   - Badge system (.badge-tech, .badge-marketing, .badge-ops, .badge-pending)
   - Markdown rendering styles (.md-render)
2. Create `app/layout.tsx` with sidebar component (Doc 05)
   - 5 nav items: Dashboard, Tamir, Deliverables, Org Context, Vault
   - Active state highlighting
   - Logo + version
3. Implement SSE endpoint (`/api/sse`) for real-time event push (Doc 05)
   - Import the shared bus from `src/lib/events.ts`
   - Remove listeners in `ReadableStream.cancel()` to prevent leaks
4. Implement Dashboard page (`/`)
   - Stats row: active agents, active tasks, pending approvals, total deliverables
   - Live agent status panel (colored dots by last activity time)
   - Recent activity timeline (last 10 entries from activity_log)
   - Auto-refresh via SSE or polling
5. Implement Deliverables gallery page (`/deliverables`) (Doc 07)
   - Card grid with title, dept badge, type badge, status badge, creator, date, preview
   - In-progress tasks shown at top with amber border
   - Department filter tabs + search input
6. Implement Org Context page (`/org-context`) (Doc 05)
   - Department tabs (Tech / Marketing / Operations)
   - Left column: Agent Memory (MEMORY.md per agent, collapsible cards), Knowledge Library (expandable cards), Tools & Skills
   - Right column: Employee cards with avatar, status, recent memory entries, past tasks accordion
   - API endpoints: `/api/org-context/{dept}`, `/api/org-context/{dept}/memory`, `/api/org-context/{dept}/knowledge`
7. Implement Vault page (`/vault`)
   - FTS5 search input
   - Document list with title, department, filed_by, date
   - Click to expand full content (rendered markdown)
8. Implement `/agents/{id}` read-only stub page
   - Render `card.json`, `MEMORY.md`, and past tasks

### Verify
- All 6 pages render with real data from DB
- Dark theme consistent across all pages
- SSE events push to connected clients
- Org Context shows correct department data, knowledge files, employees
- Vault search returns relevant FTS5 results
- Deliverables gallery shows in-progress tasks

### Dependencies
Phase 1 (DB), Phase 2 (A2A types for task display, department library structure).

---

## Phase 4: Tamir Interface (Plan Mode)

**Goal**: The flagship feature. CEO chats with Tamir, gets routed to dept head, plans directly with them via A2A, approves plan on canvas.

### Tasks

1. Create `/tamir` page with chat UI (Doc 06)
   - Full-width chat initially
   - Agent avatars with correct colors (Tamir=red, CTO=blue, CMO=pink, COO=green)
   - Markdown rendering in agent messages
2. Implement `POST /api/tamir/route` (Doc 06)
   - Tamir's LLM routes request (reads company DNA + Agent Cards)
   - Creates A2A Task (status: submitted, with explicit actor-role fields)
   - Returns `{ taskId, contextId, department, tamir_response }`
   - Tamir is DONE after this call
3. Implement routing buttons in chat UI
   - "Plan with [Dept Head]" (primary) + "Plan with Tamir" (secondary)
   - On click: frontend stores taskId, switches endpoint
4. Implement `POST /api/tasks/{taskId}/message` (Doc 06)
   - Generic endpoint: routes to whoever owns the task
   - Returns `{ state, agent_id, turn }`
   - SDK `outputFormat` structured output provides explicit turn types -- no regex or keyword parsing
   - Add `export const maxDuration = 120`
   - Add client timeout / retry UX guidance
   - Structured output schema defines turn types directly (replaces `<!-- TURN: -->` footers)
5. Implement `GET /api/tasks/{taskId}` -- full task state, history, artifacts, config
6. Implement canvas split pane (Doc 06)
   - Triggered when API returns artifact with `plan_md`
   - 40/60 split (chat left, canvas right)
   - Typewriter effect for plan rendering (40-70ms per line)
   - Plan editing: toggle rendered markdown / raw textarea
7. Implement configuration panel on canvas (Doc 06)
   - Autonomy slider (Minimal / Balanced / High / Full)
   - Max budget input (USD)
   - Constraints text input
   - `PUT /api/tasks/{taskId}/config`
8. Implement tool/skill gallery on canvas (Doc 06, Doc 08)
   - Two tabs: Skills / Tools
   - VS Code extension card layout (icon, name, desc, dept badge, source badge)
   - Live search with 300ms debounce
   - Source toggles: Company / MCP Registry / Glama (tools), Company / ClawHub (skills)
   - Cross-department items grayed but selectable
   - Selection with hint text input per item
   - `GET /api/search/tools` and `GET /api/search/skills` endpoints
9. Implement plan editing: `PUT /api/tasks/{taskId}/artifact`
10. Implement approval flow (Doc 06)
    - `POST /api/tasks/{taskId}/approve`
    - Creates task workspace (desk/ + deliverables/)
    - Writes `deliverable_manifest.json` in `deliverables/` directory
    - Injects `selectedTools` / `selectedSkills` into execution context (`CLAUDE.md` + `extraSystemPrompt`)
    - Creates deliverable record (plan reference + chat history in filesystem JSONL)
    - Creates new task desk on approval (separate from planning desk)
    - Task status: working (execution begins)
    - Tamir notified asynchronously (saves project summary)
    - Frontend redirects to `/deliverables/{id}`
11. Implement `POST /api/tasks/{taskId}/cancel`

### Verify
- Full flow: type task -> Tamir routes -> buttons appear -> click -> dept head greets -> clarification rounds -> plan on canvas -> edit plan -> adjust config -> select tools -> approve -> redirects to deliverable
- Task state drives UI correctly (input-required = chat, working + artifact = canvas)
- Tamir is NOT involved after routing
- External search returns results from MCP Registry / Glama / ClawHub
- Chat history preserved in filesystem JSONL files

### Dependencies
Phase 2 (A2A, tools, routing), Phase 3 (Cortex shell, CSS, deliverables gallery).

---

## Phase 5: Deliverable Workspace

**Goal**: Split-pane workspace for monitoring execution and browsing completed work.

### Tasks

1. Implement `/deliverables/[id]` as split-pane layout (Doc 07)
   - Left (400px): Chat panel
   - Right (flex): Tabbed workspace
2. Implement chat panel (Doc 07)
   - Restore chat history from filesystem JSONL files (if source = tamir_chat)
   - Participant avatars at top (CEO + agent, colored circles with tooltips)
   - "-- plan approved -- task executing --" divider
   - Agent greeting message
   - `POST /api/deliverables/{id}/chat` for continued conversation
3. Implement Build Log tab (Doc 07)
   - Use `includePartialMessages: true` from SDK to stream tool calls, thinking, and progress events in real-time
   - Each SDK message becomes a build log entry streamed via SSE
   - Claude Code-style expandable entries (chevron, type badge, agent, description, timestamp)
   - Click to expand metadata JSON
   - Show periodic heartbeat/liveness entries while execution runs
4. Implement Deliverable tab (Doc 07)
   - Render primary file declared by `deliverable_manifest.json` (located in `deliverables/` directory)
5. Implement Files tab (Doc 07)
   - Two sections: Deliverables (prominent) + Desk/Working Files (collapsible)
   - Card grid: icon, filename, file size
   - `GET /api/deliverables/{id}/file?path=...` serves files
   - Inline preview: images, videos, PDFs (iframe), markdown (rendered), code (pre)
   - Path traversal prevention (security)
6. Implement supervisor check flow
   - When executor finishes, `currentActorId` switches to supervisor (task stays `working`)
   - Supervisor reviews against plan + CEO request
   - Approve -> `completed` / Send back -> `currentActorId` back to executor, task stays `working`
7. Implement skill extraction from deliverables
   - Extract candidate skills from completed deliverable content
   - Show "Approve" / "Dismiss" buttons for CEO
   - Approved skills saved as SKILL.md in department skills/ directory
8. Update deliverables gallery to show in-progress tasks with status badges

### Verify
- Chat history from Tamir planning session appears in deliverable workspace
- Build log shows real-time agent activity during execution
- Files tab renders images, PDFs, videos, markdown, code correctly
- Supervisor check gate works (can't complete without supervisor approval)
- Skill extraction identifies reusable patterns

### Dependencies
Phase 4 (deliverables created from plan approval, task execution pipeline).

---

## Phase 6: Integration Testing & Polish

**Goal**: End-to-end verification, error handling, system utilities.

### Tasks

1. Implement system-reset utility
   - Clears all operational tables (tasks, deliverables, activity_log, etc.)
   - Preserves: vault, company DNA, skills, permanent employees
   - Reset employee budgets, terminate temp employees
2. Implement error handling
   - LLM API 503: exponential backoff (3 retries: 2s, 4s, 8s)
   - Budget exceeded: SDK `maxBudgetUsd` enforces limit, task -> `input-required`, CEO can increase and resume
   - Agent empty response: retry once with nudge
   - Tool execution failure: log error, return to agent, let agent decide
3. Replace fire-and-forget execution with a minimal DB-backed worker queue
   - `POST /approve` writes a queued `task_run`
   - Worker claims queued rows and marks them executing
   - Multiple tasks execute concurrently (each gets its own SDK subprocess)
   - Heartbeat updates every ~15s
   - On startup, stale executing runs become failed with `process_restart`
4. Start Tamir cron (every 15 minutes) to process inbox and perform autonomous coordination
5. Run all 6 scenarios from Doc 09 end-to-end
   - Scenario 1: Technical research (CTO path, employee hire, desk -> deliverables)
   - Scenario 2: Content creation (CMO path, delegation to Content Director)
   - Scenario 3: Cross-department consultation (CMO consults CTO via A2A)
   - Scenario 4: Operations planning (COO path, timeline deliverable)
   - Scenario 5: Employee hiring flow (input-required, approval, SDK AgentDefinition provisioning)
   - Scenario 6: Error recovery (LLM API failure, budget exceeded via maxBudgetUsd)
6. Verify data integrity
   - FTS5 indexes stay in sync after writes
   - Task state machine uses only standard A2A states (submitted, working, input-required, completed, failed, canceled)
   - All deliverable files accessible from workspace
   - Cost tracking accurate across all agents
7. Performance sanity check
   - Measure: route latency, plan generation latency, tool execution latency
   - Identify any blocking calls in async context

### Verify
- All 6 scenarios pass without manual intervention
- Error recovery works gracefully
- System reset leaves vault + DNA + skills intact
- No orphaned tasks, deliverables, or employee records

### Dependencies
All previous phases.

---

## Phase 7: Real-World Acceptance Tests (Two Flagship Scenarios)

**Goal**: Prove the system can execute real, meaningful business tasks end-to-end. These two scenarios are the acceptance criteria for v10. If they work, the system works.

These are NOT unit tests -- they are full CEO-to-deliverable runs with real LLM calls, real tool execution, real file generation. Run them interactively via the Cortex Tamir interface, simulating exactly how the CEO would use the system.

### Scenario A: AI-Generated Brand Video for X (Content Pipeline)

**CEO Request**: "Create a 20-second video for X (Twitter) explaining what Myelin does. Use AI tools to generate it. Make it technical but accessible."

**What This Tests (Full Content Pipeline)**:
- Tamir routes to CMO (content creation + social media + video)
- CMO plans with CEO: clarifying questions about tone, target audience, brand constraints
- CMO generates a detailed plan with steps for: script, visuals, AI tool selection, generation, editing
- **Tool discovery**: CMO (or employee) must DISCOVER which AI video generation tools exist. The agent should search for tools via web search or the tool gallery (MCP Registry, Glama). Expected discoveries: HeyGen, Synthesia, Runway, Pika, etc.
- **CEO hint simulation**: If the agent doesn't find the right tool, the CEO hints "try HeyGen" via the tool gallery selection in plan mode
- Employee executes:
  - Writes the 20-second script (with hooks, timing, captions)
  - Researches AI video tools (web search, compares pricing/quality)
  - Selects a tool (e.g., HeyGen) and either calls its API or documents the manual workflow
  - Generates the actual video (via API call to HeyGen/Synthesia, or records the manual steps if API unavailable)
  - Generates supporting assets: script.md, storyboard notes, caption file (.srt)
  - Promotes deliverables: **the video file (.mp4)**, final script, tool recommendation report, generation workflow docs
- Dept head reviews: checks script quality, brand voice alignment, tool recommendation validity
- **Skill creation**: After successful execution, the skill-extractor identifies a reusable pattern:
  - "X Brand Video Generation" skill -- includes: script template, tool selection criteria, brand voice guidelines, caption generation steps
  - Employee proposes via `propose_skill`
  - CMO reviews, refines description for better triggering
  - CEO approves
  - Skill saved to `data/departments/marketing/skills/x-brand-video-generation/`
  - **Verify**: Next time CEO asks for social video content, this skill auto-triggers

**Success Criteria**:
- [ ] Task routes correctly to CMO
- [ ] Plan includes concrete steps for AI tool discovery + video generation
- [ ] Agent discovers at least 2-3 AI video generation tools via web search
- [ ] CEO can hint tools via gallery (simulated: select HeyGen from search results)
- [ ] Deliverables include: **generated video (.mp4)**, script, tool comparison, generation workflow
- [ ] Skill extracted and saved with `status: active` after CEO approval
- [ ] On a SECOND run ("make another X video about our privacy features"), the saved skill auto-triggers and the agent follows the established workflow

### Scenario B: EEG SVM Classifier (Technical Research + Code)

**CEO Request**: "Write a basic SVM classifier for a public EEG dataset to classify emotions or stress. Find the dataset, write the classifier, run it on our machine, get results, and generate a report with charts."

**What This Tests (Full Technical Pipeline)**:
- Tamir routes to CTO (ML, EEG, code, evaluation)
- CTO plans with CEO: clarifying questions about dataset preference, accuracy targets, report format
- CTO generates plan with concrete steps: dataset search, download, preprocessing, SVM training, evaluation, visualization, report
- CTO delegates to a temp ML employee (hire request -> CEO approval)
- **Employee executes with real code** (all running in desk via native SDK tools):
  1. Searches for public EEG datasets via web search (expected: DEAP, SEED, PhysioNet)
  2. Downloads dataset (e.g., DEAP for emotion classification)
  3. Writes preprocessing script: loads EEG data, extracts frequency band features (alpha, beta, theta, gamma power)
  4. Writes SVM classifier: trains sklearn SVM on extracted features, cross-validation
  5. **Runs the code on the machine** -- agent executes Python scripts in desk, reads stdout/stderr, fixes errors iteratively
  6. Generates evaluation metrics: accuracy, precision, recall, F1, confusion matrix
  7. Generates plots: confusion matrix heatmap, feature importance chart, ROC curve
  8. Writes markdown report with methodology, results, analysis, figures
  9. Promotes to deliverables: report.md, confusion_matrix.png, roc_curve.png, feature_importance.png, classifier.py
- **Dept head reviews**: CTO checks methodology, code quality, statistical validity
- Deliverable workspace shows: build log of all steps, final report rendered, all charts viewable, all Python scripts browsable

**Success Criteria**:
- [ ] Task routes correctly to CTO
- [ ] CTO hires a temp data scientist employee (hire flow works)
- [ ] Employee finds and downloads a real public EEG dataset
- [ ] Python code executes successfully in the desk (SVM trains, no crashes)
- [ ] Generates real metrics (not hallucinated numbers) -- accuracy should be in realistic range (60-85% for EEG emotion classification)
- [ ] Generates real plots (PNG files exist, contain actual data, not placeholder text)
- [ ] Report is well-structured with methodology, results, and analysis
- [ ] CTO review gate works (employee promotes to deliverables, CTO reviews before completing)
- [ ] All files viewable in deliverable workspace (report renders as markdown, charts render as images, code viewable)
- [ ] Build log shows the full execution trace (dataset search, code writing, execution, error fixing, plot generation)

### How to Run These Tests

1. System reset (clean slate)
2. Start Cortex (`pnpm dev`)
3. Open `/tamir` in browser
4. Type Scenario A request verbatim
5. Walk through the full flow: routing -> planning -> approval -> execution
6. Interact as CEO would: answer clarifying questions, approve hires, approve skills
7. Verify all success criteria
8. System reset
9. Repeat for Scenario B

**During development**: Run these scenarios after each phase completion (partial runs are OK -- Phase 3 can test routing + planning without execution, Phase 5 tests the full pipeline). They serve as living integration tests that evolve with the build.

### Verify
- Both scenarios produce real deliverables with actual content (not stubs)
- Skill creation flow works end-to-end in Scenario A
- Real Python code runs and produces real output in Scenario B
- The full A2A task lifecycle (submitted -> working -> input-required -> working -> completed) is exercised using standard states only
- CEO experience is smooth: Tamir chat -> plan -> approve -> watch execution -> browse results

### Dependencies
All previous phases (this is the final acceptance gate).

---

## Dependency Graph

```
Phase 1: Foundation
    |
Phase 2: A2A + Custom Tools
    |            |
Phase 3: UI     |
    |            |
    +-----+------+
          |
Phase 4: Tamir Interface (Plan Mode)
          |
Phase 5: Deliverable Workspace
          |
Phase 6: Integration Testing & Polish
          |
Phase 7: Real-World Acceptance Tests
          (Scenario A: AI Video + Skill Creation)
          (Scenario B: EEG SVM Classifier + Code Execution)
```

---

## Rules

1. **No Tailwind** -- Custom CSS variables only. Dark theme is Myelin's identity.
2. **No React state management libs** -- Server Components + minimal client state.
3. **No WebSocket** -- SSE for server push. Simpler.
4. **No microservices** -- Single Next.js process.
5. **No Prisma abstractions** -- Use Prisma directly, no repository pattern.
6. **No versioning on plans/deliverables** -- Latest only.
7. **Native SDK tools for agent work** -- No custom wrappers for code execution, file ops, web fetch.
8. **Custom tools ONLY for company resources** -- promote_to_deliverable, knowledge, vault, consult_agent.
9. **Desk = agent's CWD** -- Not accessed via tools, but via native SDK filesystem.
10. **LLM-based routing** -- Tamir reasons over company DNA, not keyword matching.
11. **A2A state machine enforced** -- Standard states only (submitted, working, input-required, completed, failed, canceled). Every transition validated, logged, and used to drive UI.
12. **Zod schemas for all tool definitions** -- Every custom tool uses Zod for input validation and correct handler return format.
13. **Structured output via SDK `outputFormat`** -- Turn routing and agent responses use structured output, not regex or keyword parsing.
14. **Standard A2A states only** -- No custom states (no `review`, `auth-required`, `rejected`). Supervisor checks happen within `working` state via `currentActorId`.
