# Phase 7: Assets Management System - Research

**Researched:** 2026-03-30
**Domain:** Asset data model, Canvas-based visualization, steward agent pattern, MCP tool creation
**Confidence:** HIGH

## Summary

Phase 7 builds a complete company asset management layer on top of the existing deliverable system. This is a large phase spanning five domains: (1) Prisma schema additions (Asset, AssetEvent, AssetLocation, AssetDependency models), (2) new MCP tools for asset operations, (3) a Canvas-based interactive "city map" visualization as the primary /assets page, (4) steward agent mode with scheduled health checks, and (5) promotion flow integration with the existing deliverable page.

The existing codebase provides strong patterns to follow: `NeuralHero.tsx` for Canvas rendering, `promote_to_deliverable` for the file-copy + manifest + FTS5 pattern, `worker.ts` for scheduled agent invocations, and the MCP server factory for tool registration. The primary technical risk is the Canvas city visualization complexity -- it requires custom 2D drawing for buildings, districts, pan/zoom, glow effects, and interactive hit-testing, all without a Canvas framework (per project constraints against external UI libraries).

**Primary recommendation:** Structure implementation in layers: schema + API first, then MCP tools, then steward agent mode, then city visualization (most complex), then promotion flow integration. The Canvas work should be isolated in a single `AssetCityCanvas.tsx` component following the NeuralHero pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Two paths to asset creation: CEO creates from scratch, or promote from deliverable
- **D-02:** Steward-initiated promotion: dept head invokes steward via custom MCP tool after accepting deliverable
- **D-03:** CEO-initiated promotion: from deliverable page, CEO picks steward + provides free-text intent
- **D-04:** Files copied to `data/assets/{assetId}/` on promotion (not referenced in place)
- **D-05:** Assets are living containers absorbing multiple deliverables over time
- **D-06:** Steward plans follow-up tasks through normal planning flow after promotion
- **D-07:** Steward promotion recommendation appears as banner on deliverable page
- **D-08:** Fixed categories: code, brand, IP, digital-product, knowledge
- **D-09:** Maturity lifecycle: nascent, developing, established, foundational, legacy, heritage (CEO sets manually)
- **D-10:** Multi-location tracking with canonical marker
- **D-11:** Explicit dependency graph between assets with ripple effect surfacing
- **D-12:** No explicit versioning -- evolution ribbon tracks temporal history
- **D-13:** CEO annotations (free-text notes persisting across sessions)
- **D-14:** Event log table (asset_events) for timestamped events
- **D-15:** Asset directory at `data/assets/{assetId}/` with .md files and asset files
- **D-16:** FTS5-indexed for search (title, description, category, annotations, steward narratives)
- **D-17:** New MCP tools: update_asset_health, add_asset_event, link_asset_dependency, suggest_asset_promotion
- **D-18:** SimCity-inspired interactive city/map as primary /assets page
- **D-19:** Canvas-based rendering (NeuralHero pattern)
- **D-20:** Pannable and zoomable city view
- **D-21:** Side panel on asset click with Past/Present/Future timeline
- **D-22:** Inline steward chat in detail panel
- **D-23:** Per-asset evolution timeline at bottom; recent activity when nothing selected
- **D-24:** Four return factors: Revenue generation, Competitive moat, Core technology, Brand equity
- **D-25:** Qualitative labels only (no numeric tracking)
- **D-26:** Assets can have 1-4 return factors; primary drives glow color
- **D-27:** Glow colors: Revenue=gold, Moat=blue, Core tech=green, Brand equity=purple
- **D-28:** Steward assignment is CEO-assigned at creation time
- **D-29:** Steward mode = same agent, different system prompt + workspace
- **D-30:** Steward invoked on schedule (global cadence) + triggered on change
- **D-31:** Four health signals: freshness, steward narrative, dependency health, return factor tracking
- **D-32:** Alerts via visual degradation on map AND escalation through Tamir
- **D-33:** Steward can auto-create low-priority maintenance tasks; major changes need CEO approval
- **D-34:** No asset seeding on startup -- CEO creates all assets deliberately
- **D-35:** New sidebar item "Assets" below Deliverables

