# 05 -- The Cortex: UI Design System & All Pages

## Overview

The Cortex is Myelin's web dashboard built with Next.js 14 App Router. It provides:
- Real-time visibility into all agent activity
- Task planning interface (Tamir tab)
- Deliverable workspace with chat + agent log + build log + file browser
- Management pages: org chart, budget, skills, vault, hires

## Tech Stack

- **Next.js 14** -- App Router with Server Components + Client Components
- **CSS** -- Custom CSS variables (dark theme), NO Tailwind/Bootstrap
- **marked.js** -- Client-side markdown rendering
- **SSE** -- Server-Sent Events for real-time push updates

## Design System

**Canonical rule**: `12_VISUAL_GUIDELINES.md` is the single source of truth for colors, typography, spacing, radius, badges, buttons, chat bubbles, tabs, and gallery cards. This doc describes page layout and behavior only. If this doc and Doc 12 ever disagree, **Doc 12 wins**.

### Color Palette (CSS Variables)

See `12_VISUAL_GUIDELINES.md` and copy the token values from there verbatim. Do **not** redefine or improvise values in implementation.

### Agent Colors

Use the department/avatar color mapping from `12_VISUAL_GUIDELINES.md`.

### Badge System

Use the badge classes and exact styling from `12_VISUAL_GUIDELINES.md`.

## Layout Structure

```
+--sidebar (200px)--+--main (flex: 1)--+
|                   |                   |
| Logo              | Header + status   |
| Nav links         |                   |
|   Dashboard       | Page content      |
|   Tamir           |                   |
|   Deliverables    |                   |
|   Org Context     |                   |
|   Vault           |                   |
+-------------------+-------------------+
```

**6 core pages total.** The focused v10 scope is: Dashboard, Tamir, Deliverables, Org Context, Vault, and a minimal Agent Profile stub. Larger admin surfaces (org chart, sessions, budget, standalone skills page, graph, DNA editor) are deferred to v10.1.

## All Pages

### 1. Dashboard (/)
- Stats row: Active Agents, Active Tasks, Pending Approvals, Deliverables (auto-refresh 15s)
- Live agent status panel (colored dots: green=active, amber=recent, gray=idle)
- Recent activity timeline (last 10 entries)
- Message flow between agents

### 2. Tamir (/tamir) -- SEE DOC 06 FOR FULL SPEC
- Chat interface + plan canvas

### 3. Deliverables (/deliverables) + Workspace -- SEE DOC 07 FOR FULL SPEC
- Gallery grid of all deliverables
- In-progress tasks shown at top with amber border
- In-progress cards should open the live workspace when available
- Filter by department, search by content

### 4. Organizational Context (/org-context)

The central page for browsing all institutional knowledge, organized by department. Replaces the old "Memory" page.

**Layout:**
```
+--Department Selector (tabs: Tech | Marketing | Operations)------------------+
|                                                                             |
|  +-- Left Column (60%) -------------------+  +-- Right Column (40%) ------+ |
|  |                                        |  |                             | |
|  | [Agent Memory]                          |  | [Employees]                 | |
|  | MEMORY.md entries per agent (browsable)|  | Dept head + team            | |
|  | for selected department namespace.     |  | Click employee card:        | |
|  |                                        |  | > Avatar + name             | |
|  | [Knowledge Library: Extension Gallery] |  | > Role, status dot          | |
|  | VS Code-style gallery cards/grid:      |  | > Agent memories preview     | |
|  | > icon + title + short description     |  | > Past tasks accordion      | |
|  | > tags + updated date + status badge   |  |   [v] ZUNA eval             | |
|  | > quick actions: Preview | Open        |  |      Summary, tools, skills,| |
|  | > expandable detail panel per item     |  |      deliverable link       | |
|  |                                        |  |   [v] Deploy model ...      | |
|  | [Tools & Skills: Extension Gallery]    |  | > "View full profile"       | |
|  | Unified VS Code Marketplace-like view: |  |   -> /agents/{id}           | |
|  | > tool/skill cards with icon + name    |  |                             | |
|  | > publisher/owner + description        |  |                             | |
|  | > install status (active/pending)      |  |                             | |
|  | > expandable card body for full docs   |  |                             | |
|  +----------------------------------------+  +-----------------------------+ |
+-----------------------------------------------------------------------------+
```

**Department Tabs** -- Three tabs at top: Tech, Marketing, Operations. Clicking switches all content below.

