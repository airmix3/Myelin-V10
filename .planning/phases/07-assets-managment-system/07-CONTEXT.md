# Phase 7: Assets Management System - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the company asset management system — the layer above deliverables where the CEO creates, manages, and develops intimate understanding of what the company owns. Assets are company-level things managed over time (vs deliverables which are task-scoped outputs). The system includes: asset data model with multi-location tracking and dependency graph, promotion flow from deliverables, steward agent pattern, health monitoring, CEO creation UI, and a SimCity-inspired interactive city/map visualization where assets appear as buildings that grow with maturity.

</domain>

<decisions>
## Implementation Decisions

### Asset Promotion Flow
- **D-01:** Two paths to asset creation: (1) CEO creates from scratch via "Create Asset" in the asset panel (for pre-existing things like codebase, brand), (2) Promote from deliverable — steward assesses and recommends, CEO confirms
- **D-02:** Steward-initiated promotion: dept head invokes the steward (via custom MCP tool) after accepting a deliverable. Steward assesses whether it should become part of an asset. This resolves steward ambiguity — the dept head picks which steward context to invoke
- **D-03:** CEO-initiated promotion: from the deliverable page, CEO picks a steward from a dropdown and provides free-text intent describing how they see the asset. Steward then acts on it
- **D-04:** Files are copied to a dedicated asset directory (`data/assets/{assetId}/`) on promotion — not referenced in place
- **D-05:** Assets are living containers — a single asset can absorb multiple deliverables over time (e.g., codebase grows with each coding task, course absorbs lessons)
- **D-06:** After promotion, the steward plans follow-up tasks (QA, integration, polish) that go through the normal planning flow. CEO approves these
- **D-07:** Steward promotion recommendation appears as a banner on the deliverable page. CEO sees it next time they visit and can act or dismiss

### Asset Data Model & Categories
- **D-08:** Fixed set of possible categories: code, brand, IP, digital-product, knowledge. Companies activate the ones relevant to them — not all companies have all categories
- **D-09:** Maturity lifecycle tracked per asset: nascent → developing → established → foundational → legacy → heritage. CEO sets maturity manually. Steward may suggest transitions
- **D-10:** Multi-location tracking with canonical marker. Each asset can have multiple "manifestations" (local path, GitHub URL, platform URL). One marked canonical/production. System surfaces divergence
- **D-11:** Explicit dependency graph between assets. Assets can reference other assets as dependencies. System surfaces ripple effects ("if logo changes, these 3 assets need updating")
- **D-12:** No explicit versioning — evolution ribbon (temporal history) tracks changes. Assets are continuous living things, not versioned artifacts
- **D-13:** CEO annotations: free-text notes on assets that persist across sessions ("watch this area", "good for investor deck"). Visible to steward agents and CEO's future self
- **D-14:** Event log table (`asset_events`) stores timestamped events per asset: promotion, annotation, maturity change, steward assessment, deliverable absorbed, dependency added. Powers evolution ribbon and narrative history
- **D-15:** Each asset gets a directory (`data/assets/{assetId}/`) containing .md files, steward notes, and the asset files themselves if managed locally. DB records in both `assets` table and `asset_events` table
- **D-16:** Assets FTS5-indexed for search — title, description, category, annotations, and steward narratives. Uses existing FTS5 infrastructure
- **D-17:** New asset-specific MCP tools: update_asset_health, add_asset_event, link_asset_dependency, suggest_asset_promotion. Role-gated like existing tools

### Asset Portrait & City Visualization
- **D-18:** SimCity-inspired interactive city/map as the primary /assets page. Assets are buildings/structures that visually grow as they mature. Each category has distinct architectural style (tech district for code, media district for content, etc.)
- **D-19:** Canvas-based rendering (like NeuralHero animation pattern in the codebase). Full Canvas rendering with custom drawing for buildings, districts, activity particles
- **D-20:** Pannable and zoomable city view. City grows as assets are added. CEO can explore by panning and zooming into districts for detail
- **D-21:** Side panel opens on asset click (stays on map page). Shows Past/Present/Future timeline, steward info, health, linked tasks, return factor
- **D-22:** Inline steward chat in the detail panel. CEO can ask questions about the asset ("what changed since last week?", "is this healthy?"). Uses existing agent invocation pattern
- **D-23:** Per-asset evolution timeline at bottom of map when asset selected. Shows milestones: born, major changes, steward assessments, deliverables absorbed. When nothing selected, shows recent activity across all assets

### Return Factor System
- **D-24:** Four return factors available: Revenue generation, Competitive moat, Core technology, Brand equity. Each describes the business value an asset provides
- **D-25:** Qualitative labels for now — no numeric tracking. Steward narratives mention impact qualitatively. Quantitative tracking can be added later with actual integrations
- **D-26:** Assets can have multiple return factors (1-4). Primary factor drives dominant glow color; secondary factors add subtle tones
- **D-27:** Color-coded glow/aura per factor in city view: Revenue = gold, Moat = blue, Core tech = green, Brand equity = purple. Multiple factors = blended aura