### Claude's Discretion
- Exact Canvas drawing style for buildings, districts, and particles
- Specific SimCity-inspired architectural styles per category
- Steward system prompt content and workspace structure
- MCP tool parameter schemas and access control details
- Asset directory internal file structure (.md naming conventions)
- Evolution ribbon visual design
- Global health check cadence default value
- "Create Asset" form field layout and UX details

### Deferred Ideas (OUT OF SCOPE)
- Category-specific health check cadences
- Quantitative return factor tracking
- Asset onboarding flow
- Connector model for external platform sync
- Cross-asset portfolio analytics
- Engagement tracking ("the system remembers what the founder has seen")
- Comparison view ("show me this asset a month ago")
</user_constraints>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 7.5.0 | Schema migration for Asset/AssetEvent/AssetLocation/AssetDependency models | Already used for all DB access |
| better-sqlite3 | 12.8.0 | FTS5 virtual table for assets_fts + raw SQL for event queries | Already used for FTS5 infrastructure |
| Canvas 2D API | native | City visualization rendering | Per D-19, follows NeuralHero.tsx pattern. No external canvas library needed |
| zod | 4.3.6 | MCP tool parameter schemas | Required by Agent SDK, already in project |
| @anthropic-ai/claude-agent-sdk | 0.2.83 | tool() for new MCP tools, agent invocation for steward mode | Already the agent runtime |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gray-matter | 4.0.3 | Parsing asset .md files with frontmatter | Asset directory .md file parsing |
| marked | 17.0.5 | Rendering steward narratives and annotations | Detail panel content display |
| proper-lockfile | 4.1.2 | Concurrent access to asset event log files | If JSONL-based event supplements are used |
| node-cron | 4.2.1 | Steward health check scheduling | Global cadence scheduled invocations |

### No New Dependencies Needed
This phase uses only existing project dependencies. The Canvas 2D API is a native browser API. No canvas framework (Konva, PixiJS, Fabric.js) is needed -- the NeuralHero pattern demonstrates that custom canvas drawing with requestAnimationFrame is sufficient and aligns with the project's no-frameworks constraint.

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure
```
prisma/
  schema.prisma              # Add Asset, AssetEvent, AssetLocation, AssetDependency models
  migrations/                # New migration for asset tables
src/
  app/
    assets/
      page.tsx               # Server Component (fetch assets for SSR)
      AssetsClient.tsx        # Client island with canvas + panels
      AssetCityCanvas.tsx     # Canvas rendering engine
      AssetDetailPanel.tsx    # Right slide-in panel
      AssetToolbar.tsx        # Floating toolbar (create, filters, zoom)
      EvolutionTimeline.tsx   # Bottom timeline component
      CreateAssetModal.tsx    # Asset creation form modal
      canvas/                 # Canvas drawing utilities
        buildings.ts          # Building shape rendering per category
        districts.ts          # District layout + label rendering
        effects.ts            # Glow, particles, degradation effects
        hit-test.ts           # Click/hover detection on canvas objects
        viewport.ts           # Pan/zoom state + transforms
    deliverables/
      PromotionBanner.tsx     # Steward recommendation banner
      PromoteToAssetModal.tsx # CEO-initiated promotion modal
  app/api/
    assets/
      route.ts               # GET (list all), POST (create)
      [assetId]/
        route.ts              # GET (single), PATCH (update), DELETE (archive)
        events/route.ts       # GET (event history)
        annotations/route.ts  # POST (add annotation)
        locations/route.ts    # GET/POST/PATCH locations
        dependencies/route.ts # GET/POST/DELETE dependencies
        chat/route.ts         # POST (steward chat invocation)
    deliverables/
      [id]/
        promote/route.ts      # POST (promote deliverable to asset)
  lib/
    mcp/tools/
      asset.ts               # New asset MCP tools (4 tools per D-17)
    steward.ts               # Steward invocation logic (mode switching, workspace)
    asset-fts.ts             # FTS5 for assets (separate from documents_fts)
data/
  assets/
    {assetId}/               # Per-asset directory with .md files + asset files
```

