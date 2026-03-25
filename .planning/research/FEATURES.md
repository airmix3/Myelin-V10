# Feature Research

**Domain:** AI Agent OS / Multi-Agent Orchestration for Solo Founder
**Researched:** 2026-03-25
**Confidence:** HIGH (well-defined domain from PROJECT.md, verified against CrewAI, AutoGen, LangGraph)

## Feature Landscape

### Table Stakes (System Doesn't Work Without These)

Features the CEO will attempt to use in the first session. If any are missing, the system is non-functional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Task submission and routing | CEO needs to give work to agents; without routing, nothing happens | MEDIUM | LLM-based routing in Tamir using structured output. CrewAI/AutoGen all have task delegation as core primitive. |
| Task state machine | Must know if work is submitted, in progress, done, or failed. A2A standard states. | LOW | 6 states: submitted, working, input-required, completed, failed, canceled. Derived from A2A protocol. |
| Agent execution with tool access | Agents must actually run code, call APIs, read/write files -- not just generate text | HIGH | Claude Agent SDK `query()` handles the tool loop. This is the core value: real execution, not chat. |
| Deliverable output | Every task must produce a tangible artifact the CEO can review | MEDIUM | deliverable_manifest.json + promote_to_deliverable tool. Files tab in workspace. |
| CEO approval/review flow | Human-in-the-loop is non-negotiable for an agent OS. CEO must approve plans and review output. | MEDIUM | Plan approval in Tamir interface, supervisor review after execution. LangGraph calls this "human-in-the-loop" and lists it as a core feature. |
| Agent identity and roles | Each agent needs a defined role, personality, and department scope | LOW | soul.md + card.json per agent. CrewAI has role-based agents as core concept. |
| Workspace isolation | Agents must not clobber each other's files or access unauthorized resources | MEDIUM | Per-task desk/ directory with symlinked skills. Department library filesystem. |
| Real-time execution visibility | CEO must see what agents are doing right now, not just final results | HIGH | SSE streaming of build logs, heartbeat, task transitions. LangGraph emphasizes streaming/observability as core. |
| Session resume / durability | Long-running tasks must survive process restarts without losing progress | HIGH | Claude SDK session resume + DB-backed job queue with heartbeat + stale-run recovery. LangGraph's "durable execution" is equivalent. |
| Cost tracking | LLM calls cost real money; CEO must see spend per task | LOW | invokeAgent() wrapper tracks cost_events. CrewAI lists "cost efficiency" as core concern. |
| Error handling and retry | LLM APIs fail; agent must retry gracefully, not crash | LOW | Exponential backoff (3 retries: 2s/4s/8s), budget exceeded -> input-required state. |
| Full-text search across knowledge | CEO needs to find past deliverables, documents, agent memories | MEDIUM | SQLite FTS5 virtual table + sync triggers. Vault page search. |

### Differentiators (Competitive Advantage for "One-Man Company OS")

These features move Myelin from "multi-agent framework" to "company operating system." No competitor does these together.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Company DNA as system truth | Single source of truth (company-dna.md) that shapes all agent behavior -- mission, voice, constraints, strategy. No competitor has a persistent org identity document driving agent decisions. | LOW | Template on first boot, agents reference it for routing and execution context. |
| Persistent agent memory (MEMORY.md) | Agents remember across tasks and sessions. Not vector-DB-complex -- simple markdown files agents own and maintain. CrewAI moved to unified Memory class with semantic scoring; Myelin's approach is simpler but agent-owned. | LOW | memory-management global skill reads/writes at task start/end. Survives system resets. |
| Skill extraction and reuse | After completing tasks, the system extracts reusable patterns as skills that future tasks can leverage. The company gets smarter over time. | HIGH | skill-extractor global skill analyzes deliverables post-completion. Proposed skills go through CEO approval. CrewAI has nothing equivalent. |
| Hierarchical review (supervisor pattern) | Executor finishes -> department head reviews -> approve or request changes. Real management hierarchy, not flat peer agents. | MEDIUM | currentActorId transitions from executor to supervisor after execution. Adds accountability layer no framework provides. |
| Planning desk vs execution desk separation | Planning happens in one workspace, execution in another. CEO hints from planning inject into execution context. Clean separation of intent from implementation. | MEDIUM | Planning desk per department, execution desk per task. CLAUDE.md + extraSystemPrompt carry CEO guidance. |
| Temp employee hiring | Agents can dynamically hire specialists (SDK subagents) for tasks requiring niche expertise. The org scales on demand. | MEDIUM | hire_employee tool + SDK AgentDefinition subagent provisioning. AutoGen has "dynamic agent creation" but not with an HR metaphor and approval flow. |
| Cross-department consultation (A2A) | Agents consult each other across departments without losing their own task context. CTO asks CMO for brand guidance mid-task. | HIGH | consultAgent() with multi-turn support. A2A protocol internal implementation. |
| Department library filesystem | Skills, knowledge, and tools organized by department with symlink-based sharing. Agents discover capabilities through filesystem, not API calls. | LOW | data/departments/{dept}/ structure with symlinks to global and dept skills. SDK native skill discovery. |
| Tamir as Chief of Staff with LLM routing | Single entry point that understands the whole company and routes intelligently -- not keyword matching, not user-assigned. The AI figures out who should do the work. | MEDIUM | LLM structured output for routing decisions using company DNA as context. |
| Deliverable-centric workspace UI | Not a chat interface with code blocks -- a proper workspace showing the deliverable, build logs, agent activity, and files. The output is the hero, not the conversation. | HIGH | Split-pane: chat left, tabbed workspace right (Deliverable / Agent Log / Build Log / Files). |
| Tool/skill gallery with external discovery | Browse and select tools from company skills, MCP registries, Glama, ClawHub. CEO can hint which tools to use during planning. | MEDIUM | VS Code extension card layout, live search, source toggles. CEO hints injected into execution. |
| Activity timeline and org awareness | Dashboard shows what every agent is doing, recent activity, live status. CEO has situational awareness of the whole "company." | MEDIUM | SSE-driven dashboard with stats, agent status panel, activity timeline. |