### Stewardship & Health Signals
- **D-28:** Steward assignment is CEO-assigned at asset creation time. In the future this becomes part of onboarding. No auto-assignment
- **D-29:** Steward mode for existing agents (CTO/CMO/COO) — same agent identity, different system prompt + workspace when invoked for asset work. No new agent identities
- **D-30:** Steward invoked on schedule (global cadence for now, may become category-specific later) + triggered on change (deliverable absorbed, events). Produces plain-language narrative stored as asset event
- **D-31:** Four health signals tracked: freshness/last activity, steward narrative summary, dependency health, return factor tracking
- **D-32:** Alerts via both visual degradation on city map (cracks, dimming, decay) for ambient awareness AND escalation through Tamir (CoS) for critical issues
- **D-33:** Steward can auto-create low-priority maintenance tasks. Major changes still need CEO approval. Steward has a maintenance budget
- **D-34:** No asset seeding on startup — CEO creates all assets deliberately through the UI
- **D-35:** New sidebar item "Assets" below Deliverables in the Cortex sidebar navigation

### Claude's Discretion
- Exact Canvas drawing style for buildings, districts, and particles
- Specific SimCity-inspired architectural styles per category
- Steward system prompt content and workspace structure
- MCP tool parameter schemas and access control details
- Asset directory internal file structure (.md naming conventions)
- Evolution ribbon visual design
- Global health check cadence default value
- "Create Asset" form field layout and UX details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Asset system philosophy and design
- `docs/13_ASSETS_SYSTEM.md` — Complete asset system philosophy, category definitions, stewardship model, interaction guide, connector model, and design principles. THE canonical reference for this phase.

### Visual reference
- `tmp/image-657666c8-20ef-41c3-a345-b1a41766de5b.png` — CEO-provided reference image showing asset map UI with spatial layout, detail panel with Past/Present/Future, evolution timeline, and distinct visual styles per category

### Existing patterns to follow
- `src/lib/mcp/tools/deliverable.ts` — Current promote_to_deliverable tool implementation. Asset promotion builds on this pattern
- `src/app/components/NeuralHero.tsx` — Canvas-based rendering pattern to follow for the city visualization
- `src/lib/mcp/server.ts` — MCP server factory where new asset tools will be registered
- `src/lib/mcp/access-control.ts` — Role-based access control pattern for new MCP tools
- `src/lib/fts.ts` — FTS5 search infrastructure to extend for asset indexing
- `prisma/schema.prisma` — Current schema with Deliverable model; Asset model + AssetEvent model to be added
- `src/lib/worker.ts` — Worker loop pattern for scheduled steward health checks
- `src/components/Sidebar.tsx` — Sidebar navigation where "Assets" item will be added

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NeuralHero.tsx` Canvas animation pattern: setTimeout firing chain, gradient glows, particle systems — reusable for city building rendering
- `promote_to_deliverable` MCP tool: file copy + manifest + FTS5 indexing pattern — basis for asset promotion tool
- SSE event bus: can stream asset change events to the city view for real-time visual updates
- Escalation system: existing Tamir escalation pipeline for critical steward alerts
- FTS5 infrastructure: `fts.ts` module for indexing asset content

### Established Patterns
- MCP tool creation: `tool()` from SDK + zod schemas + ToolContext + role-based access control
- DB access: Prisma for CRUD, better-sqlite3 for FTS5 and raw SQL
- Page architecture: Server Component + Client island pattern (page.tsx + *Client.tsx)
- Agent invocation: `invokeAgent()` wrapper with preset, soul.md, workspace isolation
- File-based state: JSONL for chat history, JSON manifests for deliverable metadata

### Integration Points
- Sidebar: Add "Assets" nav item in `Sidebar.tsx`
- Deliverable page: Add "Promote to Asset" button + steward dropdown + steward recommendation banner
- Worker loop: Add scheduled steward health check invocations
- MCP server: Register new asset-specific tools
- Prisma schema: Add Asset, AssetEvent, AssetLocation, AssetDependency models
- FTS5: Add asset search index alongside existing document/deliverable indexes
- Escalation: Steward critical alerts route through Tamir's existing escalation pipeline

</code_context>

<specifics>
## Specific Ideas

- "SimCity vibes — a city you build where you see how much each asset grows over time and makes revenue"
- CEO-provided reference image shows: spatial map with distinct visual clusters per category, detail panel with Past/Present/Future timeline, evolution ribbon at bottom, dark theme
- Return factor glow colors: Revenue = gold, Moat = blue, Core tech = green, Brand equity = purple
- Buildings visually grow as assets mature (nascent = small structure, foundational = towering landmark)
- Unhealthy assets show visual degradation (cracks, dimming, decay) — ambient awareness without notifications
- "The steward and the head of dept might be the same agent but with different context, system prompt, and potentially even workspace"
- Dept head invokes steward via custom tool — prevents steward ambiguity
- Steward can auto-create low-priority maintenance tasks without CEO approval

</specifics>

<deferred>
## Deferred Ideas

- Category-specific health check cadences (daily for code, monthly for brand) — start with global, evolve later
- Quantitative return factor tracking (actual revenue numbers, moat scores) — start with qualitative labels
- Asset onboarding flow (CEO describes company assets during initial setup) — future phase
- Connector model for external platform sync (GitHub, YouTube, CMS) — future phase, Phase 7 does multi-location tracking as metadata only
- Cross-asset portfolio analytics (where energy is going, category growth trends) — future iteration
- "The system remembers what the founder has seen" — engagement tracking for continuity across sessions
- Comparison view ("show me this asset a month ago") — future enhancement on top of event log

</deferred>

---

*Phase: 07-assets-managment-system*
*Context gathered: 2026-03-30*
