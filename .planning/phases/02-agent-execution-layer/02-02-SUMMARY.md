---
phase: 02-agent-execution-layer
plan: 02
subsystem: agents
tags: [agent-identity, soul-md, persona, executive-agents, seed-script]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure
    provides: Prisma schema with Employee model, generateId utility, logger, db module
provides:
  - 4 executive agent directories with soul.md, card.json, agent.ts
  - AgentConfig interface and getAgentConfig() factory
  - seedAgents() function for database population
affects: [02-agent-execution-layer, 03-ui-tamir-interface]

# Tech tracking
tech-stack:
  added: []
  patterns: [agent-directory-structure, soul-md-systemPrompt-pattern, card-json-metadata]

key-files:
  created:
    - src/agents/tamir/soul.md
    - src/agents/tamir/card.json
    - src/agents/tamir/agent.ts
    - src/agents/cto/soul.md
    - src/agents/cto/card.json
    - src/agents/cto/agent.ts
    - src/agents/cmo/soul.md
    - src/agents/cmo/card.json
    - src/agents/cmo/agent.ts
    - src/agents/coo/soul.md
    - src/agents/coo/card.json
    - src/agents/coo/agent.ts
    - src/lib/seed-agents.ts
  modified: []

key-decisions:
  - "Agent soul.md files are 80-126 lines each -- comprehensive multi-section guides per D-03"
  - "agent.ts reads soul.md at import time via readFileSync for systemPrompt injection"
  - "seedAgents() is idempotent -- checks findFirst before create"

patterns-established:
  - "Agent directory pattern: src/agents/{id}/soul.md + card.json + agent.ts"
  - "AgentConfig interface: card.json fields + soulMd string from soul.md"
  - "getAgentConfig() factory: reads soul.md, spreads card.json, returns unified config"

requirements-completed: [AGENT-03]

# Metrics
duration: 4min
completed: 2026-03-26
---

# Phase 02 Plan 02: Agent Identity Summary

**4 executive agent directories (Tamir, CTO, CMO, COO) with comprehensive soul.md personas, AgentCard metadata, and database seed script**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T08:24:45Z
- **Completed:** 2026-03-26T08:29:23Z
- **Tasks:** 1
- **Files created:** 13

## Accomplishments

- 4 executive agent directories with soul.md (96-126 lines each), card.json, and agent.ts
- Tamir persona: direct and substantive Chief of Staff, no filler, routing-focused (per D-04)
- CTO/CMO/COO personas: domain experts with strong opinions who push back (per D-05)
- Agent names as role titles only (per D-06)
- seedAgents() function ready for instrumentation.ts integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Four executive agent directories with soul.md, card.json, agent.ts plus seed script** - `5070b4c` (feat)

## Files Created/Modified

- `src/agents/tamir/soul.md` - Tamir Chief of Staff persona: direct, substantive, routing-focused
- `src/agents/tamir/card.json` - Tamir AgentCard: global dept, routing tools, red avatar
- `src/agents/tamir/agent.ts` - Tamir config export with soul.md loading
- `src/agents/cto/soul.md` - CTO persona: architecture tradeoffs, code quality, technical depth
- `src/agents/cto/card.json` - CTO AgentCard: tech dept, full tool suite, blue avatar
- `src/agents/cto/agent.ts` - CTO config export
- `src/agents/cmo/soul.md` - CMO persona: narratives, audience-first, developer marketing
- `src/agents/cmo/card.json` - CMO AgentCard: marketing dept, full tool suite, pink avatar
- `src/agents/cmo/agent.ts` - CMO config export
- `src/agents/coo/soul.md` - COO persona: systems thinking, second-order effects, measurement
- `src/agents/coo/card.json` - COO AgentCard: operations dept, full tool suite, green avatar
- `src/agents/coo/agent.ts` - COO config export
- `src/lib/seed-agents.ts` - Idempotent seed function for 4 executive employees

## Decisions Made

- Agent soul.md files written as comprehensive 2-4 page guides per D-03, not minimal personas
- agent.ts uses readFileSync at import time to load soul.md content for systemPrompt injection
- seedAgents() uses findFirst check before create for idempotent operation
- Tamir budget set to $50 (higher than dept heads at $25) reflecting routing/coordination volume

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Agent identities ready for invokeAgent() integration (Plan 01 delivers the wrapper)
- seedAgents() ready to be called from instrumentation.ts (Plan 03 wiring)
- AgentConfig interface available for orchestrator singleton (Plan 01)

## Self-Check: PASSED

All 13 files verified present. Commit 5070b4c verified in git log.

---
*Phase: 02-agent-execution-layer*
*Completed: 2026-03-26*
