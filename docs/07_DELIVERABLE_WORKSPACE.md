# 07 -- Deliverable Workspace: Split Chat + Agent Log + Build Log + File Browser

## Overview

When a task is approved and executing (or completed), the CEO views it at `/deliverables/{id}`. This page is a split-pane workspace combining real-time chat with the executing agent, an SDK-backed agent platform log, a live build log, and a file browser for all workspace artifacts.

This page also serves as the continuation of the Tamir planning chat -- the entire conversation history transfers here so the CEO has full context.

**Canonical clarification**:

- Workspace chat routes to the task's `currentActorId`
- During execution, `currentActorId` is usually the `executorAgentId`
- When `currentActorId` = `supervisorAgentId`, the supervisor is actively checking the work
- If the executor was terminated, the supervisor becomes the fallback chat target
- The Deliverable tab renders the file declared by `deliverable_manifest.json` / `Deliverable.primaryFile`
- `Deliverable.filePath` points to the task root (workspace root containing both `desk/` and `deliverables/`)
- `deliverable_manifest.json` is located in the `deliverables/` directory

## Layout

```
+---- LEFT (400px) ----+------------ RIGHT (flex: 1) ---------------+
|                       |  [Meta: ID | Creator | Dept | Type]        |
|  Participants:        |  [Deliverable] [Agent Log] [Build Log]     |
|  O  C  (avatars)      |  [Files (N)]                               |
|                       |                                            |
|  [restored chat       |  +-- Active Tab Content -----------------+ |
|   from planning]      |  |                                       | |
|                       |  |  Deliverable: rendered media / md     | |
|  --- plan approved -- |  |  OR                                   | |
|                       |  |  Agent Log: SDK action chain          | |
|  [agent greeting]     |  |  OR                                   | |
|  [continued chat]     |  |  Build Log: live partial output       | |
|                       |  |  OR                                   | |
|                       |  |  Files: card grid + inline preview    | |
|  [input] [Send]       |  |                                       | |
+-----------------------+  +---------------------------------------+ |
|                                                                    |
+--------------------------------------------------------------------+
```

## Left Panel: Chat

### Participant Avatars
Top-left shows overlapping colored circles for everyone in the conversation:
- CEO (Omer): Gray circle with "O"
- Agent: Colored circle with first initial (CTO=blue "C", CMO=pink "C", etc.)
- Tooltip on hover shows name + role

### Chat History Restoration
When a deliverable was created from the Tamir planning session (metadata.source === 'tamir_chat'):
1. Load chat history from filesystem JSONL files (not DB JSON columns)
2. Render each message with correct avatar/color
3. Show divider: "-- plan approved -- task executing --"
4. Agent sends greeting: "I'm [Name]. The task is being executed. Ask me anything about progress."

### Continued Chat
CEO can type messages to discuss:
- Task progress and status
- Questions about the deliverable content
- Requests for modifications
- Follow-up tasks

Chat calls `POST /api/deliverables/{id}/chat` which routes to the task's current actor (executor during execution, supervisor during review, supervisor fallback if the executor was terminated).

### Chat Message Rendering
```typescript
interface ChatMessage {
  role: 'user' | 'agent';
  content: string;  // Markdown supported for agent messages
  timestamp: string;
  agentId?: string;
  agentName?: string;
}
```

Agent messages render markdown (via marked.js). User messages render as plain text. Each message has a timestamp.

## Right Panel: Tabbed Workspace

### Tab Bar
Four tabs at the top of the right panel:
1. **Deliverable** -- default when a primary file exists
2. **Agent Log** -- durable SDK-backed action chain
3. **Build Log** -- live partial SDK event feed while work is running
4. **Files (N)** -- shows count of workspace files

Tab selection is derived from deliverable availability and task lifecycle, not from a stored phase field.

### Tab 1: Deliverable

Full rendered content of the primary deliverable file declared by `deliverable_manifest.json`.

