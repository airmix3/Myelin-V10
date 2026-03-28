---
phase: quick
plan: 260328-chj
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/Sidebar.tsx
  - src/lib/fts.ts
  - src/app/api/search/route.ts
  - src/app/search/page.tsx
  - src/app/search/SearchClient.tsx
  - public/cortex.css
autonomous: true
requirements: []

must_haves:
  truths:
    - "Search tab appears in sidebar navigation between Vault and Settings"
    - "CEO can type a query and see results grouped by source type (vault, knowledge, deliverable)"
    - "Vault/knowledge results show inline markdown preview on click"
    - "Deliverable results show title, department, status and link to /deliverables/{id}"
    - "Search is debounced (300ms) to avoid excessive API calls"
  artifacts:
    - path: "src/app/search/SearchClient.tsx"
      provides: "Search UI with debounced input and grouped results"
    - path: "src/app/api/search/route.ts"
      provides: "FTS5 search API across all document sources"
    - path: "src/lib/fts.ts"
      provides: "Extended searchDocuments to include deliverable source"
  key_links:
    - from: "src/app/search/SearchClient.tsx"
      to: "/api/search"
      via: "fetch with debounced query"
      pattern: "fetch.*api/search"
    - from: "src/app/api/search/route.ts"
      to: "searchAllDocuments"
      via: "import from fts.ts"
      pattern: "searchAllDocuments"
---

<objective>
Add a Search tab to the Cortex sidebar that provides FTS5 full-text search across vault documents, knowledge base files, and deliverables. Results are grouped by source type with inline markdown preview for vault/knowledge and navigation links for deliverables.

Purpose: Give the CEO a single search interface to find anything across the company knowledge base.
Output: Working /search page with FTS5-powered results, accessible from sidebar.
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/fts.ts (existing FTS5 module - searchDocuments only searches vault+knowledge)
@src/app/api/vault/search/route.ts (existing search endpoint pattern)
@src/app/vault/VaultClient.tsx (debounce + search result rendering pattern to replicate)
@src/components/Sidebar.tsx (add Search nav item)
@public/cortex.css (design system - use existing classes)
@src/lib/db.ts (sqlite + prisma singletons)

<interfaces>
From src/lib/fts.ts:
```typescript
export interface SearchResult {
  id: string;
  title: string;
  source: string;
  department: string | null;
  snippet: string;
  rank: number;
}
export function searchDocuments(query: string, limit?: number): SearchResult[];
```

From src/lib/db.ts:
```typescript
export const sqlite: InstanceType<typeof Database>;
export const prisma: PrismaClient;
```

Prisma Document model (maps to `documents` table):
- id, title, content, source (vault|knowledge|deliverable), department, filedBy, filePath, createdAt, updatedAt

Prisma Deliverable model:
- id, taskId, title, type, status, department, creatorId, workspacePath, primaryFile, createdAt, updatedAt
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend FTS5 search + create search API + add sidebar link</name>
  <files>src/lib/fts.ts, src/app/api/search/route.ts, src/components/Sidebar.tsx</files>
  <action>
1. In `src/lib/fts.ts`, add a new function `searchAllDocuments(query: string, limit?: number): SearchResult[]` that is identical to `searchDocuments` but removes the `AND d.source IN ('vault', 'knowledge')` filter so it returns results from ALL document sources including 'deliverable'. Keep the existing `searchDocuments` function unchanged (vault page depends on it).

2. In `src/app/api/search/route.ts`, create a GET endpoint that:
   - Reads `q` query param (same pattern as `/api/vault/search/route.ts`)
   - Calls `searchAllDocuments(query, 50)` from `@/lib/fts`
   - Also queries `prisma.deliverable.findMany()` to get deliverable metadata (id, title, type, status, department, creatorId) for any search results where `source === 'deliverable'`
   - Returns JSON: `{ results: SearchResult[], deliverables: Record<string, { id: string, title: string, type: string|null, status: string, department: string }> }`
   - The deliverables map is keyed by document ID so the client can look up deliverable metadata for deliverable-source results

3. In `src/components/Sidebar.tsx`, add a Search nav item between Vault and Settings:
   ```
   { href: '/search', label: 'Search', icon: '\u2315' }
   ```
   (Unicode 2315 is the "telephone recorder" / search-like symbol. Alternative: use '\u26B2' or simply 'Q' character if preferred.)
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit src/lib/fts.ts src/app/api/search/route.ts src/components/Sidebar.tsx 2>&1 | head -20</automated>
  </verify>
  <done>searchAllDocuments function exists in fts.ts, /api/search endpoint compiles, Search link in sidebar nav items array</done>
</task>

