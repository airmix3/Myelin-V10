---
phase: quick-260328-cyc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/mcp/tool-context.ts
  - src/lib/mcp/query-registry.ts
  - src/lib/invoke-agent.ts
  - src/lib/workspace.ts
  - src/lib/mcp/tools/install.ts
  - src/lib/mcp/server.ts
  - src/lib/mcp/access-control.ts
  - src/lib/activity-log.ts
  - src/components/AgentLogPanel.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Agent can call install_tool with npm package name, triggering dept head approval flow"
    - "Agent can call install_skill with skill name from skills.sh, triggering dept head approval flow"
    - "After dept head approves, tool/skill is installed to department directory and hot-reloaded into running session via setMcpServers"
    - "Agent log shows bounded region with thick separator when dept head runs during approval"
  artifacts:
    - path: "src/lib/mcp/query-registry.ts"
      provides: "Shared query ref registry keyed by runId"
    - path: "src/lib/mcp/tools/install.ts"
      provides: "install_tool and install_skill MCP tool implementations"
    - path: "src/lib/mcp/tool-context.ts"
      provides: "Extended ToolContext with runId for query registry lookup"
  key_links:
    - from: "src/lib/mcp/tools/install.ts"
      to: "src/lib/mcp/query-registry.ts"
      via: "getQueryRef(ctx.runId)"
      pattern: "getQueryRef.*setMcpServers"
    - from: "src/lib/invoke-agent.ts"
      to: "src/lib/mcp/query-registry.ts"
      via: "registerQueryRef after query() creation"
      pattern: "registerQueryRef.*opts\\.runId"
---

<objective>
Implement `install_tool` and `install_skill` MCP tools that allow agents to request npm tool or skills.sh skill installation mid-session. Installation goes through dept head approval (separate query() call from manager desk), installs to department directory, and hot-reloads the running agent's MCP servers via `setMcpServers()`. Agent log shows bounded regions for dept head agent switches.

Purpose: Agents need to self-provision tools and skills during execution without CEO intervention.
Output: Two new MCP tools, query registry for hot-reload, manager desk infrastructure, agent log UI for agent switches.
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260328-cyc-implement-install-tool-and-install-skill/260328-cyc-CONTEXT.md

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/lib/mcp/tool-context.ts:
```typescript
export interface ToolContext {
  taskId: string;
  agentId: string;
  department: string;
  deskDir: string;
  delivDir: string;
  manifestPath: string;
}
```

From src/lib/invoke-agent.ts:
```typescript
export interface InvokeAgentOptions {
  taskId: string;
  runId: string;
  agentId: string;
  department: string;
  prompt: string;
  soulMd: string;
  deskDir: string;
  delivDir: string;
  manifestPath: string;
  sessionId?: string;
  maxBudgetUsd?: number;
  outputFormat?: JsonSchemaOutputFormat;
  agents?: Record<string, AgentDefinition>;
  tools?: string[] | { type: 'preset'; preset: 'claude_code' };
}
```

From src/lib/orchestrator.ts:
```typescript
export class AgentOrchestrator {
  getAgent(agentId: string): AgentRegistryEntry | undefined;
  async invoke(opts: { taskId, runId, agentId, prompt, deskDir, delivDir, manifestPath, ... }): Promise<InvokeAgentResult>;
}
export const orchestrator: AgentOrchestrator;
```

From src/lib/mcp/server.ts:
```typescript
export function buildMyelinMcpServer(ctx: ToolContext): McpServer;
```

From src/lib/workspace.ts:
```typescript
export function ensurePlanningDesks(): void;
export function createTaskWorkspace(taskId, department, plan?, constraints?): WorkspaceResult;
```

From src/lib/activity-log.ts:
```typescript
export function insertActivityLog(opts: { taskId?, agentId?, actionType, description?, metadata? }): ActivityLogEntry;
```

SDK types (from @anthropic-ai/claude-agent-sdk):
```typescript
// query.setMcpServers() — dynamic MCP server reload mid-session
// Returns McpSetServersResult { added: string[], removed: string[], errors: Array<{name, error}> }
// query.mcpServerStatus() — returns server status array
```

