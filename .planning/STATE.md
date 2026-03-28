---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Milestone complete
stopped_at: Completed quick/260328-oqj
last_updated: "2026-03-28T14:51:38.267Z"
last_activity: "2026-03-28 - Completed quick task 260328-oqj: Add description field to all global and cos skills to match Anthropic skill format"
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 24
  completed_plans: 23
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Agents actually execute real business tasks end-to-end — not just generate text
**Current focus:** Phase 06 — sandboxing-agents

## Current Position

Phase: 06
Plan: Not started

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 7min | 2 tasks | 12 files |
| Phase 01 P02 | 2min | 3 tasks | 4 files |
| Phase 01 P03 | 2min | 2 tasks | 2 files |
| Phase 01 P04 | 2min | 2 tasks | 2 files |
| Phase 02 P06 | 2min | 1 tasks | 3 files |
| Phase 02 P01 | 3min | 2 tasks | 9 files |
| Phase 02 P02 | 4min | 1 tasks | 13 files |
| Phase 02 P04 | 3min | 2 tasks | 8 files |
| Phase 02 P03 | 8min | 3 tasks | 9 files |
| Phase 02 P05 | 3min | 2 tasks | 4 files |
| Phase 03 P01 | 3min | 3 tasks | 4 files |
| Phase 03 P02 | 2min | 3 tasks | 7 files |
| Phase 03 P03 | 3min | 2 tasks | 7 files |
| Phase 03 P04 | 2min | 2 tasks | 8 files |
| Phase 03 P05 | 2min | 2 tasks | 3 files |
| Phase 03 P06 | 4min | 3 tasks | 6 files |
| Phase 04 P02 | 2min | 2 tasks | 5 files |
| Phase 04 P01 | 3min | 3 tasks | 6 files |
| Phase 04 P03 | 4min | 4 tasks | 9 files |
| Phase 05 P01 | 3min | 2 tasks | 4 files |
| Phase 05 P02 | 1min | 1 tasks | 2 files |
| Phase 06 P02 | 1min | 2 tasks | 2 files |
| Phase 06 P01 | 2min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Coarse 4-phase structure — Foundation, Agent Execution, UI+Tamir, Workspace+Integration
- [Roadmap]: Phase 2 flagged as hardest — validation spike recommended before full implementation
- [Phase 01]: Prisma 7 requires prisma.config.ts for datasource URL -- url removed from schema.prisma
- [Phase 01]: driverAdapters no longer a preview feature in Prisma 7.5 -- flag removed
- [Phase 01]: PrismaBetterSqlite3 adapter takes {url} config in Prisma 7 -- separate sqlite instance for FTS5 raw access
- [Phase 01]: Prisma camelCase column names in raw SQL -- no @map() overrides in schema
- [Phase 01]: SSEEventBus wraps typed emissions into {type, data} envelope on unified event channel
- [Phase 01]: Junction symlinks for workspace skill sharing (cross-platform compatible)
- [Phase 01]: Parameterized SQL for worker stale threshold instead of template literal interpolation
- [Phase 01]: executeRun is Phase 1 stub (marks completed immediately) -- Phase 2 replaces with invokeAgent()
- [Phase 02]: MEMORY.md uses 4-section journal format: Recent Projects, Company Conventions, Goals, Notes
- [Phase 02]: Global skill SKILL.md format: YAML frontmatter + goal/trigger/procedure/edge-cases structure
- [Phase 02]: A2A types defined in-house (src/a2a/types.ts) instead of @a2a-js/sdk -- simpler for pure interfaces
- [Phase 02]: Tamir allowed DEPT_HEAD_ONLY tools per TOOL-10 (file_to_vault is Tamir + dept heads)
- [Phase 02]: Agent soul.md files are comprehensive 2-4 page guides per D-03, loaded at import time via readFileSync
- [Phase 02]: Shared appendToInbox helper for lockfile-protected inbox writes
- [Phase 02]: invokeAgent uses preset: claude_code with soul.md appended, bypassPermissions for headless execution
- [Phase 02]: Cost tracking via direct SQLite INSERT into cost_events from SDK result metrics
- [Phase 02]: Raw JSON Schema objects for SDK outputFormat (not zod) per research Pitfall 4
- [Phase 02]: Subagent definition stored in both task metadata and task_run agents field for dual access
- [Phase 03]: CSS copied verbatim from Doc 12 -- no 4px grid snapping (Doc 12 canonical per D-01)
- [Phase 03]: useSSE hook uses addEventListener (not onmessage) to match server named event format
- [Phase 03]: Dashboard split into Server+Client island for SSE live updates
- [Phase 03]: Vault pre-loads documents server-side for browse, FTS5 API for search mode
- [Phase 03]: Agent cards fetched alongside department data in org-context API for richer employee display
- [Phase 03]: Planning invocations use temp desk/delivDir/manifestPath since no execution workspace exists yet
- [Phase 03]: TaskConfig stored in task.metadata JSON (not separate column) per Pitfall 8
- [Phase 03]: Page rehydration via localStorage taskId and JSONL chat history fetch on mount
- [Phase 03]: External APIs use AbortController with 5s timeout for graceful degradation
- [Phase 04]: System info fetched via server-side API to avoid process.version in client code
- [Phase 04]: INT-01 tool failure handling: SDK handles natively; added invokeAgentWithResilience wrapper for empty response nudge only
- [Phase 04]: Review tools use raw sqlite INSERT (not prisma) consistent with review.ts per Pitfall 3
- [Phase 04]: ApprovalCard delegates API calls to parent via onAction prop for centralized network management
- [Phase 04]: Chat re-fetch uses transitionCounter prop pattern (SSE -> counter increment -> useEffect re-fetch) for D-07 dual signal
- [Phase 05]: Dynamic imports for Langfuse/OTel packages to keep edge runtime clean
- [Phase 05]: No per-message child observations in SDK query loop (subprocess context doesn't propagate)
- [Phase 05]: Lightweight env var check for Langfuse status instead of importing SDK in API route
- [Phase 06]: CLAUDE.md is minimal pointer with MCP tool list; plan content in separate PLAN.md
- [Phase 06]: Filesystem boundary check runs before MCP role-based checks in canUseTool pipeline
- [Phase 06]: Bash tool scans for absolute paths via regex rather than blocking all bash commands (per D-08)
- [Phase quick-260328-9r1]: skills.sh integrated via CLI (npx skills search) with execSync and 10s timeout
- [Phase quick-260328-b2e]: Read-only projectRoot boundary for planning agents: isReadPathAllowed checks projectRoot for Read/Glob/Grep, isPathAllowed stays strict for Write/Edit/Bash
- [Phase quick-260328-bjv]: SSE activity indicators use EventSource opened only during isLoading+taskId, formatToolName maps SDK tools to human labels
- [Phase quick-260328-bxt]: FOLLOW-UP MODE prompt pattern: Task Context + Plan (2000 char) + History (last 20, 500 char each) + Message + Instructions
- [Phase quick-260328-c3k]: settingSources: ['project'] is safe because data/CLAUDE.md project boundary prevents upward traversal to GSD root CLAUDE.md
- [Phase quick-260328-cyc]: Query registry pattern: Map<runId, queryRef> for install tool hot-reload via setMcpServers
- [Phase quick-260328-e6x]: Hints section placed between MCP tools list and workspace boundary notice in CLAUDE.md for maximum agent visibility
- [Phase quick-260328-its]: Failure path re-queries employee/task from DB since agentId const not in catch scope
- [Phase quick-260328-kp5]: Tamir flat desk: cos/ directory itself is the desk, no subdirectories for planning or manager
- [Phase quick-260328-kp5]: Install flow delegates to Tamir via invokeAgent with claude_code preset tools (no direct execSync)
- [Phase quick-260328-l84]: Installer SKILL.md follows same format as memory-management skill; install prompts reference installer skill procedure
- [Phase quick-260328-lt5]: Global skills separated from cos: global/skills/ for all agents, cos/skills/ for Tamir only
- [Phase quick-260328-ofg]: Refresh/remove actions delegate to Tamir via invokeAgent with skill-tool-manager skill, using synthetic taskId for system management

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: SDK subprocess model with per-invocation MCP servers needs spike validation before full build
- [Phase 3]: Tamir routing structured output schema design may benefit from research during planning

### Roadmap Evolution

- Phase 5 added: Langfuse integration
- Phase 6 added: Sandboxing Agents

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260327-fhz | End-to-end flow test: run Tamir routing, planning session with typewriter canvas, approval, and worker execution | 2026-03-27 | 709504c | [260327-fhz-end-to-end-flow-test-run-tamir-routing-p](./quick/260327-fhz-end-to-end-flow-test-run-tamir-routing-p/) |
| 260327-wry | Live agent activity feed: show tool calls, elapsed time, and summaries in Build Log | 2026-03-27 | a168c09 | [260327-wry-live-agent-activity-feed-show-claude-age](./quick/260327-wry-live-agent-activity-feed-show-claude-age/) |
| 260328-188 | Fix planning desk CLAUDE.md to list MCP tools available during planning | 2026-03-28 | e0cac66 | [260328-188-fix-mcp-tools-and-skills-not-showing-dur](./quick/260328-188-fix-mcp-tools-and-skills-not-showing-dur/) |
| 260328-1iv | Give planning agents full tool access by removing tools:[] restriction | 2026-03-28 | 72073cf | [260328-1iv-give-planning-agents-full-tool-access-re](./quick/260328-1iv-give-planning-agents-full-tool-access-re/) |
| 260328-1qu | Fix skills and MCP tools not browsable in gallery during planning | 2026-03-28 | 73f739e | [260328-1qu-fix-skills-and-mcp-tools-not-browsable-d](./quick/260328-1qu-fix-skills-and-mcp-tools-not-browsable-d/) |
| 260328-9l3 | Fix 200s agent timeout - remove hardcoded CLAUDE_CODE_USE_BEDROCK=1 (user has OAuth) | 2026-03-28 | pending | [260328-9l3-fix-slow-agent-invocations-remove-hard](./quick/260328-9l3-fix-slow-agent-invocations-remove-hard/) |
| 260328-9r1 | Enable all gallery sources by default, replace ClawHub with skills.sh, show summaries | 2026-03-28 | 6884968 | [260328-9r1-enable-all-gallery-sources-by-default-re](./quick/260328-9r1-enable-all-gallery-sources-by-default-re/) |
| 260328-b1z | Fix sandbox bypass - switch permissionMode to acceptEdits so canUseTool runs | 2026-03-28 | pending | [260328-b1z-fix-sandbox-bypass-switch-permissionmode](./quick/260328-b1z-fix-sandbox-bypass-switch-permissionmode/) |
| 260328-b2e | Fix planning agents not having read access to project source code | 2026-03-28 | 47e7eff | [260328-b2e-fix-planning-agents-not-having-proper-to](./quick/260328-b2e-fix-planning-agents-not-having-proper-to/) |
| 260328-bjv | Add inline planning activity indicators and fix hardcoded port | 2026-03-28 | 11a10c6 | [260328-bjv-add-inline-planning-activity-indicators-](./quick/260328-bjv-add-inline-planning-activity-indicators-/) |
| 260328-bxt | Include conversation history in deliverable chat for context-rich follow-up | 2026-03-28 | 0e64ea2 | [260328-bxt-include-conversation-history-in-delivera](./quick/260328-bxt-include-conversation-history-in-delivera/) |
| 260328-c3k | Fix skills/tools not being used by agents - enable settingSources: ['project'] | 2026-03-28 | 7e120a9 | [260328-c3k-fix-skills-tools-not-being-used-by-agent](./quick/260328-c3k-fix-skills-tools-not-being-used-by-agent/) |
| 260328-c6r | Fix deliverables incorrectly showing in Vault page - filter to vault+knowledge sources | 2026-03-28 | 352e5d2 | [260328-c6r-fix-deliverables-incorrectly-showing-in-](./quick/260328-c6r-fix-deliverables-incorrectly-showing-in-/) |
| 260328-cjp | Fix Active Tasks count showing completed tasks | 2026-03-28 | 5e78774 | [260328-cjp-fix-active-tasks-count-showing-completed](./quick/260328-cjp-fix-active-tasks-count-showing-completed/) |
| 260328-cyc | Implement install_tool and install_skill MCP tools with dept head approval | 2026-03-28 | 5015eae | [260328-cyc-implement-install-tool-and-install-skill](./quick/260328-cyc-implement-install-tool-and-install-skill/) |
| 260328-e6x | Pass CEO-hinted skills/tools from plan to executing agent via desk CLAUDE.md | 2026-03-28 | ea73626 | [260328-e6x-pass-ceo-hinted-skills-tools-from-plan-t](./quick/260328-e6x-pass-ceo-hinted-skills-tools-from-plan-t/) |
| 260328-euh | Generate README.md and commit vault data files to git | 2026-03-28 | 047866f | [260328-euh-generate-readme-md-and-commit-vault-data](./quick/260328-euh-generate-readme-md-and-commit-vault-data/) |
| 260328-its | Show agent switch bounding boxes in build log for review handoffs | 2026-03-28 | ed37f54 | [260328-its-show-agent-switch-bounding-boxes-in-buil](./quick/260328-its-show-agent-switch-bounding-boxes-in-buil/) |
| 260328-j0g | Fix skill install - skills CLI needs display name not directory name | 2026-03-28 | pending | [260328-j0g-fix-skill-install-skills-cli-needs-displ](./quick/260328-j0g-fix-skill-install-skills-cli-needs-displ/) |
| 260328-k2o | switch composio and glama mcp registries with smithery.ai for querying and installing external MCP reliably via a CLI | 2026-03-28 | a9a5612 | [260328-k2o-switch-composio-and-glama-mcp-registries](./quick/260328-k2o-switch-composio-and-glama-mcp-registries/) |
| 260328-kp5 | Restructure install flow: Tamir as installer, rename global to cos, full data access for Tamir | 2026-03-28 | da01264 | [260328-kp5-restructure-install-flow-tamir-as-instal](./quick/260328-kp5-restructure-install-flow-tamir-as-instal/) |
| 260328-l84 | Create Tamir installer skill and enrich install_tool/install_skill prompts with full context | 2026-03-28 | 26e5d53 | [260328-l84-create-tamir-installer-skill-and-enrich-](./quick/260328-l84-create-tamir-installer-skill-and-enrich-/) |
| 260328-lt5 | Restore global/ skills directory as canonical source, separate from cos/ Tamir-specific skills | 2026-03-28 | 97744cc | [260328-lt5-restore-global-skills-directory-as-canon](./quick/260328-lt5-restore-global-skills-directory-as-canon/) |
| 260328-ofg | Department skills and tools gallery UI with refresh/remove actions via CoS | 2026-03-28 | b90d7f5 | [260328-ofg-department-skills-and-tools-gallery-ui-w](./quick/260328-ofg-department-skills-and-tools-gallery-ui-w/) |
| 260328-oqj | Add description field to all global and cos skills to match Anthropic skill format | 2026-03-28 | 8f688a3 | [260328-oqj-add-description-field-to-all-global-and-](./quick/260328-oqj-add-description-field-to-all-global-and-/) |

## Session Continuity

Last session: 2026-03-28T14:51:38.265Z
Stopped at: Completed quick/260328-oqj
Last activity: 2026-03-28 - Completed quick task 260328-oqj: Add description field to all global and cos skills to match Anthropic skill format
Resume file: None