<task type="auto">
  <name>Task 2: Create Search page with grouped results and markdown preview</name>
  <files>src/app/search/page.tsx, src/app/search/SearchClient.tsx, public/cortex.css</files>
  <action>
1. Create `src/app/search/page.tsx` as a simple server component wrapper:
   ```tsx
   import SearchClient from './SearchClient';
   export default function SearchPage() {
     return <SearchClient />;
   }
   ```

2. Create `src/app/search/SearchClient.tsx` as a 'use client' component. Follow the VaultClient.tsx pattern closely:

   **State:**
   - `searchInput` (string) - raw input value
   - `debouncedQuery` (string) - debounced at 300ms (same useEffect pattern as VaultClient)
   - `results` (SearchResult[] | null) - from API
   - `deliverables` (Record of deliverable metadata from API)
   - `isSearching` (boolean)
   - `expandedId` (string | null) - for inline preview toggle

   **Layout:**
   - `<h1>Search</h1>`
   - Full-width search input using `search-bar` class (same as VaultClient)
   - Placeholder text: "Search vault, knowledge base, and deliverables..."
   - Below input: result count when results are shown

   **Results display (when results exist):**
   - Group results by `source` field into three sections: "Vault", "Knowledge", "Deliverables"
   - Each section has a heading with count: e.g., "Vault (3)" styled as card-title
   - Only show sections that have results

   **Vault/Knowledge result cards:**
   - Use `card` class, clickable
   - Show title (bold), department badge (using same `deptBadgeClass` helper from VaultClient), source badge
   - Show FTS5 snippet with `<mark>` highlights via dangerouslySetInnerHTML
   - On click: toggle expanded view showing full markdown content rendered via `marked.parse()`
   - To get full content for expanded view: fetch `/api/vault?id={docId}` or embed a secondary fetch. Simpler approach: fetch the document content on expand via a dedicated fetch to a new inline route, OR just show the snippet in expanded form. **Best approach:** Add a `content` field to the search API response for vault/knowledge results. Update the API in route.ts to join document content: add `d.content` to the SELECT query in `searchAllDocuments`. Update the SearchResult interface to include optional `content?: string`.

   **Deliverable result cards:**
   - Use `card` class
   - Show title (bold), department badge, type badge (use badge-done class), status badge
   - Show FTS5 snippet
   - Include a "View Deliverable" link (`<a>`) styled as `btn btn-sm` pointing to `/deliverables#{deliverableId}` (the deliverables page doesn't have individual routes, so link to the list page)
   - Do NOT expand on click (deliverables have their own workspace UI)

   **Empty states:**
   - No query yet: show centered empty-state div with "Type a query to search across all company knowledge"
   - No results: "No results found for [query]"

   **CSS considerations:**
   - Use existing cortex.css classes: `card`, `card-title`, `badge-*`, `search-bar`, `btn`, `btn-sm`, `md-render`, `empty-state`
   - Use inline styles sparingly for layout (same pattern as VaultClient)

3. In `public/cortex.css`, add minimal search-specific styles at the end (section 24):
   ```css
   /* 24. Search page */
   .search-section { margin-bottom: 24px; }
   .search-section-title {
     font-size: 11px;
     color: var(--accent);
     text-transform: uppercase;
     letter-spacing: 0.1em;
     margin-bottom: 12px;
     padding-bottom: 8px;
     border-bottom: 1px solid var(--border);
   }
   .search-result-count {
     font-size: 11px;
     color: var(--text-dim);
     margin-bottom: 16px;
   }
   ```
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit src/app/search/page.tsx src/app/search/SearchClient.tsx 2>&1 | head -20</automated>
  </verify>
  <done>Search page renders at /search, debounced input triggers API call, results grouped by source type, vault/knowledge results expand to show markdown, deliverable results link out, all styled with cortex.css variables</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes for all new/modified files
2. Dev server starts without errors: `node_modules/.bin/next dev -p 3011`
3. Navigate to http://localhost:3011/search - page loads with search input
4. Search for a term that exists in vault documents - results appear grouped by source
5. Click a vault/knowledge result - markdown preview expands inline
6. Sidebar shows Search tab between Vault and Settings, highlights when active
</verification>

<success_criteria>
- Search tab visible in sidebar navigation
- FTS5 search returns results from vault, knowledge, AND deliverable documents
- Results grouped by source type with section headers
- Vault/knowledge results show snippet + expandable markdown preview
- Deliverable results show metadata + link to deliverables page
- 300ms debounced input prevents excessive API calls
- All CSS uses cortex.css custom variables (no Tailwind)
</success_criteria>

<output>
After completion, create `.planning/quick/260328-chj-add-search-tab-to-navbar-fts5-search-acr/260328-chj-SUMMARY.md`
</output>