Rules:

- If `primaryFile` ends in `.md`, render markdown
- If it is an image, render the image
- If it is a video, render `<video>` with controls
- If it is a PDF, render the PDF viewer
- If no primary file exists, show a clear empty state instead of guessing
- If a video deliverable exists, the workspace may prioritize that file for the Deliverable tab even if the manifest's current `primaryFile` still points to `execution-summary.md`

Styled with `.md-render` class:
- h1: 18px, border-bottom
- h2: 15px, accent color
- h3: 13px, uppercase, letter-spacing
- Code blocks: dark background, monospace
- Tables: full-width, bordered
- Images: max-width 100%, bordered
- Blockquotes: left accent border

### Tab 2: Agent Log

The Agent Log is the canonical "agent platform log" surface for CEO visibility into what the running agent did, using only published SDK interfaces.

It is backed by durable `activity_log` rows derived from SDK message surfaces.

**Important distinction**:
- The Claude Agent SDK exposes message surfaces like `system/init`, `assistant`, `tool_progress`, `tool_use_summary`, and `result/success`
- Myelin normalizes those into its own durable log labels in `activity_log.actionType`
- These normalized labels are implementation-level names for UI/logging, not official Anthropic event names

Examples of SDK surface -> Myelin log label mapping:

| SDK surface | Myelin `activity_log.actionType` |
|------------|-----------------------------------|
| `query()` call start (synthetic wrapper event) | `SDK_QUERY_START` |
| `type: "system", subtype: "init"` | `SDK_SESSION_INIT` |
| `type: "assistant"` | `SDK_ASSISTANT` |
| `type: "tool_progress"` | `SDK_TOOL_PROGRESS` |
| `type: "tool_use_summary"` | `SDK_TOOL_SUMMARY` |
| `type: "result", subtype: "success"` | `SDK_RESULT_SUCCESS` |
| `type: "result", subtype: "error_*"` | `SDK_RESULT_ERROR` |

Each entry shows:
- action type badge
- agent ID
- short description
- timestamp
- expandable metadata JSON for session IDs, tool names, stop reason, elapsed time, permission denials, token usage, and other public SDK metadata

**Important limitation**: This is an action-chain / activity-chain view, not hidden chain-of-thought. Only public SDK message surfaces plus Myelin's own normalized log wrappers are shown.

### Tab 3: Build Log

The Build Log is a lighter-weight live stream of partial SDK output, powered by `includePartialMessages: true` and SSE.

It complements the Agent Log:
- **Agent Log** = durable structured SDK activity history
- **Build Log** = live partial event feed while work is happening

Each entry has:

```
[>] [TYPE_BADGE] agent_id  Description text...           HH:MM
```

- **Chevron (>)**: Click to expand/collapse the detail view
- **Type badge**: Colored label showing action type
- **Agent ID**: Which agent performed the action
- **Description**: First 200 chars of what happened
- **Timestamp**: Time of the action

**Type badge colors:**
| Type | Color | CSS Class |
|------|-------|-----------|
| STREAM | Red (accent) | log-type-think |
| STATE_TRANSITION | Green | log-type-route |
| HEARTBEAT | Amber | log-type-tool |

**Streaming implementation**: The worker loop passes `includePartialMessages: true` to the SDK `query()` call. Partial stream events are emitted via SSE and appended immediately in the UI, so the CEO can see that work is progressing even before a durable Agent Log row is written.

While execution is running, the build log also surfaces periodic `task:heartbeat` entries so the CEO can tell the system is still alive during multi-minute work.

### Tab 4: Files (Deliverables + Desk)

The Files tab shows two sections from the task's directory structure (see Doc 02 for full spec):

1. **Deliverables** -- CEO-facing final outputs (promoted by agent from desk)
2. **Desk** -- Agent's working sandbox (scripts, drafts, raw data)