Tool pattern (from src/lib/mcp/tools/skills.ts):
```typescript
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
// tool(name, description, schema, handler) => returns tool object
// handler returns { content: [{ type: 'text', text: string }] }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Query registry, ToolContext extension, manager desk setup, and department directories</name>
  <files>
    src/lib/mcp/query-registry.ts,
    src/lib/mcp/tool-context.ts,
    src/lib/invoke-agent.ts,
    src/lib/workspace.ts
  </files>
  <action>
**1. Create `src/lib/mcp/query-registry.ts`** — shared query ref registry keyed by runId:
```typescript
// Map<runId, queryObject> — stores the SDK query() async generator reference
// registerQueryRef(runId, q) — called from invoke-agent after query() creation
// getQueryRef(runId) — called from install tools to access setMcpServers()
// unregisterQueryRef(runId) — called from invoke-agent when query completes (in finally block)
```
The query object type from SDK is the return of `query()` — it's an async generator with `.setMcpServers()` and `.mcpServerStatus()` methods. Use `unknown` or the SDK's exported type if available. The registry is a simple `Map` — no event bus, no complexity.

**2. Extend `src/lib/mcp/tool-context.ts`** — add `runId` field:
```typescript
export interface ToolContext {
  taskId: string;
  runId: string;        // NEW — for query registry lookup
  agentId: string;
  department: string;
  deskDir: string;
  delivDir: string;
  manifestPath: string;
}
```
Update `createToolContext` to accept and pass through `runId`.

**3. Update `src/lib/invoke-agent.ts`**:
- Import `registerQueryRef`, `unregisterQueryRef` from query-registry
- Pass `runId` to `createToolContext()` (it's already in `opts.runId`)
- After `const q = query(...)` at line 228, call `registerQueryRef(opts.runId, q)`
- Wrap the entire for-await loop in try/finally, calling `unregisterQueryRef(opts.runId)` in finally

**4. Add `ensureManagerDesks()` to `src/lib/workspace.ts`**:
- Follow same pattern as `ensurePlanningDesks()`
- Create `data/departments/{dept}/manager-desk/` for tech, marketing, operations, global
- Create `.claude/settings.json` inside each (same permissions pattern)
- Create `data/departments/{dept}/tools/` and `data/departments/{dept}/skills/` directories
- Write a minimal CLAUDE.md for manager desk explaining the approval role
- Export `ensureManagerDesks` and call it from the same place `ensurePlanningDesks` is called (check `src/instrumentation.ts`)
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Query registry module exists with register/get/unregister. ToolContext includes runId. invoke-agent registers query ref on creation and unregisters on completion. Manager desks and dept tool/skill directories created on startup.</done>
</task>

<task type="auto">
  <name>Task 2: Implement install_tool and install_skill MCP tools with dept head approval</name>
  <files>
    src/lib/mcp/tools/install.ts,
    src/lib/mcp/server.ts,
    src/lib/mcp/access-control.ts,
    src/lib/activity-log.ts
  </files>
  <action>
**1. Create `src/lib/mcp/tools/install.ts`** — two tools following the pattern in `skills.ts`:

**`install_tool`**:
- Parameters: `package_name` (string, npm package name of MCP server), `justification` (string, why agent needs this tool)
- Flow:
  1. Log activity: `INSTALL_TOOL_REQUESTED` with package_name and justification
  2. Determine dept head for `ctx.department` (tech->cto, marketing->cmo, operations->coo, global->tamir)
  3. Import `orchestrator` from `@/lib/orchestrator` and `invokeAgent` from `@/lib/invoke-agent`
  4. Create manager desk path: `resolve(process.cwd(), 'data/departments', ctx.department, 'manager-desk')`
  5. Create a temporary delivDir and manifestPath for the approval call (similar to planning desk pattern — just create them in manager-desk/deliverables/)
  6. Log activity: `AGENT_SWITCH_START` with metadata `{ fromAgent: ctx.agentId, toAgent: deptHeadId, reason: 'tool_install_approval' }` — this is the boundary marker for the UI
  7. Invoke dept head via `invokeAgent()` directly (not orchestrator.invoke to avoid circular issues — get soulMd from orchestrator.getAgent):
     ```
     prompt: "An agent (${ctx.agentId}) working on task ${ctx.taskId} is requesting to install an MCP tool server.\n\nPackage: ${package_name}\nJustification: ${justification}\n\nReview this request. You may use web search to verify the package exists and is safe. Respond with APPROVED or REJECTED and your reasoning."
     ```
     Use `generateId('run')` for runId, `maxBudgetUsd: 2`, tools: full claude_code preset
  8. Log activity: `AGENT_SWITCH_END` with metadata `{ fromAgent: deptHeadId, toAgent: ctx.agentId }`
  9. Parse result for APPROVED/REJECTED (case-insensitive check for "approved" in result string)
  10. If REJECTED: return rejection message to agent
  11. If APPROVED:
      a. Install npm package to dept tools dir: `execSync('npm install ${package_name}', { cwd: deptToolsDir })` — the dept tools dir is `data/departments/${ctx.department}/tools/`
      b. Initialize a package.json in dept tools dir if not exists
      c. Look up query ref via `getQueryRef(ctx.runId)` from query-registry
      d. Call `q.setMcpServers({ [package_name]: { type: 'stdio', command: 'npx', args: [package_name] } })` — this is the hot-reload
      e. Return success message with list of newly available tools

**`install_skill`**:
- Parameters: `skill_name` (string, skill name from skills.sh), `justification` (string)
- Flow:
  1. Log activity: `INSTALL_SKILL_REQUESTED`
  2. Same dept head approval flow as install_tool (steps 2-9 above, but prompt says "skill" not "tool")
  3. If APPROVED:
      a. Install skill via `execSync('npx skills install ${skill_name}', { cwd: deptSkillsDir, timeout: 30000 })` — deptSkillsDir is `data/departments/${ctx.department}/skills/`
      b. Skills are filesystem-based (loaded by Claude via .claude/skills/ symlinks), so NO setMcpServers needed
      c. Return success message telling agent the skill is now available in their skills directory

**Error handling for both tools:**
- Wrap npm/npx install in try/catch, return error text to agent if install fails
- Wrap dept head invocation in try/catch, return error if approval call fails
- If query ref not found (edge case), still install but skip hot-reload, warn agent

**2. Update `src/lib/mcp/server.ts`**:
- Import `createInstallTools` from `./tools/install`
- Add `const installTools = createInstallTools(ctx);`
- Add `...installTools` to the tools array

**3. Update `src/lib/mcp/access-control.ts`**:
- Add `mcp__myelin__install_tool` and `mcp__myelin__install_skill` to `TEMP_ALLOWED` array (temp employees can REQUEST installs — the dept head approval is the gate)
- These should NOT be in DEPT_HEAD_ONLY (all agents need them)

**4. Add new action types to `src/lib/activity-log.ts`** — no code changes needed here since `insertActivityLog` accepts arbitrary `actionType` strings. The new types (`INSTALL_TOOL_REQUESTED`, `INSTALL_SKILL_REQUESTED`, `AGENT_SWITCH_START`, `AGENT_SWITCH_END`) will just be used from the install tools.
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>install_tool and install_skill MCP tools exist. Calling either triggers dept head approval via separate query() invocation from manager desk. On approval, npm tool is installed + hot-reloaded via setMcpServers, or skill is installed via npx skills. Activity log records AGENT_SWITCH_START/END boundaries.</done>
</task>

<task type="auto">
  <name>Task 3: Agent log UI bounded region for dept head agent switches</name>
  <files>
    src/components/AgentLogPanel.tsx
  </files>
  <action>
Update `src/components/AgentLogPanel.tsx` to render visual boundaries around dept head approval activity:

**1. Add new action type badges:**
```typescript
'INSTALL_TOOL_REQUESTED': { className: 'log-type-tool', label: 'INSTALL' },
'INSTALL_SKILL_REQUESTED': { className: 'log-type-tool', label: 'INSTALL' },
'AGENT_SWITCH_START': { className: 'log-type-session', label: 'AGENT SWITCH' },
'AGENT_SWITCH_END': { className: 'log-type-session', label: 'AGENT SWITCH' },
```

**2. Group entries between AGENT_SWITCH_START and AGENT_SWITCH_END** into bounded regions:
- Before rendering, scan `visibleEntries` for AGENT_SWITCH_START/END pairs
- Build a Set of entry IDs that fall between a START and END pair
- Track which agent the switch was to (from START metadata `toAgent`)

**3. Render bounded regions with visual separator:**
- When rendering, if current entry is AGENT_SWITCH_START:
  - Render a thick horizontal line (3px solid, `var(--border-accent)` color)
  - Render a label: "Department Head: {toAgent}" in a small pill/badge above the line
  - Start a visually distinct container (slight background tint, left border accent)
- All entries between START and END render inside this container
- When AGENT_SWITCH_END is reached:
  - Close the container
  - Render another thick horizontal line

CSS approach — use inline styles (project uses custom CSS variables, no frameworks):
```typescript
// Bounded region wrapper
style={{
  borderLeft: '3px solid var(--border-accent, #4a9eff)',
  background: 'var(--bg-surface-hover, rgba(74, 158, 255, 0.05))',
  paddingLeft: '12px',
  marginTop: '8px',
  marginBottom: '8px',
}}
// Separator line
style={{
  height: '3px',
  background: 'var(--border-accent, #4a9eff)',
  margin: '12px 0 4px 0',
}}
// Agent label
style={{
  fontSize: '10px',
  fontWeight: 600,
  color: 'var(--border-accent, #4a9eff)',
  marginBottom: '4px',
}}
```

**4. Add metadata highlights for new action types:**
```typescript
case 'INSTALL_TOOL_REQUESTED':
case 'INSTALL_SKILL_REQUESTED':
  return [
    typeof metadata.package_name === 'string' ? `Package: ${metadata.package_name}` : '',
    typeof metadata.skill_name === 'string' ? `Skill: ${metadata.skill_name}` : '',
    typeof metadata.justification === 'string' ? `Reason: ${truncate(metadata.justification, 100)}` : '',
  ].filter(Boolean);