### Pattern 1: Prisma Schema Extension
**What:** Add four new models to the existing schema following established conventions.
**When to use:** All asset CRUD operations.
**Example:**
```prisma
model Asset {
  id            String   @id
  title         String
  description   String?
  category      String           // code|brand|IP|digital-product|knowledge
  maturity      String   @default("nascent") // nascent|developing|established|foundational|legacy|heritage
  stewardId     String?          // agentId of assigned steward (cto/cmo/coo)
  returnFactors String?          // JSON array: ["revenue","moat","core_tech","brand_equity"]
  annotations   String?          // JSON array of {text, createdAt} objects
  healthStatus  String   @default("healthy") // healthy|stale|degraded|critical
  directoryPath String?          // data/assets/{assetId}/
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  events        AssetEvent[]
  locations     AssetLocation[]
  // Dependencies modeled as self-referential via AssetDependency
  @@map("assets")
}

model AssetEvent {
  id        String   @id
  assetId   String
  type      String   // promotion|annotation|maturity_change|steward_assessment|deliverable_absorbed|dependency_added|location_added|health_change
  summary   String
  metadata  String?  // JSON
  agentId   String?
  createdAt DateTime @default(now())

  asset     Asset    @relation(fields: [assetId], references: [id])
  @@map("asset_events")
}

model AssetLocation {
  id          String   @id
  assetId     String
  type        String   // local_path|github_url|platform_url|custom
  value       String   // The actual path/URL
  label       String?  // Human-readable label
  isCanonical Boolean  @default(false)
  createdAt   DateTime @default(now())

  asset       Asset    @relation(fields: [assetId], references: [id])
  @@map("asset_locations")
}

model AssetDependency {
  id          String   @id
  sourceId    String   // The asset that depends on...
  targetId    String   // ...this asset
  label       String?  // Relationship description
  createdAt   DateTime @default(now())

  @@map("asset_dependencies")
}
```

### Pattern 2: Canvas City Rendering (following NeuralHero)
**What:** Full Canvas 2D rendering with requestAnimationFrame, custom building shapes, pan/zoom via transform matrix.
**When to use:** The /assets page primary view.
**Key differences from NeuralHero:**
- NeuralHero uses normalized 0-1 coordinates; city canvas uses world coordinates with viewport transform
- City needs hit-testing (which building did the user click?); NeuralHero is non-interactive
- City needs pan/zoom via mouse drag and wheel; NeuralHero is static viewport
- Buildings have distinct shapes per category; NeuralHero has uniform nodes

**Viewport transform pattern:**
```typescript
interface Viewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}

function worldToScreen(wx: number, wy: number, vp: Viewport): [number, number] {
  return [
    (wx - vp.offsetX) * vp.scale,
    (wy - vp.offsetY) * vp.scale,
  ];
}

function screenToWorld(sx: number, sy: number, vp: Viewport): [number, number] {
  return [
    sx / vp.scale + vp.offsetX,
    sy / vp.scale + vp.offsetY,
  ];
}
```

**Hit testing pattern:**
```typescript
function hitTest(worldX: number, worldY: number, assets: AssetRenderData[]): string | null {
  // Iterate in reverse (top-drawn = highest priority)
  for (let i = assets.length - 1; i >= 0; i--) {
    const a = assets[i];
    if (worldX >= a.x - a.width/2 && worldX <= a.x + a.width/2 &&
        worldY >= a.y - a.height && worldY <= a.y) {
      return a.id;
    }
  }
  return null;
}
```

### Pattern 3: MCP Tool Creation (following deliverable.ts)
**What:** New asset tools registered in the MCP server factory.
**When to use:** Agent interactions with assets (steward operations).
**Example:**
```typescript
export function createAssetTools(ctx: ToolContext) {
  const suggestAssetPromotion = tool(
    'suggest_asset_promotion',
    'Recommend that a deliverable should be promoted to a company asset.',
    {
      deliverable_id: z.string().describe('ID of the deliverable to promote'),
      asset_name: z.string().describe('Suggested name for the asset'),
      rationale: z.string().describe('Why this should become a company asset'),
      category: z.enum(['code','brand','IP','digital-product','knowledge']),
    },
    async (args) => {
      // Create promotion recommendation record
      // This will appear as a banner on the deliverable page (D-07)
      // ...
    },
  );
  return [suggestAssetPromotion, /* other tools */];
}
```

