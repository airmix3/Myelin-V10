# 00 -- Vision, Product, Background & Goals

## What is Myelin?

Myelin is an AI-powered "one-man company" operating system. A system of autonomous AI agents that operate as a full company workforce for a solo founder CEO. The agents -- a Chief of Staff (Tamir), CTO, CMO, COO, and dynamically hired temporary employees -- execute real business tasks end-to-end: research, content creation, code, deployment, analysis, financial reports.

The CEO (Omer Shalev) interacts through:
- **The Cortex** -- A web dashboard at localhost:3000 for task planning, deliverable browsing, real-time chat with agents

The system is NOT a chatbot. It is an operating company with hierarchy, budgets, skills, deliverables, and accountability.

## The Company Behind It

Myelin (the real company) is a neurotech startup: "The Plaid of Brain Data."

**Product**: BDaS (Brain Data as a Service) -- a privacy-first BCI integration layer. Hardware-agnostic middleware that normalizes EEG/neural data across headsets with cryptographic privacy. Raw EEG stays on-device; only anonymized metrics (focus, stress, fatigue) are exported via API.

**Key Facts**:
- Founder: Omer Shalev -- 10+ years cyber/cryptography (Prime Minister's Office elite unit) + EEG/fMRI neuroscience research (Prof. Amir Amedi's lab, Hebrew University)
- Stage: Pre-seed, 300-day sprint
- TAM: $13.86B by 2035 (global BCI market)
- Target customers: Safety-critical enterprises, neurotech startups, clinical labs, gaming/XR studios
- Business model: Hybrid SaaS -- platform subscription + per-device-connection fee

**Brand voice**: Technical, precise, developer-friendly. No hype, no buzzwords. Real numbers, honest tradeoffs, engineering depth.

The AI agent system IS the company's entire workforce. There is no human team except Omer. Every task -- from "research the best EEG headset" to "write a YouTube script about AI companies" to "deploy the ZUNA model on AWS" -- flows through this system.

## Why TypeScript for v10?

Previous versions (v1-v5) were Python. v10 moves to TypeScript/Node.js because:

1. **Anthropic's TypeScript Agent SDK** (`@anthropic-ai/sdk`) is first-class and well-maintained
2. **Next.js** provides server-side rendering + API routes in one framework -- no separate FastAPI server
3. **Better type safety** -- Agent Cards, A2A Messages, Task schemas all benefit from TypeScript interfaces
4. **npm ecosystem** -- MCP clients, markdown rendering (remark/rehype), real-time (socket.io) all have excellent JS libraries
5. **Single language** -- Frontend and backend in the same language eliminates context switching
6. **Self-hosted Node.js only for v10 (matches in-memory event bus + SQLite + local filesystem)



Data Layer:
  - SQLite (via Prisma ORM) -- tasks, deliverables, employees, skills, vault indexing (via FTS5)
  - Local filesystem -- MEMORY.md per agent + SDK session resume, deliverable workspaces, skill definitions, vault and department libraries