### Anti-Features (Deliberately NOT Building)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-tenancy / user auth | "Other people might use it" | Single founder system. Auth adds complexity with zero users to serve. Security theater for localhost. | No auth. Single user. Revisit only if productizing the OS itself. |
| Vector database (ChromaDB, Mem0) | "Semantic search is better" | External service dependency, embedding model costs, sync complexity. For a single-user system with hundreds (not millions) of documents, FTS5 is sufficient and zero-config. | SQLite FTS5 for search. MEMORY.md for agent context. Revisit at 10K+ documents. |
| Real-time collaborative editing | "Multiple agents editing same file" | Race conditions, conflict resolution, OT/CRDT complexity. Agents work in isolated desks. | Workspace isolation. One agent per desk. Consultation via A2A messages, not shared editing. |
| Heavy ML pipelines in-process | "Run training jobs in the agent process" | Node.js is not for GPU workloads. Blocks the event loop. Memory pressure. | Agents execute Python scripts via SDK bash tool in their desk. ML runs as subprocess, not in-process. |
| Plugin marketplace / third-party agents | "Let others build agents" | Massive security surface. Trust model complexity. The system IS the company -- external agents are a liability. | MCP tool integration for external capabilities. Agent definitions stay internal. |
| Mobile responsive UI | "Access from phone" | Single-user localhost system. Mobile adds CSS complexity for a desktop-only use case. | Desktop-only Cortex UI. SSH tunnel if remote access needed. |
| Autonomous spending / external API calls without approval | "Agents should just do it" | Unbounded cost risk. A solo founder can't afford runaway API bills. | Autonomy slider (Minimal/Balanced/High/Full) + max budget input. Budget exceeded -> input-required state. |
| Chat-first interface | "Just talk to the AI" | Chat buries deliverables. The value is output, not conversation. Every AI product is already a chatbot. | Tamir chat for planning only. Workspace UI for execution. Deliverables are first-class, not chat messages. |
| Docker/serverless deployment | "Cloud native" | Persistent Node.js process needed for worker loop, cron, session state. Serverless cold starts kill agent sessions. Docker adds a layer for a single-machine system. | Direct Node.js process. pm2 or systemd for process management. |
| Multi-model support (GPT-4, Gemini, etc.) | "Model flexibility" | Claude Agent SDK is Claude-only by design. Multi-model adds abstraction layers, prompt format divergence, testing matrix explosion. | Claude via AWS Bedrock exclusively. SDK handles provider config via env vars. |
| Workflow builder / visual DAG editor | "Drag and drop agent pipelines" | Premature abstraction. The CEO describes work in natural language; Tamir routes it. Visual builders serve developer users, not CEO users. | Natural language task submission. LLM-based routing. Workflow complexity handled by agent hierarchy, not visual tools. |

## Feature Dependencies

