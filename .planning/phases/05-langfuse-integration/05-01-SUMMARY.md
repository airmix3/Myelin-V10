---
phase: 05-langfuse-integration
plan: 01
subsystem: observability
tags: [langfuse, opentelemetry, tracing, otel, agent-observability]

# Dependency graph
requires:
  - phase: 02-agent-execution
    provides: invokeAgent() wrapper, instrumentation.ts bootstrap sequence
provides:
  - Langfuse OTel SDK conditional initialization at server boot
  - withAgentObservation() wrapper for agent invocation tracing
  - isLangfuseEnabled() status check for UI badges
affects: [05-langfuse-integration]

# Tech tracking
tech-stack:
  added: ["@langfuse/tracing@5.0.1", "@langfuse/otel@5.0.1", "@opentelemetry/sdk-node@0.214.0", "@opentelemetry/api@1.9.1"]
  patterns: [conditional-otel-init, agent-observation-wrapper, deterministic-trace-ids]

key-files:
  created: [src/lib/langfuse.ts]
  modified: [src/instrumentation.ts, src/lib/invoke-agent.ts, package.json]

key-decisions:
  - "Dynamic imports for all Langfuse/OTel packages to keep edge runtime clean"
  - "No per-message child observations inside SDK query loop (Pitfall 4: subprocess context doesn't propagate)"
  - "Outer try/catch in withAgentObservation falls through to fn() if Langfuse itself errors"

patterns-established:
  - "Conditional OTel: check env vars once at module load, no-op path when disabled"
  - "Agent observation wrapper: setup code outside, query execution inside observation"
  - "Deterministic trace IDs: createTraceId(taskId) for task-trace correlation"

requirements-completed: [LANG-01, LANG-02, LANG-03, LANG-04, LANG-05]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 5 Plan 1: Langfuse SDK + Agent Tracing Summary

**Langfuse OTel SDK v5 conditional init with agent observation wrapping on every invokeAgent() call using deterministic task-based trace IDs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T18:26:09Z
- **Completed:** 2026-03-27T18:29:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Installed Langfuse tracing + OTel packages with verified single @opentelemetry/api copy
- Created src/lib/langfuse.ts with conditional activation, HMR-safe singleton, and fail-silent error handling
- Wired initLangfuse() into instrumentation.ts bootstrap (step 5.5, before worker loop)
- Wrapped invokeAgent() query execution in withAgentObservation() for per-invocation agent spans

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Langfuse packages and create tracing module** - `d74d8f0` (feat)
2. **Task 2: Wire Langfuse init into instrumentation.ts and wrap invokeAgent()** - `d5dbee5` (feat)

## Files Created/Modified
- `src/lib/langfuse.ts` - Langfuse conditional tracing module (initLangfuse, isLangfuseEnabled, withAgentObservation)
- `src/instrumentation.ts` - Added Langfuse OTel init at step 5.5 in bootstrap sequence
- `src/lib/invoke-agent.ts` - Wrapped query execution in withAgentObservation()
- `package.json` - Added @langfuse/tracing, @langfuse/otel, @opentelemetry/sdk-node, @opentelemetry/api

## Decisions Made
- Dynamic imports for all Langfuse/OTel packages: keeps edge runtime clean, matches existing instrumentation.ts pattern
- No per-message child observations in SDK query loop: SDK subprocess context doesn't propagate (Pitfall 4), aggregate agent-level observation is sufficient for D-01 hierarchical visualization
- Outer try/catch in withAgentObservation: if Langfuse itself fails (import error, API issue), falls through to execute fn() directly -- agent execution is never blocked

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration.** Users must:
- Create a Langfuse Cloud account at cloud.langfuse.com
- Create a project and generate API keys
- Add `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` to `.env`
- System works normally without these keys (tracing silently disabled)

## Known Stubs

None - all functions are fully implemented with conditional activation paths.

## Next Phase Readiness
- Langfuse tracing module ready for Plan 2 (settings badge, system info endpoint)
- isLangfuseEnabled() export available for UI status display
- All agent invocations will produce Langfuse traces when API keys are configured

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 05-langfuse-integration*
*Completed: 2026-03-27*