These map to the filesystem paths:
- `data/departments/{dept}/tasks/{task-slug}/deliverables/`
- `data/departments/{dept}/tasks/{task-slug}/desk/`

Deliverable files are shown prominently. Desk files are shown in a collapsible "Working Files" section below (expandable, default collapsed) so the CEO can inspect what the agent did without cluttering the main view.

The grouping comes from `deliverable_manifest.json`, not from ad-hoc filename guessing.

**Grid layout** of workspace files as clickable cards:

```
+--------+  +--------+  +--------+  +--------+
| ICON   |  | ICON   |  | ICON   |  | ICON   |
| name.py|  | data.j |  | plot.p |  | plan.m |
| 4.2 KB |  | 1.1 KB |  | 89 KB  |  | 2.3 KB |
+--------+  +--------+  +--------+  +--------+
```

**File type icons:**
| Type | Icon | Extensions |
|------|------|------------|
| Python | Diamond | .py |
| JSON | Square | .json |
| Image | Grid | .png, .jpg, .svg, .gif |
| Text/Markdown | Circle | .md, .txt |
| PDF | Rectangle | .pdf |
| Video | Play | .mp4, .webm |

**Click a card**: Opens inline preview below the grid:
- **Images**: Rendered as `<img>` tag
- **Videos**: Rendered as `<video>` with controls
- **PDFs**: Rendered as `<iframe>`
- **Markdown**: Rendered via marked.js
- **Code/text**: Rendered as `<pre>` with monospace font
- Close button to dismiss preview

**File serving:**
```typescript
// app/api/deliverables/[id]/file/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path') || '';
  const deliverable = await db.deliverable.findUnique({ where: { id: params.id } });

  const workspace = deliverable?.filePath; // Workspace root containing both desk/ and deliverables/
  if (!workspace) return new Response('No workspace', { status: 404 });

  const target = join(workspace, path);

  // Security: prevent path traversal
  if (!target.startsWith(resolve(workspace))) return new Response('Forbidden', { status: 403 });

  const ext = extname(target).toLowerCase();

  // Serve binary files directly
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.mp4', '.webm', '.pdf'].includes(ext)) {
    const buffer = readFileSync(target);
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
      '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.pdf': 'application/pdf',
    };
    return new Response(buffer, { headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' } });
  }

  // Serve text files as JSON
  const content = readFileSync(target, 'utf-8');
  return Response.json({ path, content, ext });
}
```

## Metadata Bar

Compact row above tabs:

```
ID: deliv_a1b2c3d4 | Creator: cto | Dept: [tech] | Type: report | Created: 2026-03-22 14:30 | Task: Evaluate ZUNA EEG model...
```

## Deliverable Manifest

Every workspace has a manifest in its `deliverables/` directory:

```json
{
  "version": 1,
  "title": "ZUNA EEG Evaluation",
  "primaryFile": "deliverables/report.md",
  "previewText": "Technical evaluation of the model on internal EEG recordings.",
  "deliverableFiles": [
    "deliverables/report.md",
    "deliverables/confusion_matrix.png"
  ],
  "workingFiles": [
    "desk/scripts/train.py",
    "desk/raw-data/features.csv"
  ]
}
```

This manifest is the source of truth for the Deliverable tab, gallery preview text, and Files tab grouping.

## Deliverables Gallery Integration

The gallery at `/deliverables` shows:
1. **In-progress tasks** at top (amber left border, gear icon, "In Progress" label)
2. **Completed deliverables** in a card grid with:
   - Title (from metadata or first line)
   - Department badge
   - Type badge
   - Status badge (if still executing)
   - Creator name
   - Date
   - Preview text (first 160 chars)
   - "Open workspace ->" hint on hover

Clicking any card navigates to the workspace view.

**Implementation note**: In-progress cards should link into the live workspace whenever a deliverable/workspace record already exists, so the CEO can inspect active execution rather than waiting for completion.