case 'AGENT_SWITCH_START':
  return [
    typeof metadata.toAgent === 'string' ? `Switched to: ${metadata.toAgent}` : '',
    typeof metadata.reason === 'string' ? `Reason: ${metadata.reason}` : '',
  ].filter(Boolean);
```
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Agent log shows thick horizontal line separators and bounded region with accent border/background when dept head runs during tool/skill approval. New action types have proper badges and metadata highlights.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `npx tsc --noEmit` passes
2. Dev server starts: `node_modules/.bin/next dev -p 3011` boots without errors
3. Query registry exists at `src/lib/mcp/query-registry.ts` with register/get/unregister exports
4. ToolContext includes `runId` field
5. invoke-agent.ts registers and unregisters query refs around the streaming loop
6. Manager desks created at `data/departments/{dept}/manager-desk/`
7. Dept tool/skill dirs created at `data/departments/{dept}/tools/` and `data/departments/{dept}/skills/`
8. install_tool and install_skill tools appear in MCP server tool list
9. Access control allows all agent roles to call install_tool/install_skill
10. AgentLogPanel renders bounded regions for AGENT_SWITCH_START/END pairs
</verification>

<success_criteria>
- An agent calling `install_tool` or `install_skill` triggers a dept head approval query, installs on approval, and hot-reloads MCP servers (for tools) or confirms skill availability (for skills)
- Agent log UI shows clear visual boundaries when dept head agent takes over temporarily
- All existing functionality unchanged (no regressions in invoke-agent, MCP server, access control)
</success_criteria>

<output>
After completion, create `.planning/quick/260328-cyc-implement-install-tool-and-install-skill/260328-cyc-SUMMARY.md`
</output>
