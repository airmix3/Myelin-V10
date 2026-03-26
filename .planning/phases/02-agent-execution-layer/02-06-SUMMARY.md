---
phase: 02-agent-execution-layer
plan: 06
subsystem: agent-skills
tags: [skills, memory, extraction, reset, global-skills, procedures]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure
    provides: "Department filesystem structure with global skills directory"
provides:
  - "3 active global skills: memory-management, skill-extractor, system-reset"
  - "MEMORY.md journal format specification (4 sections)"
  - "Skill extraction procedure for executors and supervisors"
  - "System reset confirmation flow via Tamir"
affects: [agent-invocation, supervisor-review, tamir-routing]

# Tech tracking
tech-stack:
  added: []
  patterns: ["YAML frontmatter skill format", "Step-by-step procedure structure with goal/trigger/procedure/edge-cases"]

key-files:
  created:
    - "data/departments/global/skills/memory-management/SKILL.md"
    - "data/departments/global/skills/skill-extractor/SKILL.md"
    - "data/departments/global/skills/system-reset/SKILL.md"
  modified: []

key-decisions:
  - "MEMORY.md uses 4-section journal format: Recent Projects, Company Conventions, Goals, Notes"
  - "Skill extraction has two trigger points: executor mid-task and supervisor post-approval"
  - "System reset has single confirmation gate with real counts summary"

patterns-established:
  - "Global skill SKILL.md format: YAML frontmatter (name, status, scope, version) + goal + trigger + procedure + edge cases"

requirements-completed: [GSKILL-01, GSKILL-02, GSKILL-03]

# Metrics
duration: 2min
completed: 2026-03-26
---

# Phase 02 Plan 06: Global Skills Summary

**Three global skills (memory-management, skill-extractor, system-reset) as step-by-step procedures with YAML frontmatter, clear goals, trigger conditions, and edge case handling**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T08:24:37Z
- **Completed:** 2026-03-26T08:26:42Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Created memory-management skill with MEMORY.md journal format (4 sections: Recent Projects, Company Conventions, Goals, Notes) and read/write procedures using read_memory/write_memory tools
- Created skill-extractor skill with dual trigger points (executor mid-task, supervisor post-approval), extraction criteria, propose_skill workflow, and approval chain documentation
- Created system-reset skill with CEO-via-Tamir confirmation flow, 6-step procedure, preservation rules (vault, DNA, skills, permanent employees), and edge case handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Three global skills** - `e839b10` (feat)

## Files Created/Modified
- `data/departments/global/skills/memory-management/SKILL.md` - Agent memory read/write procedures with MEMORY.md journal format
- `data/departments/global/skills/skill-extractor/SKILL.md` - Reusable pattern extraction for executors and supervisors
- `data/departments/global/skills/system-reset/SKILL.md` - Safe system reset with CEO confirmation via Tamir

## Decisions Made
- MEMORY.md uses 4-section journal format per D-08: Recent Projects, Company Conventions, Goals, Notes
- Skill extraction has two trigger points per D-09: executor captures mid-task, supervisor does dedicated pass post-approval
- System reset uses single confirmation gate per D-10: summary with real counts, then explicit CEO confirmation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 global skills are active and ready to be symlinked into agent workspaces
- Skills follow the established YAML frontmatter format for consistent parsing
- Memory management skill defines the MEMORY.md format that agents will use once invokeAgent() is wired up

## Self-Check: PASSED

All 3 SKILL.md files verified present. SUMMARY.md created. Commit e839b10 verified in git log.

---
*Phase: 02-agent-execution-layer*
*Completed: 2026-03-26*
