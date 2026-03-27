# Phase 6: Sandboxing Agents - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Restrict agent execution environments so agents can only access files within their workspace (desk or planning desk). Primary motivation: **performance** — agents currently waste inference time exploring the entire filesystem outside their CWD, making new task inference slow. Secondary benefit: security isolation.

</domain>

<decisions>
## Implementation Decisions

### Filesystem Boundaries
- **D-01:** Strict desk-only filesystem access for execution runs. Agents can only read/write within `data/workspaces/{taskId}/desk/` and `data/workspaces/{taskId}/deliverables/`. No access to `src/`, `.planning/`, other workspaces, or parent directories. MCP tools (`read_memory`, `read_knowledge`, `search_knowledge`, `file_to_vault`) handle all access to shared resources outside the desk.
- **D-02:** Block Claude Code's built-in file tools (Read/Write/Edit/Bash file operations) on paths outside the workspace. Use SDK `disallowedDirectories` or path validation to enforce this. Agents MUST use MCP tools for anything beyond their desk.
- **D-03:** Planning desk conversations locked to `data/departments/{dept}/planning-desk/` with the same restrictions. Planning agents cannot read files outside their planning desk directory.
- **D-04:** Tamir routing calls get the same restrictions — locked to planning desk. Tamir already uses `tools:[]` (LLM-only) for routing, so this is mostly a consistency measure.
- **D-05:** `settingSources: []` (empty array) for all agent invocations. Prevents agents from reading any `.claude/` settings from parent directories. Cleanest isolation — agent sees only its workspace CLAUDE.md.

### Workspace CLAUDE.md Structure
- **D-06:** Each desk gets a minimal `CLAUDE.md` that references `PLAN.md` as the sole complete plan for the task. The approved plan goes into a separate `PLAN.md` file in the desk, NOT embedded in `CLAUDE.md`. `CLAUDE.md` contains: task context, constraints, soul reference, and a pointer to `PLAN.md`.
- **D-07:** No parent directory `.claude/` discovery. Combined with `settingSources: []`, the agent's entire instruction set comes from its workspace `CLAUDE.md` only.

### Command Execution
- **D-08:** No bash command restrictions. Full shell access maintained. The filesystem boundary already prevents agents from touching files outside their desk — bash commands referencing outside paths will just fail naturally.
- **D-09:** Keep `bypassPermissions` + `allowDangerouslySkipPermissions: true`. Required for headless agent execution. Sandboxing comes from filesystem boundaries, not interactive permission prompts.
- **D-10:** Allow package installs (`npm install`, `pnpm add`, `pip install`) within the desk directory. CTO agents running code tasks need the ability to install libraries.

### Claude's Discretion
- Exact SDK mechanism for path restriction (`disallowedDirectories` vs `canUseTool` callback vs other approach) — research should determine what the SDK supports
- Whether to use absolute or relative paths in restriction rules
- Error messaging when agents hit boundary limits
- Any needed changes to `createTaskWorkspace()` to support the new PLAN.md structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent Execution
- `src/lib/invoke-agent.ts` — Current agent invocation wrapper with `bypassPermissions`, `settingSources`, `allowedTools` configuration
- `src/lib/worker.ts` — Worker loop that resolves workspace paths and invokes agents
- `src/lib/orchestrator.ts` — Agent registry and initialization

### Workspace Creation
- `src/lib/workspace.ts` — `createTaskWorkspace()` creates desk + deliverables directories, writes CLAUDE.md, symlinks skills
- `src/app/api/tasks/[taskId]/approve/route.ts` — Approval flow that creates execution workspace

### Planning Conversations
- `src/app/api/tasks/[taskId]/message/route.ts` — Planning turns that invoke agents in planning desk
- `src/app/api/tamir/route/route.ts` — Tamir routing endpoint

### MCP Tools (Shared Resource Access)
- `src/lib/mcp/server.ts` — MCP server factory
- `src/lib/mcp/access-control.ts` — `buildCanUseTool` role-based access control
- `src/lib/mcp/tools/` — Individual tool implementations (memory, knowledge, vault, deliverable)

### Agent Boundary
- `data/CLAUDE.md` — Current project boundary CLAUDE.md for agents
- `data/.claude/settings.json` — Current project boundary settings

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildCanUseTool()` in `src/lib/mcp/access-control.ts` — Already implements role-based tool filtering. Could be extended to handle filesystem path validation.
- `createTaskWorkspace()` in `src/lib/workspace.ts` — Already creates desk structure with CLAUDE.md. Needs modification to write PLAN.md separately.

### Established Patterns
- SDK `query()` options already support `allowedTools`, `settingSources`, `permissionMode`, `cwd` — filesystem restriction likely achievable through existing SDK options
- MCP tool isolation: each invocation gets a fresh MCP server via `buildMyelinMcpServer(ctx)` with closure-bound context — MCP tools already enforce boundaries

### Integration Points
- `invokeAgent()` is the single entry point for all agent calls — sandboxing changes go here
- `createTaskWorkspace()` creates the desk structure — PLAN.md separation goes here
- `src/app/api/tasks/[taskId]/message/route.ts` creates temp planning desks — needs same restrictions
- Worker loop in `src/lib/worker.ts` calls `invokeAgent()` — no changes needed if restrictions are in invokeAgent

</code_context>

<specifics>
## Specific Ideas

- "Currently my problem is inference takes tons of time as they figure out the entire file system outside of their CWD upon invocation" — the primary motivation is performance, not security
- "The main benefit: they will be able to use all tools but just in their own workspace, so inference for new tasks is fast"
- "We have to set it for the planning tasks too, like in the planning desk. They should not read files outside of these locations as it's just not relevant to them and takes tons of time"
- Plan should be a separate PLAN.md file referenced from CLAUDE.md, not embedded in CLAUDE.md

</specifics>

<deferred>
## Deferred Ideas

- Network access restrictions (HTTP requests, external API access) — discussed but not selected for this phase
- Per-role sandbox profiles (different restriction levels for temp employees vs executives) — discussed but not selected for this phase
- Pre-installed package environments for desks — decided to allow runtime installs instead

</deferred>

---

*Phase: 06-sandboxing-agents*
*Context gathered: 2026-03-27*
