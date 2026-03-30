# Phase 7: Assets Management System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 07-assets-managment-system
**Areas discussed:** Asset promotion flow, Asset data model & categories, Asset portrait & viewing, Stewardship & health signals, Return factor system

---

## Asset Promotion Flow

| Option | Description | Selected |
|--------|-------------|----------|
| CEO promotes from deliverable page | From existing deliverable workspace, CEO clicks "Promote to Asset" and writes free-text intent | |
| Agent proposes, CEO confirms | Supervisor agent assesses asset-worthiness and proposes | |
| Both paths available | CEO can promote directly AND agents can propose. CEO always has final say | ✓ (modified) |

**User's choice:** Both paths, but with important clarification: the asset steward (not any agent) is the one to suggest promotion. Steward is invoked by the dept head after accepting a deliverable. The CEO can also intervene at end of task and suggest integration — triggering a discussion with the relevant steward.

| Option | Description | Selected |
|--------|-------------|----------|
| Reference, don't replicate | Asset points to where files live | |
| Copy to asset directory | Files copied to data/assets/{assetId}/ | ✓ |
| You decide | | |

**User's choice:** Copy to asset directory

| Option | Description | Selected |
|--------|-------------|----------|
| Steward plans follow-up tasks | Steward assesses needs and creates tasks through normal flow | ✓ |
| Just a status change | No automatic follow-up | |
| Steward proposes, CEO decides | Steward suggests, CEO picks | |

| Option | Description | Selected |
|--------|-------------|----------|
| Assets are living containers | Single asset absorbs multiple deliverables over time | ✓ |
| 1:1 mapping | Each asset from one deliverable | |

| Option | Description | Selected |
|--------|-------------|----------|
| Chat with steward | CEO opens conversation with steward from deliverable page | |
| Structured form + notes | CEO fills in form, steward acts | |
| Quick action + optional notes | One-click + optional free-text | |

**User's choice:** Similar to option 1 but CEO must choose a steward from a dropdown (because ambiguity) and also has a bar to enter free text.

| Option | Description | Selected |
|--------|-------------|----------|
| Banner on deliverable page | Visible "Steward recommends promotion" card | ✓ |
| Escalation feed | Surfaces in existing escalation system | |
| Both | Banner + escalation | |

**Notes:** Steward is invoked by dept head via custom tool, not automatically. In most cases the task plan already indicates if output is asset-bound.

---

## Asset Data Model & Categories

| Option | Description | Selected |
|--------|-------------|----------|
| Seed with Doc 13 categories, allow custom | Start with predefined, CEO can add | |
| Fully flexible | Categories are just labels | |
| Fixed categories only | Hard-code Doc 13 categories | |

**User's choice:** Fixed set of possible categories (code, brand, IP, digital-product, knowledge) but not all companies have all of them — companies activate relevant ones.

| Option | Description | Selected |
|--------|-------------|----------|
| CEO sets maturity manually | Maturity is a field CEO adjusts, steward may suggest | ✓ |
| Auto-detected from activity | System infers maturity from patterns | |
| Not in Phase 7 | Skip maturity, just active/archived | |

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-location with canonical marker | Multiple manifestations, one canonical | ✓ |
| Single canonical location | One primary location | |
| Defer to later | Track local only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit dependency graph | Assets reference other assets | ✓ |
| Lightweight tags only | Loose groupings via tags | |
| Defer to later | Independent entities for now | |

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit versions for major changes | Version numbers, major/minor | |
| No versions — evolution ribbon only | Continuous, temporal history | ✓ |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Free-text annotations on assets | CEO pins notes that persist | ✓ |
| Not in Phase 7 | Skip annotations | |

| Option | Description | Selected |
|--------|-------------|----------|
| Event log table (asset_events) | Dedicated table, timestamped events | ✓ |
| JSONL file per asset | Log file in asset directory | |
| You decide | | |

**User's choice on storage:** Asset directory with .md files + asset itself if local. DB records in assets table and asset_events table.

| Option | Description | Selected |
|--------|-------------|----------|
| FTS5 indexed | Title, description, category, annotations indexed | ✓ |
| Not initially | Browsable only, no search | |

| Option | Description | Selected |
|--------|-------------|----------|
| Asset-specific MCP tools | update_asset_health, add_asset_event, etc. | ✓ |
| Reuse existing tools | Interact through existing tools | |
| You decide | | |

---

## Asset Portrait & City Visualization

| Option | Description | Selected |
|--------|-------------|----------|
| Category-grouped gallery | Grouped cards with freshness cues | |
| Single flat list | Filterable list | |
| Spatial/visual landscape | 2D space with visual nodes | |

**User's choice:** Like option 1 but inspired by video games — SimCity/quest-builder style where assets are buildings in a city. Gamified, shows growth and revenue.

