---
phase: quick-260328-txi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/page.tsx
  - src/app/DashboardClient.tsx
autonomous: true
requirements: [QUICK-TXI]
must_haves:
  truths:
    - "Dashboard shows a list of in-progress deliverables with title, department, and relative time"
    - "Each deliverable links to its detail page at /deliverables/{id}"
    - "Empty state shown when no in-progress deliverables exist"
  artifacts:
    - path: "src/app/page.tsx"
      provides: "Fetches in-progress deliverables from DB and passes to client"
    - path: "src/app/DashboardClient.tsx"
      provides: "Renders in-progress deliverables list card"
  key_links:
    - from: "src/app/page.tsx"
      to: "src/app/DashboardClient.tsx"
      via: "inProgressDeliverables prop"
      pattern: "inProgressDeliverables"
---

<objective>
Add an in-progress deliverables list to the dashboard so the CEO can see what is currently being worked on, not just a count.

Purpose: Visibility into active work products without navigating to the deliverables page.
Output: Updated dashboard with a new "In Progress" deliverables card in the grid.
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/page.tsx
@src/app/DashboardClient.tsx
@prisma/schema.prisma (Deliverable model: id, taskId, title, type, status, department, creatorId, workspacePath, manifestPath, primaryFile, createdAt, updatedAt)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add in-progress deliverables fetch and list card to dashboard</name>
  <files>src/app/page.tsx, src/app/DashboardClient.tsx</files>
  <action>
**In `src/app/page.tsx`:**
1. Add a new query to the existing `Promise.all` array:
   ```
   prisma.deliverable.findMany({
     where: { status: 'in-progress' },
     select: { id: true, title: true, department: true, taskId: true, createdAt: true },
     orderBy: { createdAt: 'desc' },
     take: 10,
   })
   ```
2. Destructure the result as `inProgressDeliverables` from the Promise.all.
3. Pass `inProgressDeliverables` to DashboardClient as a new prop, mapping `createdAt` to ISO string (same pattern as `initialActivities`).

**In `src/app/DashboardClient.tsx`:**
1. Add a `Deliverable` interface: `{ id: string; title: string; department: string; taskId: string; createdAt: string }`.
2. Add `inProgressDeliverables: Deliverable[]` to the `DashboardClientProps` interface.
3. After the existing `grid-2` div (which has Agent Status and Recent Activity), add a new card section. Use a full-width card below the grid-2 div (NOT inside grid-2, to avoid cramming 3 cards into a 2-col grid).
4. The card structure:
   - `className="card"` with `card-title` "IN-PROGRESS DELIVERABLES"
   - If empty: show dim text "No deliverables in progress" (same empty state pattern as other panels)
   - If populated: render each deliverable as a row with:
     - Department badge using existing `deptBadgeClass()` helper
     - Title as a link: `<a href={/deliverables/${d.id}}>{d.title}</a>` styled with `color: var(--text-primary); text-decoration: none; font-weight: 500`
     - Relative time using existing `formatRelativeTime()` helper, right-aligned, dim text
   - Row styling: `display: flex; alignItems: center; gap: 8px; marginBottom: 8px` (matches existing activity row pattern)

Do NOT add any new CSS classes or modify cortex.css. Reuse existing card, card-title, badge-*, and inline style patterns already in the component.
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit src/app/page.tsx src/app/DashboardClient.tsx 2>&1 | head -20</automated>
  </verify>
  <done>Dashboard shows in-progress deliverables list below the 2-column grid. Each item has department badge, linked title, and relative timestamp. Empty state handled gracefully. TypeScript compiles without errors.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes for both files
- Dev server renders dashboard at localhost:3011 with the new deliverables card
- Card shows "No deliverables in progress" when none exist, or lists them with department badge + title link + time
</verification>

<success_criteria>
- In-progress deliverables visible on dashboard without navigating away
- Each deliverable shows title, department badge, and relative time
- Each title links to /deliverables/{id}
- Matches existing dashboard styling patterns (card, badges, inline styles)
</success_criteria>

<output>
After completion, create `.planning/quick/260328-txi-show-in-progress-deliverables-list-on-da/260328-txi-SUMMARY.md`
</output>