```

## Goals for v10

1. **Full TypeScript rewrite** -- All backend, all frontend, all agents in TS
2. **Anthropic Agent SDK (TypeScript)** -- Replace custom StatefulAgent with official SDK
3. **A2A internal communication** -- Agent Cards, Task state machine, cross-dept consultation, use the github https://github.com/a2aproject/a2a-js of google a2a. 
4. **Next.js Cortex** -- Server components, streaming UI, real-time updates via Server-Sent Events
6. **Production-quality UI** -- Tamir chat with plan canvas, deliverable workspace, tool/skill galleries
7. **Real tool execution** -- Agents actually run code, call APIs, deploy infrastructure
8. **Comprehensive testing** -- Unit tests (vitest), integration tests, agent simulation harness

## Canonical Implementation Decisions

These rules override any older or less precise wording elsewhere in the docs. A junior developer should treat this section as the tie-breaker when two docs appear to disagree.

1. **Runtime model** -- v10 runs as a **persistent self-hosted Node.js server**. It is **not** designed for serverless or edge runtimes. Background task execution assumes a long-lived process.
2. **Agent execution API** -- Agents are invoked via the Claude Agent SDK `query()` flow only (V1 API). No custom `think()` abstraction, no manual `messages.create()` loop, no agent-specific HTTP microservices inside v10.
3. **Task actor model** -- A task can involve multiple actors. The canonical roles are:
   - `planningAgentId`: who plans with the CEO
   - `executorAgentId`: who performs the approved work
   - `supervisorAgentId`: who reviews and closes the task
   - `currentActorId`: who currently owns the next action
   The planner and supervisor are usually the same department head. The executor may be the same dept head or a temp employee (implemented as SDK subagent).
4. **Structured output** -- All agent responses that drive state transitions or UI behavior MUST use the SDK's `outputFormat` option for guaranteed structured JSON. No regex parsing, no freeform text heuristics, no HTML comment footers. See Doc 03 for schemas.
5. **Review rule** -- Every execution path ends in an explicit review decision before completion:
   - If a temp employee executes, the department head reviews.
   - If the department head executes directly, the same department head performs a formal self-review step and records the decision.
   There is no silent skip from `working` to `completed`. During review, the task stays in `working` state with `currentActorId` set to the supervisor.
6. **Standard A2A states only** -- Myelin uses ONLY the 6 standard A2A task states: `submitted`, `working`, `input-required`, `completed`, `failed`, `canceled`. No custom states. Lifecycle stage is derived from timestamps (`approvedAt`, `completedAt`) and actor fields (`currentActorId`), not from a custom phase field.
7. **Execution durability** -- Approved execution must run through a minimal DB-backed job queue / task-run table. Do not rely on in-memory fire-and-forget only.
8. **Company DNA** -- The source-controlled template lives in the repo (for example `config/company-dna.template.md`). On first boot it is copied into `data/vault/company-dna.md`, which is the runtime/searchable vault copy. It is not a JSON config file.
9. **Memory access** -- Personal agent memory is accessed through custom `read_memory` / `write_memory` tools only. Do not rely on raw filesystem access outside the desk CWD.
10. **Deliverable representation** -- Every task workspace has a versioned `deliverable_manifest.json` in the `deliverables/` directory. The manifest declares title, primary output file, preview text, and which files are CEO-visible.
11. **Visual authority** -- `12_VISUAL_GUIDELINES.md` is the single source of truth for tokens and component styling. Other docs may reference it but should not redefine visual constants.
12. **SDK built-ins first** -- Whenever Claude Agent SDK already provides a capability through built-in tools, skills loading, hooks, session resume, MCP integration, permissions, subagents, structured output, budget limits (`maxBudgetUsd`), or `canUseTool`, use the SDK mechanism instead of reimplementing it in Myelin code. Custom code exists only for Myelin-specific business logic and shared-resource policy.
13. **Events** -- There is exactly one shared event bus at `src/lib/events.ts`. All emitters and subscribers import it from there.
14. **Secrets in docs** -- Never place real credentials, tokens, or API keys in documentation, examples, or committed config.
15. **Zod raw shapes** -- The SDK `tool()` function takes positional args: `tool(name, description, inputSchema, handler, extras?)`. The `inputSchema` must be a **raw Zod shape** (`{ key: z.string() }`), NOT `z.object(...)`. Tool handlers MUST return `{ content: [{ type: 'text', text: '...' }] }` format. See https://platform.claude.com/docs/en/agent-sdk/custom-tools
16. **Planning desk** -- Each department head has a persistent planning desk at `data/departments/{dept}/planning-desk/`. Planning sessions use this as CWD so the agent has access to department skills and CLAUDE.md. On approval, a NEW dedicated task desk is created for execution.
17. **Chat history on filesystem** -- Chat history is stored as JSONL files on the filesystem, NOT in SQLite JSON columns. Path: `data/departments/{dept}/tasks/{slug}/chat.jsonl` for task chat, or `data/departments/{dept}/planning-desk/chat/{taskId}.jsonl` for planning chat.
18. **Tamir cron** -- Tamir is invoked via cron at least once every 15 minutes to process his inbox, update his project registry (MEMORY.md), and identify any tasks that need attention. This is how Tamir stays in control of company activity.
19. **Concurrent execution** -- Multiple agents can execute tasks simultaneously (e.g., CTO and CMO both working). The worker loop supports concurrent task runs. File-level locking (proper-lockfile) protects shared resources like `knowledge/` directories.
20. **CLAUDE.md loading** -- To ensure CLAUDE.md files auto-load from the desk, use `systemPrompt: { type: 'preset', preset: 'claude_code', append: soulContent }` combined with `settingSources: ['project']`. A plain string `systemPrompt` does NOT load CLAUDE.md.
21. **`outputFormat` uses JSON Schema** -- SDK `outputFormat` requires `{ type: 'json_schema', schema: <JSONSchemaObject> }`. Pass plain JSON Schema objects, NOT Zod schemas. Zod is only for `tool()` input schemas.
22. **`canUseTool` returns objects** -- The `canUseTool` callback must return `{ behavior: 'allow' | 'deny', message?: string }`, NOT a boolean. Use the `buildCanUseTool(agentId, dept)` factory pattern (Doc 02).
23. **`agents` is a Record** -- SDK `agents` option is `Record<string, AgentDefinition>` (named map), NOT an array. Each key is the subagent's name.
24. **Tool context via closure** -- Custom tools that need per-task state (taskId, agentId, etc.) receive it via closure from a `buildMyelinMcpServer(ctx: ToolContext)` factory. No global state, no `getCurrentTaskId()` magic.
25. **`transitionTask` options** -- `transitionTask(taskId, newState, options?)` where `options` is `{ message?: string; metadata?: Record<string, any> }`. Never pass a plain string or raw object as the third arg.
26. **Skill source of truth** -- Filesystem is the source of truth for skill content (`SKILL.md` + supporting files). The `skills` DB table is a metadata cache for querying/UI. `propose_skill` writes to both.
27. **Worker loop in instrumentation.ts** -- The worker loop and Tamir cron start from Next.js `instrumentation.ts`. All API routes that invoke agents must export `maxDuration = 120`.

## Key Terminology

| Term | Meaning |
|------|---------|
| **Tamir** | Chief of Staff AI agent. CEO's single point of contact. Routes all tasks. |
| **The Cortex** | Web dashboard (Next.js). All UI lives here. |
| **Deliverable** | Output of a completed task -- markdown document + optional workspace files (code, images, data) |
| **Plan Mode** | The Tamir chat interface where CEO interacts to plan tasks before execution |
| **Canvas** | Right-side panel in Plan Mode showing the rendered plan for CEO editing |
| **Soul** | Agent's system prompt -- personality, rules, tools, company context |
| **Agent Card** | A2A-spec JSON declaring agent capabilities and skills (used by Tamir for routing) |
| **Vault** | Persistent document store. Survives system resets. Holds critical company docs. |
| **MCP** | Model Context Protocol. How agents connect to external tools (databases, APIs, services). |
| **Skill** | Reusable capability (code snippet, prompt template, MCP config) that agents learn and share |
| **A2A** | Google's Agent-to-Agent protocol. Used internally for all inter-agent communication. |
| **BDaS** | Brain Data as a Service -- the actual product Myelin the company is building |
| **context_id** | A2A concept: groups all messages in one conversation/task lifecycle |
| **Artifact** | A2A concept: structured output produced by a task (the deliverable content) |

## What a Junior Developer Needs to Build This

**Must know well:**
- TypeScript (strict mode, generics, async/await, decorators)
- Next.js 14 (App Router, Server Components, API Routes, SSE streaming)
- Node.js (filesystem, child_process for tool execution, streams)
- HTML/CSS (the Cortex UI uses custom CSS, no Tailwind/Bootstrap)
- Anthropic Claude API (messages, tool_use, streaming)
- A2A protocol concepts (Agent Cards, Task states) -- this doc covers it

**Should be familiar with:**
- MCP (Model Context Protocol) -- Doc 08 covers it
- Server-Sent Events (for real-time UI updates)
- Markdown rendering (remark/rehype or marked.js)

**Will learn on the job:**
- The specific business domain (EEG, BCI, neurotech) -- agents handle this, dev doesn't need to know

## Reference Documentation (MUST READ BEFORE IMPLEMENTING)

**IMPORTANT**: For any technical question or implementation detail, consult the corresponding source FIRST before searching elsewhere. These are the authoritative references for each technology used in the system.

| Technology | Primary Reference | When to Consult |
|-----------|------------------|-----------------|
| **A2A Protocol** | `https://context7.com/google/a2a/llms.txt?tokens=10000` | Task schemas, state machine, Agent Cards, message format, consultation flow |
| **A2A GitHub** | `https://github.com/google/A2A` + `https://github.com/a2aproject/a2a-js` | JSON schemas, TypeScript types, reference implementations and capabilities |
| **Claude Agent SDK** | `https://github.com/bgauryy/open-docs/tree/main/docs/claude-agent-sdk` | query(), session resume, settingSources, allowedTools, hooks, subagents, MCP integration |
| **Claude Agent SDK Custom Tools** | `https://docs.claude.com/en/api/agent-sdk/custom-tools` | `tool()`, `createSdkMcpServer()`, `mcpServers`, MCP-qualified tool names, tool annotations |
| **Tool Use** | `https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use` | Custom tool definitions, input schemas, tool call handling, error patterns |
| **Skills** | `https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview` + `https://agentskills.io/home` | SKILL.md format, skill discovery, settingSources config, skill authoring best practices |
| **SQLite FTS5** | `https://www.sqlite.org/fts5.html` | Full-text search syntax, tokenizers, BM25 ranking, triggers, content tables |
| **Prisma (SQLite)** | `https://www.prisma.io/docs` | Schema definition, migrations, raw SQL for FTS5, type-safe queries |