**Reference image provided:** `tmp/image-657666c8-20ef-41c3-a345-b1a41766de5b.png` — spatial map with distinct category clusters, detail panel with Past/Present/Future, evolution timeline.

| Option | Description | Selected |
|--------|-------------|----------|
| Side panel on map page | Click opens detail panel, stay on map | ✓ |
| Navigate to /assets/[id] | Full detail page | |
| Panel preview + drill-down | Both panel and full page | |

| Option | Description | Selected |
|--------|-------------|----------|
| Inline steward chat in panel | Compact chat in detail panel | ✓ |
| Separate steward page | Dedicated conversation page | |
| Defer chat to later | Panel shows data only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Per-asset when selected | Selected asset's milestones; global when nothing selected | ✓ |
| Always global | Company-wide activity with highlighting | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Canvas-based (like NeuralHero) | Full Canvas rendering | ✓ |
| CSS/SVG positioned elements | DOM-based positioning | |
| Hybrid Canvas + DOM | Canvas background + DOM overlay | |

| Option | Description | Selected |
|--------|-------------|----------|
| Pannable and zoomable | City grows, CEO explores | ✓ |
| Fixed viewport | All assets fit one screen | |
| You decide | | |

---

## Stewardship & Health Signals

| Option | Description | Selected |
|--------|-------------|----------|
| Category → dept head mapping | Auto-assign by category | |
| Always CEO-assigned | CEO picks steward for every asset | |
| Dept head who completed task | Lineage-based assignment | |

**User's choice:** CEO-assigned at asset creation time. Will become part of onboarding in the future. CEO uses UI to create assets and assign stewards + return factors.

| Option | Description | Selected |
|--------|-------------|----------|
| On schedule + on change | Periodic checks + event-triggered | ✓ |
| On-demand only | CEO requests assessments | |
| Event-triggered only | Only when something happens | |

**Health signals selected:** All four — freshness/last activity, steward narrative summary, dependency health, return factor tracking.

| Option | Description | Selected |
|--------|-------------|----------|
| Visual degradation on map | Ambient awareness, no push | |
| Escalation system | Uses existing escalation infra | |
| Both — visual + escalation | Visual for mild, escalation for critical | ✓ |

**Notes:** Escalation goes through Tamir (CoS).

| Option | Description | Selected |
|--------|-------------|----------|
| Steward mode for existing agents | Same identity, different context/prompt | ✓ |
| Separate steward identities | New agent entries | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Steward proposes, CEO approves | Task proposals need CEO approval | |
| Steward can auto-create low-priority | Routine maintenance auto-created | ✓ |
| Always through CEO | No shortcut | |

| Option | Description | Selected |
|--------|-------------|----------|
| Category-specific cadence | Different intervals per category | |
| Global cadence | All assets same interval | ✓ |
| You decide | | |

**Notes:** Global cadence for now — may change in the future.

| Option | Description | Selected |
|--------|-------------|----------|
| No seeding — CEO creates all | Assets are intentional | ✓ |
| Seed one example | Create one codebase asset | |
| Seed from deliverables | Scan and suggest | |

| Option | Description | Selected |
|--------|-------------|----------|
| Create from scratch + promote | Two paths: create new + promote from deliverable | ✓ |
| Promote only | Assets only from deliverables | |

| Option | Description | Selected |
|--------|-------------|----------|
| New sidebar item below Deliverables | Add "Assets" to sidebar | ✓ |
| Replace Deliverables page | Assets subsumes deliverables | |
| Dashboard integration | Embed in dashboard | |

---

## Return Factor System

**Return factors selected:** All four — Revenue generation, Competitive moat, Core technology, Brand equity.

| Option | Description | Selected |
|--------|-------------|----------|
| Color-coded glow/aura | Revenue=gold, Moat=blue, Tech=green, Brand=purple | ✓ |
| Icon/badge overlay | Small icons on buildings | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Qualitative labels for now | Tags describing business role | ✓ |
| Quantitative from the start | Estimated values and scores | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Multiple factors allowed (1-4) | Primary drives dominant glow, secondary adds tones | ✓ |
| Single primary factor only | One factor per asset | |

---

## Claude's Discretion

- Canvas drawing style and building architectures per category
- Steward system prompt content and workspace structure
- MCP tool parameter schemas and access control
- Asset directory file naming conventions
- Evolution ribbon visual design
- Global health check cadence default
- Create Asset form layout

## Deferred Ideas

- Category-specific cadences — future iteration
- Quantitative return factor tracking — future iteration
- Onboarding flow for asset creation — future phase
- External platform connectors (GitHub, YouTube sync) — future phase
- Portfolio analytics — future iteration
- Engagement tracking ("remembers what founder has seen") — future iteration
- Comparison view ("show me a month ago") — future enhancement