**Left Column:**

1. **Agent Memory** -- MEMORY.md entries for agents in this department. Each agent's memory file is displayed as a collapsible card with the agent's name. Contents are rendered as markdown. The CEO can browse what each agent has learned across past tasks.

2. **Knowledge Library** -- Files from `data/departments/{dept}/knowledge/`. Each file rendered as a card with title, first 2 lines preview, last modified date. Click to expand inline and see full rendered markdown.

3. **Tools & Skills** -- Two sub-sections:
   - Tools: MCP servers registered to this department. Card per tool with name, description, status badge.
   - Skills: SKILL.md files for this department. Card per skill with name, description, tags, status (active/pending). Pending skills show "Approve" button for CEO.

**Right Column: Employees**

Shows all employees in the selected department (head + permanent + active temps).

Each employee card:
- Avatar circle (colored by role)
- Name, role, status dot (green/amber/gray)
- Recent memory entries (last 3 lines from their MEMORY.md)
- **Past Tasks** -- Expandable accordion. Each past task shows:
  - Task name/description (clickable header to expand)
  - When expanded:
    - One-line deliverable summary
    - Tools used during task
    - Skills used during task
    - Link to deliverable: "View deliverable ->" navigates to /deliverables/{id}
    - Status badge (completed/failed)
- **"View full profile"** link at bottom -> navigates to `/agents/{id}`

### 5. Agent Profile Stub (/agents/{id})

This page exists in v10 specifically to avoid a dead link from Org Context. It is read-only and intentionally simple.

Minimum contents:

- agent name, role, department, status
- rendered `card.json`
- rendered `MEMORY.md`
- recent and past task list with deliverable links

**API Endpoints:**
- `GET /api/org-context/{dept}` -- Returns department memory, knowledge files, tools, skills, employees with their task history
- `GET /api/org-context/{dept}/memory` -- Returns MEMORY.md contents for all agents in this department
- `GET /api/org-context/{dept}/knowledge` -- List knowledge files
- `GET /api/org-context/{dept}/knowledge/{filename}` -- Get rendered knowledge file content
- `GET /api/agents/{id}` -- Agent profile payload for the `/agents/{id}` stub page

### 6. Vault (/vault)
- Permanent document store
- FTS5 search
- File documents by department/tags
- Survives system resets

---

## Deferred Pages (v10.1)

The following pages are NOT in v10 scope. They can be added later without changing the core architecture:

- Org Chart, Sessions, System Graph, Budget, Skills (standalone page), Company DNA editor
- These can be added later without changing the core architecture

**Where features surface in v10's 6 pages:**
- Skill approvals: in Org Context page (left column, Skills section)
- Hire approvals: in Dashboard (notification) + Deliverable Workspace (build log entry with approve button)
- Budget info: in Dashboard (stats row) + Deliverable Workspace (build log cost entries)
- Agent detail: minimal `/agents/{id}` stub page

## Next.js Layout

```typescript
// app/layout.tsx
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <Sidebar />
          <main className="main">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
```

```typescript
// components/Sidebar.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '&#9635;' },
  { href: '/tamir', label: 'Tamir', icon: '&#9680;' },
  { href: '/deliverables', label: 'Deliverables', icon: '&#9678;' },
  { href: '/org-context', label: 'Org Context', icon: '&#9670;' },
  { href: '/vault', label: 'Vault', icon: '&#11041;' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="name">Myelin</div>
        <div className="ver">v10 -- The Cortex</div>
      </div>
      <nav>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? 'active' : ''}
            dangerouslySetInnerHTML={{ __html: `${item.icon} ${item.label}` }}
          />
        ))}
      </nav>
    </aside>
  );
}
```

## SSE for Real-Time Updates

```typescript
// app/api/sse/route.ts -- uses shared event bus (see Doc 02)
import { eventBus } from '@/lib/events';

export async function GET() {
  let listeners: Array<[string, (data: any) => void]> = [];
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const handler = (type: string) => (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
      };
      for (const type of ['task:transition', 'task:completed', 'task:failed', 'task:heartbeat', 'task:buildlog', 'task:activity', 'agent:invoked', 'hire:requested']) {
        const fn = handler(type);
        listeners.push([type, fn]);
        eventBus.on(type, fn);
      }
    },
    cancel() {
      for (const [type, fn] of listeners) {
        eventBus.off(type, fn);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```