### Pattern 4: Steward Agent Mode (following existing invoke pattern)
**What:** Same agent identity, different system prompt when invoked for asset stewardship.
**When to use:** Scheduled health checks, promotion assessments, CEO steward chat.
**Key insight:** Use `orchestrator.invoke()` with a steward-specific soul prompt appended, pointing CWD to the asset directory.
```typescript
// Steward invocation wraps normal invoke with asset context
async function invokeSteward(opts: {
  assetId: string;
  agentId: string; // cto/cmo/coo
  prompt: string;
  taskId: string;
  runId: string;
}) {
  const assetDir = path.resolve(process.cwd(), 'data', 'assets', opts.assetId);
  const deskDir = path.join(assetDir, 'steward-desk');
  // Ensure steward desk exists
  mkdirSync(deskDir, { recursive: true });

  return orchestrator.invoke({
    taskId: opts.taskId,
    runId: opts.runId,
    agentId: opts.agentId,
    prompt: opts.prompt,
    deskDir,
    delivDir: assetDir, // steward writes to asset dir
    manifestPath: path.join(assetDir, 'asset_manifest.json'),
    // Steward system prompt injected via soul.md append
  });
}
```

### Pattern 5: FTS5 for Assets (following fts.ts)
**What:** Separate FTS5 virtual table for asset search alongside the existing documents_fts.
**When to use:** Asset search from the toolbar and from `search_knowledge` tool.
```typescript
// In asset-fts.ts, following fts.ts pattern
export function initAssetsFTS5(): void {
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
      title,
      description,
      category,
      content='assets',
      content_rowid='rowid',
      tokenize='porter unicode61'
    );
  `);
  // Sync triggers for assets table...
}
```

### Anti-Patterns to Avoid
- **Don't use a Canvas library (Konva/PixiJS/Fabric):** Project constraint against external UI frameworks. NeuralHero proves raw Canvas 2D is sufficient.
- **Don't create new agent identities for stewards:** Per D-29, steward mode uses existing CTO/CMO/COO agents with different context. Do not seed new employees.
- **Don't use React state management for Canvas:** Follow NeuralHero pattern -- useRef for mutable state, requestAnimationFrame for rendering. Don't put canvas render state in React useState.
- **Don't version assets:** Per D-12, no explicit versioning. Evolution ribbon built from asset_events temporal query.
- **Don't auto-seed assets on startup:** Per D-34, CEO creates all assets deliberately.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FTS5 indexing | Custom search implementation | SQLite FTS5 with porter tokenizer | Already proven in fts.ts, handles ranking and snippets |
| Agent invocation | Custom LLM call for steward | `orchestrator.invoke()` with steward context | Handles tool loop, cost tracking, session management |
| File locking | Manual fs mutex | `proper-lockfile` | Already used for JSONL files, handles race conditions |
| ID generation | UUID or custom format | `generateId('asset')` / `generateId('aevt')` | Consistent with project ID pattern |
| Event bus | Custom pub/sub for asset changes | Existing `eventBus` from `src/lib/events.ts` | SSE already wired to stream all event types |

**Key insight:** Every infrastructure piece needed (FTS5, agent invocation, event bus, MCP server, access control, worker scheduling) already exists in the codebase. This phase composes existing patterns rather than inventing new infrastructure.

## Common Pitfalls

### Pitfall 1: Canvas Performance with Many Assets
**What goes wrong:** Drawing dozens of buildings with glow effects, particles, and dependency lines every frame causes jank.
**Why it happens:** Canvas 2D glow effects (shadowBlur) are expensive. Redrawing everything on every frame when most buildings are static.
**How to avoid:** Use a dirty-flag pattern -- only redraw when viewport changes, asset data changes, or animations are active. Pre-render static building shapes to offscreen canvases (per-building sprite caching). Limit particle count.
**Warning signs:** requestAnimationFrame callback taking >16ms consistently.

### Pitfall 2: Pan/Zoom Coordinate Confusion
**What goes wrong:** Click events report screen coordinates, but assets live in world coordinates. Hit-testing fails because coordinates aren't transformed correctly.
**Why it happens:** Canvas `ctx.setTransform()` affects drawing but not event coordinates. Must manually convert mouse events.
**How to avoid:** Always convert mouse event coordinates through `screenToWorld()` before hit-testing. Keep viewport state in a ref, not in canvas transform state.

### Pitfall 3: Prisma Migration on Existing Database
**What goes wrong:** Adding new tables to the existing SQLite database fails or causes data loss.
**Why it happens:** Prisma migration on SQLite has limitations (no ALTER TABLE for some operations).
**How to avoid:** New tables (assets, asset_events, asset_locations, asset_dependencies) are purely additive -- no changes to existing tables. Use `prisma migrate dev` to create migration. If foreign keys to existing tables are needed (e.g., Deliverable -> Asset link), add nullable columns only.

### Pitfall 4: Steward Invocation Creating Orphan Task Records
**What goes wrong:** Steward health checks and assessments create task records that clutter the task list and confuse the CEO.
**Why it happens:** The current flow creates a Task + TaskRun for every agent invocation.
**How to avoid:** Create steward invocations with a special metadata flag (`{ type: 'steward_health_check', assetId }`) and filter them from the main task list in the UI. Or use a lightweight invocation path that doesn't require a full task record.

### Pitfall 5: FTS5 Sync Triggers Not Firing for Prisma Writes
**What goes wrong:** Assets created via Prisma don't appear in FTS5 search results.
**Why it happens:** The existing FTS5 pattern uses SQLite triggers on INSERT/UPDATE/DELETE. These fire for raw SQLite writes but should also fire for Prisma writes (since Prisma uses the same SQLite driver underneath). However, the `content=` directive for external content tables requires careful trigger setup.
**How to avoid:** Follow the exact same pattern as `documents_fts` in `fts.ts` -- the triggers fire regardless of whether Prisma or raw SQLite performs the write. Verify with a test after implementation.

### Pitfall 6: Asset Directory Not Created Before File Copy
**What goes wrong:** Promoting a deliverable to an asset fails with ENOENT because `data/assets/{assetId}/` doesn't exist yet.
**Why it happens:** The asset record is created in DB but the directory isn't created until file copy time.
**How to avoid:** Create the asset directory immediately when the Asset record is created, before any file operations. Same pattern as `createTaskWorkspace()`.

## Code Examples

### API Route Pattern (following existing routes)
```typescript
// src/app/api/assets/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