```
[Agent Identity + Roles]
    |
    v
[Task State Machine] --requires--> [A2A Protocol Types]
    |
    v
[Task Routing (Tamir)] --requires--> [Company DNA]
    |                                      |
    v                                      v
[Workspace Isolation] --requires--> [Department Library Filesystem]
    |
    v
[Agent Execution (invokeAgent)] --requires--> [MCP Tool Server]
    |                                              |
    |                                              v
    |                                    [Role-based Tool Access]
    v
[Deliverable Output] --requires--> [Workspace Isolation]
    |
    v
[Supervisor Review] --requires--> [Task State Machine] + [Deliverable Output]
    |
    v
[Skill Extraction] --requires--> [Deliverable Output] + [Department Library]

[Session Resume] --requires--> [Worker Loop (DB job queue)]
    |
    v
[Stale Run Recovery] --requires--> [Heartbeat] + [Worker Loop]

[Real-time UI (SSE)] --independent--> [Agent Execution]
    |
    v
[Build Log Streaming] --requires--> [SSE Endpoint] + [Agent Execution]

[Cost Tracking] --requires--> [invokeAgent wrapper]

[Full-text Search] --independent--> [Core execution path]

[Temp Employee Hiring] --requires--> [Agent Execution] + [Task State Machine]

[Cross-dept Consultation] --requires--> [A2A Protocol] + [Agent Execution]
```

### Dependency Notes

- **Task Routing requires Company DNA:** Tamir uses DNA document as context for routing decisions. Without DNA, routing has no organizational awareness.
- **Workspace Isolation requires Department Library:** Desk creation symlinks department skills. Library structure must exist first.
- **Supervisor Review requires Deliverable Output:** Nothing to review without a deliverable. State machine must support the executor->supervisor actor transition.
- **Skill Extraction requires Deliverable Output + Department Library:** Extracts patterns from completed deliverables, proposes skills into department library structure.
- **Build Log Streaming requires both SSE and Agent Execution:** SSE endpoint must exist, and agent must emit events during execution.
- **Temp Employee Hiring requires Agent Execution:** Hiring creates SDK subagents, which need the full execution pipeline to function.

## MVP Definition

### Launch With (v1 -- "First Real Task Completes")

Minimum to validate: CEO submits a task, agent executes it, deliverable is produced and reviewable.

- [ ] Task state machine with A2A states -- foundation for everything
- [ ] Agent identity (soul.md + card.json for 4 executives) -- agents need to exist
- [ ] Tamir LLM routing -- CEO submits, system routes to correct department
- [ ] invokeAgent() with cost tracking -- agents must actually execute
- [ ] MCP tool server with core tools (read/write memory, promote_to_deliverable, submit_for_review) -- agents need capabilities
- [ ] Workspace isolation (desk creation, department library structure) -- agents need a place to work
- [ ] Worker loop with DB job queue -- tasks must be picked up and executed
- [ ] Deliverable output and basic review flow -- CEO must see results
- [ ] Tamir chat interface (plan mode) -- CEO needs an entry point
- [ ] Deliverable workspace page (basic: chat + deliverable tab) -- CEO needs to see output
- [ ] Dashboard with agent status -- CEO needs situational awareness
- [ ] Session resume -- long tasks must not be lost on restart
- [ ] Error handling with retry -- system must not crash on LLM 503s

### Add After Validation (v1.x -- "Company Runs on It Daily")

Features to add once the core loop works and the CEO is using it for real tasks.

- [ ] Skill extraction post-task -- trigger: CEO notices repeated patterns across tasks
- [ ] Temp employee hiring -- trigger: tasks need specialist skills beyond the 4 executives
- [ ] Cross-department consultation (consultAgent) -- trigger: tasks span multiple departments
- [ ] Tool/skill gallery with external discovery -- trigger: agents need tools beyond built-in MCP
- [ ] Autonomy slider and budget controls -- trigger: CEO wants less hand-holding for routine tasks
- [ ] Build log streaming (live partial events) -- trigger: CEO wants to watch execution in real-time
- [ ] Agent memory management skill -- trigger: agents start losing context across sessions
- [ ] Full-text search (FTS5 vault) -- trigger: enough documents accumulate to need search
- [ ] Skill approval UI -- trigger: skill extraction starts proposing skills

### Future Consideration (v2+)

