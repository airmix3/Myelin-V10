---
phase: 07-assets-managment-system
plan: 05
subsystem: api, ui, agents
tags: [steward, promotion, chat, assets, mcp, deliverables]

requires:
  - phase: 07-assets-managment-system
    provides: Asset/AssetEvent Prisma models, REST API, MCP tools, AssetDetailPanel with chat stub
  - phase: 02-agent-execution
    provides: invokeAgent, orchestrator, MCP server, tool-context
provides:
  - Steward invocation module (invokeSteward) wrapping existing agents with asset context
  - POST /api/assets/[assetId]/chat endpoint for steward conversations
  - POST /api/deliverables/[id]/promote endpoint for deliverable-to-asset promotion
  - PromotionBanner component for steward promotion recommendations
  - PromoteToAssetModal component for CEO-initiated promotion
  - Working steward chat in AssetDetailPanel
  - Deliverable page integration with promotion UI
affects: []

tech-stack:
  added: []
  patterns:
    - "Steward mode: existing agent + steward system prompt + asset desk directory"
    - "Lightweight steward tasks with stewardOperation:true metadata for UI filtering"
    - "Deliverable promotion copies files to asset directory and creates Asset+AssetEvent records"

key-files:
  created:
    - src/lib/steward.ts
    - src/app/api/assets/[assetId]/chat/route.ts
    - src/app/api/deliverables/[id]/promote/route.ts
    - src/app/deliverables/PromotionBanner.tsx
    - src/app/deliverables/PromoteToAssetModal.tsx
  modified:
    - src/app/assets/AssetDetailPanel.tsx
    - src/app/deliverables/[id]/WorkspaceClient.tsx

key-decisions:
  - "Steward uses orchestrator.getAgent() for soulMd rather than separate soul loading"
  - "Steward tasks marked with stewardOperation:true in metadata for filtering from main task list"
  - "Promotion route handles both new asset creation and absorbing into existing assets"

patterns-established:
  - "Steward desk pattern: data/assets/{assetId}/steward-desk/ with CLAUDE.md boundary"
  - "Promotion flow: file copy + Asset record + creation/promotion AssetEvents + deliverable.assetId link"

requirements-completed: [ASSET-19, ASSET-20, ASSET-21, ASSET-22, ASSET-23, ASSET-24]

duration: 5min
completed: 2026-03-30
---

# Phase 07 Plan 05: Steward & Promotion Summary

**Steward agent mode with asset-context chat, deliverable-to-asset promotion flow, and inline steward chat wired in detail panel**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T04:33:56Z
- **Completed:** 2026-03-30T04:38:56Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- invokeSteward() wraps invokeAgent with steward system prompt, asset desk, and cost-tracked task records
- Steward chat API at /api/assets/[assetId]/chat validates steward assignment and invokes agent
- Promotion API at /api/deliverables/[id]/promote copies files, creates asset records, supports existing asset absorption
- AssetDetailPanel steward chat fully wired with message history, auto-scroll, loading state
- PromotionBanner and PromoteToAssetModal integrated into deliverable workspace page

## Task Commits

Each task was committed atomically:

1. **Task 1: Steward invocation module + chat API** - `14647b9` (feat)
2. **Task 2: Deliverable promotion flow + deliverable page UI additions** - `4f6b202` (feat)
3. **Task 3: Wire steward chat into detail panel + deliverable page integration** - `0b5657f` (feat)

## Files Created/Modified
- `src/lib/steward.ts` - Steward invocation: builds steward prompt, creates desk/task, calls invokeAgent
- `src/app/api/assets/[assetId]/chat/route.ts` - POST endpoint for steward chat with validation
- `src/app/api/deliverables/[id]/promote/route.ts` - Promotion endpoint: file copy, asset creation, events
- `src/app/deliverables/PromotionBanner.tsx` - Banner for steward promotion recommendations with accept/dismiss
- `src/app/deliverables/PromoteToAssetModal.tsx` - Modal with steward select, category, intent, return factors
- `src/app/assets/AssetDetailPanel.tsx` - Replaced chat stub with working steward chat (messages, form, auto-scroll)
- `src/app/deliverables/[id]/WorkspaceClient.tsx` - Added PromotionBanner, Promote button, PromoteToAssetModal

## Decisions Made
- Used orchestrator.getAgent() to get soulMd for steward invocations (avoids duplicating soul loading logic)
- Steward tasks marked with stewardOperation:true metadata for easy filtering from main task list
- Promotion route supports both new asset creation and absorption into existing assets via existingAssetId param

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added soulMd to invokeAgent call via orchestrator lookup**
- **Found during:** Task 1 (Steward invocation module)
- **Issue:** Plan's code sample didn't include soulMd parameter which is required by invokeAgent
- **Fix:** Used orchestrator.getAgent(agentId) to retrieve registered agent config including soulMd
- **Files modified:** src/lib/steward.ts
- **Committed in:** 14647b9

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for invokeAgent API compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 07 complete: all 5 plans executed
- Asset system fully operational: data layer, MCP tools, canvas visualization, overlay components, steward mode, promotion flow

---
*Phase: 07-assets-managment-system*
*Completed: 2026-03-30*