**Workflow**: When you hit an implementation question (e.g., "how does settingSources work?"), look it up in the Claude Agent SDK reference first. If it's not there, then search broader docs. Do NOT guess or hallucinate API shapes.

## File/Folder Structure Preview

```
myelin-v10/
  package.json
  tsconfig.json
  prisma/
    schema.prisma              -- All database tables (SQLite datasource)
    migrations/
  src/
    agents/
      tamir/                   -- Self-contained agent directory
        agent.ts               -- Config + soul path + card path
        soul.md                -- System prompt
        card.json              -- A2A Agent Card
      cto/                     -- Same pattern
        agent.ts, soul.md, card.json
      cmo/
        agent.ts, soul.md, card.json
      coo/
        agent.ts, soul.md, card.json
      types.ts                 -- AgentConfig + tool policy interfaces
      employee.ts              -- Dynamic temp employee provisioning
      orchestrator.ts          -- Pipeline: CEO -> Tamir -> Dept -> Employee -> Deliverable
      invoke.ts                -- invokeAgent() wrapper around SDK query()
    a2a/
      types.ts                 -- A2A interfaces (Message, Part, Task, Artifact, AgentCard)
      state-machine.ts         -- Task state transitions
      consultation.ts          -- consult_agent tool implementation
    tools/                       -- ONLY custom Myelin tools (code exec, web, files are native SDK)
      knowledge.ts             -- read_knowledge, write_knowledge, search_knowledge
      deliverable.ts           -- promote_to_deliverable
      vault.ts                 -- file_to_vault
      consultation.ts          -- consult_agent (A2A wrapper)
      propose-skill.ts         -- propose_skill
      dept-status.ts           -- get_dept_status (Tamir only)
    skills/
      loader.ts                -- Load SKILL.md files from filesystem
      registry.ts              -- Skills database CRUD
      extractor.ts             -- Extract candidate skills from deliverables
    mcp/
      client.ts                -- MCP client for connecting to tool servers
      registry.ts              -- MCP server registry
    db/
      index.ts                 -- Prisma client singleton (SQLite)
      queries.ts               -- Common query helpers
    config/
      index.ts                 -- Environment config loader
      # Runtime Company DNA copy is in data/vault/company-dna.md
    lib/
      # No bedrock.ts -- Agent SDK handles provider via env vars
      markdown.ts              -- Markdown parse/render utilities
      id.ts                    -- ID generation (task_xxx, deliv_xxx, etc.)
  app/                         -- Next.js App Router
    layout.tsx                 -- Root layout with sidebar
    page.tsx                   -- Dashboard
    tamir/
      page.tsx                 -- Tamir chat + plan mode
    deliverables/
      page.tsx                 -- Deliverables gallery
      [id]/
        page.tsx               -- Deliverable workspace (split pane)
    org-context/
      page.tsx                 -- Organizational context (dept memory, knowledge, tools, skills)
    vault/
      page.tsx
    api/
      tamir/
        route/route.ts         -- POST: Tamir routes, creates A2A Task
      tasks/
        [taskId]/
          message/route.ts     -- POST: CEO <-> dept head direct chat
          config/route.ts      -- PUT: Update task config
          artifact/route.ts    -- PUT: Update plan artifact
          approve/route.ts     -- POST: Approve plan, start execution
          cancel/route.ts      -- POST: Cancel task
          chat/route.ts        -- GET: Load chat history from JSONL
          route.ts             -- GET: Full task state
      deliverables/
        [id]/
          chat/route.ts        -- POST: Chat in deliverable workspace
          buildlog/route.ts    -- GET: Build log HTML
          file/route.ts        -- GET: Serve workspace files
      search/
        tools/route.ts         -- GET: External tool search
        skills/route.ts        -- GET: External skill search
      sse/
        route.ts               -- SSE event stream
  data/
    myelin.db                  -- SQLite database (single file)
    agents/                    -- Per-agent runtime data (memory + sessions)
      tamir/
        MEMORY.md              -- Personal memory (preferences, lessons)
      cto/
        MEMORY.md
      cmo/
        MEMORY.md
      coo/
        MEMORY.md
    departments/               -- Department Libraries (see Doc 02)
      tech/
        knowledge/             -- Persistent reference docs (EEG inventory, AWS infra, etc.)
        skills/                -- Department skills (SKILL.md files)
        tasks/                 -- One directory per task
          zuna-evaluation-task_a1b2/
            deliverables/      -- CEO-facing outputs (reports, final artifacts)
            desk/              -- Agent's sandbox (scripts, drafts, raw data, temp files)
      marketing/
        knowledge/
        skills/
        tasks/
      operations/
        knowledge/
        skills/
        tasks/
      global/
        skills/                -- Cross-department skills
        knowledge/
        tasks/

    vault/                     -- Company-wide permanent docs (survives resets)
      company-dna.md           -- Runtime/searchable Company DNA copy
    # No ChromaDB/Mem0 -- agents use MEMORY.md files (see memory-management skill)
  config/
    company-dna.template.md    -- Repo-tracked Company DNA template copied to vault on first boot
  public/
    cortex.css                 -- Global styles
  .env                         -- Secrets (never commit)
  # No docker-compose needed -- SQLite is a local file, no external services
```