- [ ] HTTP/JSON-RPC A2A transport -- enables external agent communication, not needed for internal v10
- [ ] Org Chart / Sessions / Budget pages -- operational dashboards, defer until daily usage patterns emerge
- [ ] Company DNA editor in UI -- currently template file, UI editor is convenience not necessity
- [ ] SSE streaming for plan generation -- one-shot JSON is fine for v1, streaming is polish

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Task state machine + A2A types | HIGH | LOW | P1 |
| Agent identity (soul.md + card.json) | HIGH | LOW | P1 |
| Tamir LLM routing | HIGH | MEDIUM | P1 |
| invokeAgent() wrapper | HIGH | MEDIUM | P1 |
| MCP tool server (core tools) | HIGH | HIGH | P1 |
| Workspace isolation | HIGH | MEDIUM | P1 |
| Worker loop + job queue | HIGH | MEDIUM | P1 |
| Deliverable output + review | HIGH | MEDIUM | P1 |
| Tamir chat UI | HIGH | HIGH | P1 |
| Deliverable workspace UI | HIGH | HIGH | P1 |
| Dashboard page | MEDIUM | MEDIUM | P1 |
| Session resume | HIGH | MEDIUM | P1 |
| Error handling + retry | HIGH | LOW | P1 |
| Cost tracking | MEDIUM | LOW | P1 |
| SSE endpoint + events | MEDIUM | MEDIUM | P1 |
| Company DNA template | MEDIUM | LOW | P1 |
| Skill extraction | HIGH | HIGH | P2 |
| Temp employee hiring | MEDIUM | MEDIUM | P2 |
| Cross-dept consultation | MEDIUM | HIGH | P2 |
| Tool/skill gallery | MEDIUM | MEDIUM | P2 |
| Autonomy controls | MEDIUM | LOW | P2 |
| Build log streaming (live) | MEDIUM | MEDIUM | P2 |
| Agent memory skill | MEDIUM | LOW | P2 |
| FTS5 search + vault UI | LOW | MEDIUM | P2 |
| Skill approval UI | LOW | LOW | P2 |
| A2A HTTP transport | LOW | HIGH | P3 |
| Org Chart page | LOW | MEDIUM | P3 |
| DNA editor UI | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- system non-functional without it
- P2: Should have -- add once core loop is validated with real tasks
- P3: Nice to have -- future consideration after daily usage

## Competitor Feature Analysis

| Feature | CrewAI | AutoGen | LangGraph | Myelin v10 Approach |
|---------|--------|---------|-----------|---------------------|
| Task lifecycle | Sequential/hierarchical process types | Conversation-based, no formal states | Graph-based state transitions | A2A standard state machine (6 states) |
| Agent memory | Unified Memory class with semantic scoring, scope trees | Memory as a service (pluggable) | Short-term + long-term memory | MEMORY.md per agent -- simpler, agent-owned, filesystem-native |
| Tool integration | 30+ built-in tools, @tool decorator | Custom tools + function calling | Tool nodes in graph | Single MCP server, role-based access, CEO-hinted tool selection |
| Human-in-the-loop | Callbacks on task completion | Human proxy agent in chat | State inspection/modification at any node | CEO approval at plan + review. Autonomy slider for delegation level. |
| Persistence/resume | Flow state persistence | Conversation history | Checkpointing + durable execution | SDK session resume + DB job queue + heartbeat + stale recovery |
| Cost tracking | Token optimization mentioned | Not emphasized | Via LangSmith | Per-task cost_events in DB, visible in dashboard |
| Multi-agent communication | Crew delegation, context passing | Async messages, group chat | Graph edges, handoffs | A2A protocol (internal), consultAgent for cross-dept |
| Observability | Limited | Trace/debug capabilities | LangSmith integration | SSE streaming, activity log, build logs, agent log tabs |
| Deliverable management | File output per task | Not a concept | Not a concept | First-class: manifest, workspace, gallery, files tab, primary file rendering |
| Organizational hierarchy | Flat crew of agents | Flat network | Flat graph nodes | Company hierarchy: CEO -> dept heads -> temp employees |
| Skill/knowledge reuse | Not present | Not present | Not present | Skill extraction, department libraries, symlink sharing, approval flow |
| UI/Dashboard | CrewAI Enterprise only | None built-in | LangGraph Studio (dev tool) | Full Cortex web UI: dashboard, chat, workspaces, org context, vault |

### Key Competitive Insight

No existing framework provides the "company OS" abstraction. CrewAI, AutoGen, and LangGraph are developer frameworks -- they give you primitives to build agent systems. Myelin v10 is an opinionated product with organizational hierarchy, deliverable management, and CEO-facing UI built in. The closest analog is not a framework but a product like Lindy.ai or Relevance AI, but those are SaaS platforms for workflow automation, not self-hosted company operating systems for a solo technical founder.

The differentiation is not in any single feature but in the integration: company DNA driving agent behavior + hierarchical review + deliverable-centric workspaces + skill accumulation. No competitor combines these.

## Sources

- CrewAI docs (docs.crewai.com): Memory system, task features, tool ecosystem -- MEDIUM confidence (docs fetched 2026-03-25)
- AutoGen docs (microsoft.github.io/autogen): Core architecture, async messaging, observability -- MEDIUM confidence
- LangGraph docs (langchain-ai.github.io/langgraph): Durable execution, human-in-the-loop, state management -- MEDIUM confidence
- Anthropic Claude Agent SDK (github.com/anthropics/claude-code-sdk-python): query(), session resume, custom tools, hooks -- HIGH confidence (primary source)
- PROJECT.md: Detailed requirements and architectural decisions -- HIGH confidence (source of truth)

---
*Feature research for: AI Agent OS / Multi-Agent Orchestration*
*Researched: 2026-03-25*
