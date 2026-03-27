# Phase 6: Sandboxing Agents - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 06-sandboxing-agents
**Areas discussed:** Filesystem boundaries, Command execution limits

---

## Filesystem Boundaries

### Workspace access level

| Option | Description | Selected |
|--------|-------------|----------|
| Strict desk-only | Agent can only read/write within desk/ and deliverables/. No access to src/, .planning/, or other workspaces. | ✓ |
| Desk + read-only shared | Write restricted to desk, read access to vault + knowledge | |
| Desk + scoped read/write | Write to desk + agent memory, read from vault + knowledge | |
| You decide | Claude picks the best approach | |

**User's choice:** Strict desk-only
**Notes:** None

### Enforcement mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Block built-in file tools outside desk | Use SDK disallowedDirectories or path validation in canUseTool | ✓ |
| Trust the CWD constraint | Let SDK's default permission model handle enforcement | |
| You decide | Claude picks | |

**User's choice:** Block built-in file tools outside desk
**Notes:** "Currently my problem is inference takes tons of time as they figure out the entire file system outside of their CWD upon invocation so the main benefit they will be able to use all tools but just in their own workspace... so inference for new tasks is fast. Also, we have to set it for the planning tasks like in the planning desk."

### CLAUDE.md structure

| Option | Description | Selected |
|--------|-------------|----------|
| Clean CLAUDE.md per workspace | Minimal CLAUDE.md with task plan + constraints + soul. settingSources: [] | ✓ |
| Keep current approach | data/CLAUDE.md + data/.claude/settings.json boundary | |

**User's choice:** Clean CLAUDE.md per workspace
**Notes:** "I want the plan task not be given as CLAUDE.md but rather as a PLAN.md and just reference it in CLAUDE.md as the sole complete plan for the task"

### Planning desk restrictions

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, lock to planning-desk | Same restriction as execution desks | ✓ |
| Wider read for planning | Read access to vault + knowledge in addition to planning desk | |
| You decide | Claude picks | |

**User's choice:** Yes, lock to planning-desk

### Tamir routing restrictions

| Option | Description | Selected |
|--------|-------------|----------|
| Same restrictions for Tamir | Tamir locked to planning desk (already uses tools:[] for routing) | ✓ |
| Tamir is special | Keep current approach for Tamir specifically | |

**User's choice:** Same restrictions for Tamir

### Settings sources

| Option | Description | Selected |
|--------|-------------|----------|
| settingSources: [] (empty) | Agent sees no inherited settings. Cleanest isolation. | ✓ |
| settingSources: ['project'] | Keep current approach with data/.claude boundary | |

**User's choice:** settingSources: [] (empty)

---

## Command Execution Limits

### Shell access restrictions

| Option | Description | Selected |
|--------|-------------|----------|
| No bash restrictions | Keep full bash. Filesystem boundary handles path enforcement. | ✓ |
| Allowlisted commands only | Define safe command list, block everything else | |
| No shell for planning | Planning uses tools:[], execution gets full shell | |
| You decide | Claude picks based on risk profile | |

**User's choice:** No bash restrictions

### Permission mode

| Option | Description | Selected |
|--------|-------------|----------|
| Keep bypassPermissions | Required for headless execution. Sandboxing via filesystem. | ✓ |
| Use acceptEdits mode | Auto-approves edits, may prompt for bash | |
| You decide | Claude picks | |

**User's choice:** Keep bypassPermissions

### Package installs

| Option | Description | Selected |
|--------|-------------|----------|
| Allow package installs in desk | Agents can npm/pnpm/pip install within desk | ✓ |
| Pre-installed packages only | Desk gets pre-configured package.json, no runtime installs | |
| You decide | Claude picks | |

**User's choice:** Allow package installs in desk

---

## Claude's Discretion

- SDK mechanism for path restriction (disallowedDirectories vs canUseTool callback)
- Error messaging when agents hit boundary limits
- Changes to createTaskWorkspace() for PLAN.md structure

## Deferred Ideas

- Network access restrictions — discussed but not selected
- Per-role sandbox profiles — discussed but not selected
- Pre-installed package environments — decided to allow runtime installs instead