## Document Index (Which Doc Covers What)

Quick-reference for the developer. When you need to implement a specific feature, go to the canonical doc:

| Topic | Canonical Doc | Also Referenced In |
|-------|--------------|-------------------|
| **System overview, tech stack, process model** | Doc 00, Doc 01 | -- |
| **Agent execution, `query()`, sessions, orchestrator** | **Doc 02** | Doc 01, Doc 06 |
| **A2A protocol, task states, routing, consultation** | **Doc 03** | Doc 02, Doc 06, Doc 09 |
| **Database schema, Prisma, FTS5, seed data** | **Doc 04** | Doc 02, Doc 08 |
| **Cortex UI, CSS, all pages** | **Doc 05** | Doc 06, Doc 07 |
| **Tamir chat, plan mode, canvas, gallery** | **Doc 06** | Doc 09 |
| **Deliverable workspace, build log, file browser** | **Doc 07** | Doc 09 |
| **Tools (native + custom), skills, MCP, search** | **Doc 08** | Doc 02, Doc 06 |
| **End-to-end scenarios** | **Doc 09** | Doc 11 |
| **Configuration, secrets, deployment** | **Doc 10** | -- |
| **Build plan, phases, acceptance tests** | **Doc 11** | -- |
| **Visual guidelines, CSS, colors, fonts, components** | **Doc 12** | Doc 05, Doc 06, Doc 07 |

When concepts appear in multiple docs, the **canonical doc** (bold) has the full spec. Others reference it.
