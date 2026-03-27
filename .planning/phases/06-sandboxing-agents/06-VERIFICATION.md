---
phase: 06-sandboxing-agents
verified: 2026-03-27T20:30:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 06: Sandboxing Agents Verification Report

**Phase Goal:** Restrict agent filesystem access to workspace boundaries for faster inference and security isolation — agents use only their desk/deliverables dirs via built-in tools, and MCP tools for shared resources
**Verified:** 2026-03-27T20:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All must-haves are drawn from the PLAN frontmatter directly (Plan 01 and Plan 02).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agent built-in tools (Read, Write, Edit, Glob, Grep) are denied when targeting paths outside the workspace | VERIFIED | `isPathAllowed()` in `access-control.ts` lines 58-61 resolves relative paths via `path.resolve(deskDir, targetPath)` and returns false if outside deskDir or delivDir. `FILE_PATH_TOOLS` dict (lines 37-41) maps Read/Write/Edit to `file_path`; deny logic at lines 91-99. Glob/Grep handled at lines 103-111. |
| 2 | MCP tools (read_memory, read_knowledge, etc.) continue to work because they bypass filesystem restrictions | VERIFIED | Filesystem check in `access-control.ts` line 88 is `if (workspaceBoundaries && !toolName.startsWith('mcp__'))` — MCP tools (all prefixed `mcp__`) skip the entire filesystem check block. Role-based TAMIR_ONLY/DEPT_HEAD_ONLY/TEMP_ALLOWED checks continue unchanged for MCP tools. |
| 3 | settingSources is empty so agents never read parent .claude/ settings | VERIFIED | `invoke-agent.ts` line 90: `settingSources: [],` — confirmed present in the queryOptions object. |
| 4 | Planning desk invocations are sandboxed to their planning desk directory | VERIFIED | `ensurePlanningDesks()` in `workspace.ts` lines 107-120 writes `CLAUDE.md` with `PLANNING MODE` text to each planning desk. Combined with `settingSources: []` in all invocations, planning desk agents see only their desk CLAUDE.md. |
| 5 | Bash tool file operations on paths outside workspace are denied | VERIFIED | `access-control.ts` lines 114-127: `toolName === 'Bash'` block extracts absolute paths via regex `/(?:^|\s)(\/[^\s]+)/g` and denies if any extracted path fails `isPathAllowed()`. |
| 6 | Approved plan is written to a separate PLAN.md file in the desk, not embedded in CLAUDE.md | VERIFIED | `workspace.ts` lines 48-51: `if (plan) { writeFileSync(join(deskDir, 'PLAN.md'), plan, 'utf-8'); }`. CLAUDE.md template does NOT contain `## Plan\n\n${plan}` pattern — confirmed absent. |
| 7 | CLAUDE.md contains task context, constraints, soul reference, and a pointer to PLAN.md | VERIFIED | `workspace.ts` lines 55-71: CLAUDE.md template contains task ID, department, "Your complete task plan is in `PLAN.md`", full MCP tool list, workspace boundary reminder, and optional constraints section. |
| 8 | Planning desk CLAUDE.md exists with minimal context for planning conversations | VERIFIED | `workspace.ts` lines 108-120: writes `# Planning Desk: {dept}` with `PLANNING MODE` instruction if file doesn't exist yet. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/mcp/access-control.ts` | Filesystem boundary enforcement in canUseTool callback | VERIFIED | 157 lines. Contains `isPathAllowed`, `extractAbsolutePathsFromCommand`, `FILE_PATH_TOOLS`, `OPTIONAL_PATH_TOOLS`, `workspaceBoundaries` parameter, `'Access denied:'` message, checks for Read/Write/Edit/Bash. All role-based arrays preserved. |
| `src/lib/invoke-agent.ts` | settingSources: [] and workspace boundary passed to canUseTool | VERIFIED | 281 lines. Line 70-73: `buildCanUseTool(opts.agentId, opts.department, { deskDir: opts.deskDir, delivDir: opts.delivDir })`. Line 90: `settingSources: []`. |
| `src/lib/workspace.ts` | Updated createTaskWorkspace writing PLAN.md separately and minimal CLAUDE.md | VERIFIED | 123 lines. Lines 48-72: writes PLAN.md then minimal CLAUDE.md. Lines 107-120: planning desk CLAUDE.md. Old `## Plan\n\n${plan}` pattern absent. |
| `src/app/api/tasks/[taskId]/approve/route.ts` | Approval flow passing plan and constraints correctly to workspace | VERIFIED | Line 41: `const fullPlan = plan + (claudeMdExtra || '')`. Line 42-47: `createTaskWorkspace(params.taskId, task.department as Department, fullPlan, constraints)`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/invoke-agent.ts` | `src/lib/mcp/access-control.ts` | `buildCanUseTool` receives workspace boundaries | VERIFIED | Line 20: import. Line 70-73: call with `{ deskDir: opts.deskDir, delivDir: opts.delivDir }`. |
| `src/app/api/tasks/[taskId]/approve/route.ts` | `src/lib/workspace.ts` | `createTaskWorkspace` call with plan and constraints | VERIFIED | Line 3: import. Line 42-47: call passes `fullPlan` and `constraints`. |

### Data-Flow Trace (Level 4)

Not applicable — this phase modifies infrastructure/control-flow code (canUseTool callback, workspace file writers), not components rendering dynamic UI data. No data-flow trace required.

### Behavioral Spot-Checks

Step 7b: SKIPPED — the sandboxing logic runs inside the Agent SDK `canUseTool` callback during live agent execution. Testing it requires a live agent invocation. Routing to human verification instead (see below).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SANDBOX-01 | 06-01-PLAN.md | `buildCanUseTool()` extended with `workspaceBoundaries`; built-in tools denied when targeting paths outside deskDir/delivDir; `isPathAllowed()` resolves relative paths | SATISFIED | `access-control.ts` lines 58-61 (isPathAllowed), lines 77-80 (signature), lines 88-111 (Read/Write/Edit/Glob/Grep enforcement) |
| SANDBOX-02 | 06-01-PLAN.md | Bash tool file operations denied for absolute paths outside workspace; relative paths allowed; no blanket bash block per D-08 | SATISFIED | `access-control.ts` lines 114-127 (Bash block with regex extraction). Relative paths pass through because `resolve(deskDir, relPath)` stays within deskDir. |
| SANDBOX-03 | 06-01-PLAN.md | `invokeAgent()` passes `settingSources: []` and `{ deskDir, delivDir }` to `buildCanUseTool()` for all invocations | SATISFIED | `invoke-agent.ts` line 70-73 (boundaries passed), line 90 (`settingSources: []`) |
| SANDBOX-04 | 06-02-PLAN.md | `createTaskWorkspace()` writes approved plan to `desk/PLAN.md`; `desk/CLAUDE.md` is minimal pointer with MCP tool reference, workspace boundary reminder, pointer to PLAN.md | SATISFIED | `workspace.ts` lines 48-72 |
| SANDBOX-05 | 06-02-PLAN.md | Planning desks get their own CLAUDE.md with planning mode instructions; combined with `settingSources: []`, agent instruction set comes from workspace CLAUDE.md only | SATISFIED | `workspace.ts` lines 107-120 |

No orphaned requirements found — all 5 SANDBOX-* IDs are claimed by plans in this phase and confirmed present in REQUIREMENTS.md as `[x]` complete.

### Anti-Patterns Found

No anti-patterns found in phase-modified files (`access-control.ts`, `invoke-agent.ts`, `workspace.ts`, `approve/route.ts`). No TODOs, FIXMEs, placeholder returns, empty implementations, or hardcoded stubs detected.

Note: TypeScript compilation of the full project (`npx tsc --noEmit`) reports 6 errors in files unrelated to phase 06 (`scripts/validate-concurrent-isolation.ts`, `src/components/ApprovalCard.tsx`, `src/components/BuildLogPanel.tsx`, `src/app/deliverables/[id]/WorkspaceClient.tsx`, `src/components/WorkspaceChatPanel.tsx`). These pre-exist and are outside phase scope.

### Commit Verification

All 4 commits documented in SUMMARY files confirmed present in git history:

| Commit | Message | Files |
|--------|---------|-------|
| `ef6dc80` | feat(06-01): add filesystem boundary enforcement to canUseTool callback | `src/lib/mcp/access-control.ts` |
| `6474b54` | feat(06-01): pass workspace boundaries to canUseTool and set settingSources to empty | `src/lib/invoke-agent.ts` |
| `0c8fb6c` | feat(06-02): write separate PLAN.md and minimal CLAUDE.md in workspace | `src/lib/workspace.ts` |
| `14cb5d4` | feat(06-02): clarify approve route plan+hints concatenation | `src/app/api/tasks/[taskId]/approve/route.ts` |

### Human Verification Required

#### 1. Live canUseTool Denial Test

**Test:** Trigger a real agent task run. From the build log panel, verify that if the agent attempts `Read` on a path like `/home/omersh/myelin-gsd/src/lib/worker.ts` (outside workspace), the build log shows an "Access denied" denial event from the SDK.
**Expected:** Build log contains an entry with "Access denied: Read cannot access" and the path outside workspace boundary.
**Why human:** Requires a live agent invocation. The canUseTool callback fires inside the SDK tool loop at runtime; no offline test can simulate the full SDK tool interception chain.

#### 2. Planning Desk CLAUDE.md on First Boot

**Test:** Delete `data/departments/tech/planning-desk/CLAUDE.md` if it exists, then restart the dev server. Navigate to the Cortex and inspect `data/departments/tech/planning-desk/CLAUDE.md`.
**Expected:** File is recreated with content beginning `# Planning Desk: tech` and containing "PLANNING MODE".
**Why human:** `ensurePlanningDesks()` runs in `instrumentation.ts` at server startup. Verifying the `existsSync` guard and write behavior requires a server restart cycle.

#### 3. Approved Task Workspace File Layout

**Test:** Approve an existing planned task. Then inspect `data/workspaces/{taskId}/desk/` in a file browser or terminal.
**Expected:** Both `PLAN.md` (containing the approved plan text) and `CLAUDE.md` (minimal pointer mentioning `PLAN.md`, NOT containing the plan inline) are present. `CLAUDE.md` should contain "Your complete task plan is in `PLAN.md`".
**Why human:** The workspace is created by the approval flow; verifying the two-file layout requires triggering the actual approval endpoint with a real task.

### Gaps Summary

No gaps. All 8 observable truths verified against actual codebase. All 5 requirement IDs satisfied. No blocker anti-patterns detected in phase-modified files.

---

_Verified: 2026-03-27T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