export async function GET() {
  const assets = await prisma.asset.findMany({
    include: { events: { orderBy: { createdAt: 'desc' }, take: 5 }, locations: true },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json(assets);
}

export async function POST(request: Request) {
  const body = await request.json();
  const assetId = generateId('asset');
  const dirPath = resolve(process.cwd(), 'data', 'assets', assetId);
  mkdirSync(dirPath, { recursive: true });

  const asset = await prisma.asset.create({
    data: {
      id: assetId,
      title: body.title,
      description: body.description,
      category: body.category,
      stewardId: body.stewardId,
      returnFactors: JSON.stringify(body.returnFactors || []),
      directoryPath: dirPath,
    },
  });

  // Create birth event
  await prisma.assetEvent.create({
    data: {
      id: generateId('aevt'),
      assetId,
      type: 'creation',
      summary: `Asset "${body.title}" created by CEO`,
    },
  });

  return NextResponse.json(asset, { status: 201 });
}
```

### Canvas Glow Effect (following NeuralHero pattern)
```typescript
function drawBuildingGlow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  width: number, height: number,
  glowColor: string,
  intensity: number
) {
  ctx.save();
  ctx.shadowBlur = 15 * intensity;
  ctx.shadowColor = glowColor;
  ctx.fillStyle = glowColor + '40'; // 25% opacity
  ctx.fillRect(x - width/2, y - height, width, height);
  ctx.restore();
}
```

### Dependency Graph Query
```typescript
// Get all assets affected if a given asset changes (ripple effect per D-11)
function getDependentAssets(assetId: string): Array<{ id: string; title: string }> {
  return sqlite.prepare(`
    WITH RECURSIVE ripple(id) AS (
      SELECT sourceId FROM asset_dependencies WHERE targetId = ?
      UNION
      SELECT ad.sourceId FROM asset_dependencies ad
      JOIN ripple r ON ad.targetId = r.id
    )
    SELECT a.id, a.title FROM assets a
    JOIN ripple r ON a.id = r.id
  `).all(assetId) as Array<{ id: string; title: string }>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Canvas libraries (Konva, Fabric) | Raw Canvas 2D with requestAnimationFrame | Project convention | NeuralHero establishes the pattern; no library overhead |
| Separate FTS5 module per entity | Reusable FTS5 init pattern from fts.ts | Phase 1 | Follow same trigger-based sync pattern for assets |
| Custom agent mode switching | Same agent, different system prompt via invoke | D-29 decision | No new agent identities; steward is a context overlay |

## Open Questions

1. **Steward health check scheduling mechanism**
   - What we know: D-30 says global cadence, node-cron is available in `instrumentation.ts`
   - What's unclear: Should this be a cron job that queries all assets and invokes stewards? Or should it add to the worker queue?
   - Recommendation: Use node-cron to periodically enqueue steward health check task_runs into the existing worker queue. This reuses the concurrency/heartbeat infrastructure. Default cadence: every 24 hours.

2. **Deliverable-to-Asset link in schema**
   - What we know: D-05 says assets absorb multiple deliverables
   - What's unclear: Whether to add an `assetId` column to the Deliverable model or track via asset_events
   - Recommendation: Add nullable `assetId` to Deliverable model for direct query capability. Also create a `deliverable_absorbed` asset event for the timeline.

3. **Steward task record handling**
   - What we know: Agent invocations require task + task_run records
   - What's unclear: Whether steward operations should create visible tasks or be hidden
   - Recommendation: Create tasks with `metadata: { stewardOperation: true }` and filter from main task lists. Steward tasks visible only in the asset detail panel's linked tasks section.

4. **Canvas building layout algorithm**
   - What we know: Districts are loosely clustered zones (D-18), not rigid grids
   - What's unclear: Exact algorithm for placing buildings within districts and preventing overlap
   - Recommendation: Use a simple force-directed layout within districts. Each district has a center point. Buildings are placed with random offset from center, then pushed apart if overlapping. Store positions in the asset record or compute deterministically from assetId hash.

## Project Constraints (from CLAUDE.md)

- **CSS:** Custom CSS variables only -- no Tailwind, no Bootstrap (add new variables to `cortex.css` per UI spec)
- **Tech Stack:** TypeScript/Node.js only
- **Database:** SQLite via Prisma + better-sqlite3 for FTS5
- **LLM:** AWS Bedrock via environment variables
- **Agent Runtime:** Claude Agent SDK -- use `invokeAgent()` wrapper, never call API directly
- **State Management:** React useState + useRef only, no Redux/Zustand
- **Streaming:** SSE via event bus, no WebSocket
- **A2A States:** Standard 6 states only (submitted, working, input-required, completed, failed, canceled)
- **IDs:** `generateId(prefix)` pattern
- **MCP:** Single in-process server via `createSdkMcpServer()`, per-invocation ToolContext
- **Zod:** v4 only (not v3)

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `prisma/schema.prisma`, `src/lib/fts.ts`, `src/lib/mcp/server.ts`, `src/lib/mcp/tools/deliverable.ts`, `src/lib/mcp/access-control.ts`, `src/lib/mcp/tool-context.ts`, `src/lib/worker.ts`, `src/instrumentation.ts`, `src/app/components/NeuralHero.tsx`, `src/components/Sidebar.tsx`
- Phase context: `07-CONTEXT.md` with 35 locked decisions
- UI spec: `07-UI-SPEC.md` with complete visual contract
- Design philosophy: `docs/13_ASSETS_SYSTEM.md`
- CEO reference image: `tmp/image-657666c8-20ef-41c3-a345-b1a41766de5b.png`

### Secondary (MEDIUM confidence)
- Canvas 2D pan/zoom patterns: standard browser API, well-documented

### Tertiary (LOW confidence)
- None -- all recommendations based on existing codebase patterns and locked decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - every pattern derived from existing codebase conventions
- Pitfalls: HIGH - identified from direct code analysis (e.g., FTS5 trigger pattern, directory creation timing)

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable -- no external dependency changes)
