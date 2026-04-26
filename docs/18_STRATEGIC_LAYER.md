# 18 -- Strategic Layer: Directions, Goals & the CEO's Thinking Space

## The Problem

Myelin v10 is an execution machine. The CEO talks to Tamir, routes a task, plans with a department head, approves, and agents execute. The system is excellent at running — but it has no concept of *direction*.

Jeff Bezos said his job is to make three high-quality decisions per day. Everything else follows from that. The current system has no structured support for *making* those decisions, *holding the resulting directions* over time, or *decomposing* them into the compound assets and tasks that actually move the needle. You can run 100,000 miles in the wrong direction and the system will execute perfectly the entire way.

**What's missing:**

- A place for the CEO to *think* — collaboratively, with Tamir — not just delegate
- Long-lived strategic **directions** that persist and accumulate progress over time
- A challenge mechanism woven into the thinking process — Tamir as a counterbalance who stress-tests the CEO's reasoning in real-time
- A pipeline from vague strategic intent ("better brand identity") to concrete assets (YouTube channel, online course) to executable tasks (write script, deploy page)
- Visibility into whether execution is actually serving the directions that matter

## Decisions vs Directions

A critical distinction: **decisions** and **directions** are not the same thing.

A **decision** is a one-time act. It happens on the canvas, in conversation with Tamir. It's a moment — the CEO decides something. That moment may create a new direction, modify an existing one, pause one, kill one, or reprioritize the whole board. The decision itself is not the long-lived tracked entity with a progress bar. But it is **rich and stored** — the full conversation with Tamir, the canvas state at the time, the constraints considered, the counter-arguments that were raised, the alternatives that were rejected. All of this is preserved because future decisions compound on past ones.

When the CEO is on the canvas six weeks later thinking about a related move, Tamir can surface: *"In March you considered a paid community and decided against it because the audience was too small. The audience has 3x'd since then. The constraints have changed — want to revisit?"* That only works if the decision record is complete: not just "CEO decided X" but the full reasoning, the canvas snapshot, and the challenge conversation that led there.

**Decisions are not disposable notes — they are the institutional memory of strategic reasoning.** They're just not the entity the CEO tracks progress against. That's the direction.

A **direction** is the long-lived organism. It's a strategic vector that persists over weeks and months, accumulates goals and assets, and represents where the company is actually heading. Directions are what the CEO tracks, decomposes, and measures progress against. A direction may be shaped by dozens of decisions over its lifetime — each one adjusting the course, adding a goal, killing a goal, changing priorities.

**Analogy:** A decision is turning the steering wheel. A direction is the road you're now on. But the driver's memory of *why* they turned — the hazard they saw, the shortcut they considered and rejected — matters the next time they reach a fork.

## The Decomposition Model

Strategic thinking doesn't jump from idea to task. There's a hierarchy of abstraction:

```
DIRECTION
  "Build public-facing educational content"
      │
      ├── GOAL
      │   "Launch YouTube channel with 12 deep-dive videos"
      │       │
      │       ├── ASSET: YouTube channel (persistent, compounding)
      │       ├── ASSET: Video production pipeline
      │       │
      │       ├── SEED: "Write script: Why BCI middleware matters"  [marketing, small]
      │       ├── SEED: "Record + edit episode 1"                  [marketing, medium]
      │       └── SEED: "Design channel branding"                  [marketing, small]
      │
      └── GOAL
          "Create a free online course on BCI development"
              │
              ├── ASSET: Course platform (Teachable/custom)
              ├── ASSET: Course content library
              │
              ├── SEED: "Outline 8-module curriculum"              [tech, medium]
              └── SEED: "Record module 1: EEG fundamentals"        [marketing, medium]

DIRECTION
  "Position in developer community"
      │
      ├── GOAL (also serves "Build public-facing educational content" — many-to-many)
      │   "Publish 6 technical blog posts on BCI integration"
      │       ├── ASSET: Blog/dev portal
      │       └── SEED: "Write post: Building a real-time EEG pipeline"  [tech, small]
      │
      └── GOAL
          "Speak at 2 relevant conferences"
              └── SEED: "Submit CFP to BCI Society 2026"           [operations, small]
```

Note: Seeds show `[department, scope]` annotations. These are rough — actual planning happens when a seed is activated into a real task through the normal planning pipeline.

### How Decisions Relate

The CEO makes a decision on the canvas: *"We need to establish Myelin as a thought leader in neurotech."* That decision creates the two directions above. A month later, a new decision: *"Content is working, but conferences aren't worth the time."* That decision modifies the second direction — pauses the conference goal, redirects effort to webinars instead. The directions evolve; the decisions are the events that shaped them.

### Definitions


| Level         | What It Is                                                                                                                                                             | Lifespan        | Example                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| **Decision**  | A one-time strategic call the CEO makes on the canvas. Creates, modifies, or kills directions. Logged as an event, not tracked as an entity.                           | Moment          | "Invest in brand before fundraising", "Pause conference strategy"                                    |
| **Direction** | A long-lived strategic vector. The persistent thing the CEO tracks and decomposes. Multiple directions can coexist and compete for resources.                          | Weeks to months | "Build public-facing content", "Modernize tech stack"                                                |
| **Goal**      | A concrete target within one or more directions (many-to-many). Starts qualitative, matures toward measurable. Has a definition of done.                               | Weeks           | "Launch YouTube with 12 episodes", "Rewrite auth module in TS"                                       |
| **Asset**     | A persistent, compounding thing that gets built or maintained. Assets outlive the tasks that create them. A goal may create or improve multiple assets.                | Ongoing         | YouTube channel, codebase, demo app, course, paid community                                          |
| **Task Seed** | A lightweight idea for a task, created during decomposition. Not yet planned or assigned — just intent + context. When activated, enters the normal planning pipeline. | Until activated | "Write YouTube script about AI companies" (with dept=marketing, scope=small, context from direction) |
| **Task**      | An atomic unit of work an agent can execute. Created when a seed is activated and planned through the existing CEO ↔ dept head pipeline.                               | Hours to days   | Fully planned task with approved scope, assigned agent, workspace                                    |


### Direction Priority and Focus

Not all directions are equal at any given moment. Directions carry an explicit priority — **focus**, **active**, or **background** — that communicates where the CEO's attention and agent capacity should concentrate.

- **Focus** (2-3 max): These are THE priorities right now. Agent capacity is allocated here first. Tamir actively drives goal decomposition and task creation for focus directions. The canvas shows these prominently.
- **Active**: Being worked on, but not the top priority. Tasks continue, but new work isn't aggressively initiated.
- **Background**: Acknowledged as important, but deliberately paused or on slow burn. Existing tasks complete, but no new ones are created.

**Tamir guards focus.** When the CEO starts exploring a 5th or 6th direction on the canvas, Tamir doesn't silently accommodate it. He pushes back: *"You have 4 active directions and 2 are stalled. Before adding another, should we pause or kill something? Spreading across too many fronts will dilute everything."* This isn't about blocking the CEO — it's about forcing an honest conversation about capacity and tradeoffs.

Goals within a direction also carry relative priority. Not every goal under a focus direction is equally urgent. Tamir helps the CEO sequence: "These two goals are prerequisites — let's start here. This third goal can wait until we see results from the first."

**Priority UX:** Priorities are not managed through a form or dropdown. They are integrated into the strategic constellation visualization (see below). Priority acts as a **filter** — focus directions and their goals are highlighted with full visual weight, active directions are visible but dimmer, background directions fade to near-invisible. An interactive priority map in the sidebar lets the CEO click to change a direction's priority level directly. Tamir may push back either way if focus is getting too spread.

### Why This Hierarchy Matters

**Without it:** The CEO asks Tamir to write a blog post. It gets done. But *why* that blog post? Which strategic direction does it serve? Was it even the right thing to do? If the CEO loses interest in that direction, which orphaned tasks should be cancelled?

**With it:** Every task traces back through goal → direction. The CEO can see: "I have 4 active directions, 2 in focus. The focus directions have 3 goals, 5 assets, and 23 tasks — 68% complete." They can also see: "This direction has zero progress because I keep deprioritizing it — do I actually believe in it? Maybe it's time for a decision to kill or reshape it."

### Direction Lifecycle

Directions are long-lived, but not immortal. A direction moves through statuses:

- **active** → the default. Being worked on, goals progressing.
- **paused** → deliberately on hold. Existing tasks may complete but no new seeds are activated.
- **completed** → all goals done. Triggered by auto-complete + confirm: when all goals under a direction are completed or abandoned, Tamir suggests completing the direction — *"All goals under 'Build public content' are done. Should I mark this direction as completed, or do you want to add new goals?"* The CEO confirms or adds new goals. Directions never auto-close silently.
- **abandoned** → the CEO explicitly kills the direction. Abandoned directions and their decision history remain accessible for institutional memory — they are archived, not deleted.

### Assets Are First-Class (Integration with Doc 13)

The "asset" in this decomposition model is **the same asset** defined in `13_ASSETS_SYSTEM.md` — company-owned things managed over time, with stewardship, maturity stages, connectors, health signals, and the intimacy philosophy. The strategic layer does not create a parallel asset concept. It adds a new dimension: **strategic context**.

Doc 13 answers: *What is this asset? Who stewards it? How healthy is it? How does the CEO develop intimacy with it?*

The strategic layer answers: *Why does this asset exist? Which direction does it serve? Which goal created or improved it? Is the strategic reason for this asset still valid?*

When a goal names an asset, it either:

- **Points to an existing asset** (from doc 13's system): "The 'Modernize tech stack' direction targets the existing SDK codebase asset — the CTO already stewards it, it has health signals and history, and now it also has strategic context."
- **Declares a new asset to create**: "The 'Build public content' direction needs a YouTube channel asset. Once the first task creates it and the CEO promotes it, it enters doc 13's system with full stewardship, maturity tracking, etc."

This means assets accumulate both operational context (doc 13: health, maturity, steward narratives) and strategic context (this doc: which direction it serves, why it was built, how it connects to the CEO's decisions). Both dimensions are visible when the CEO encounters the asset.

**Example:** The CEO sets a direction: "modernize tech stack." A goal: "rewrite 3 flagship demos." The assets are the individual codebases — already existing in doc 13's system with CTO stewardship, health signals, and maturity stages. The strategic layer adds: these codebases are being rewritten *because of this direction*. If the CEO later makes a decision to pivot away from one demo, the strategic context changes (direction no longer requires this asset), but the asset itself still lives in doc 13's system — it may still be valuable for other reasons.

## The CEO's Thinking Space: Strategic Canvas

The CEO needs a place to *think*. Not in a form, not in a task queue — on a canvas, with Tamir as an active collaborator.

The canvas is a dedicated strategy page (`/strategy/canvas`), not the Cortex home page. The existing Tamir chat and task flow remain the primary operational interface. The canvas is where the CEO goes to think strategically — a separate space with a different tempo. But the main Tamir interface can open as an overlay on top of the canvas, so the CEO can route tasks, check on things, or give quick instructions without leaving their strategic context and losing their place.

### Canvas-Chats: One Per Strategic Conversation

The canvas page is organized as **multiple canvas-chats** — like conversations in a chat app, but each one is a visual canvas paired with a Tamir conversation. Each canvas-chat is a separate strategic space for a specific decision, exploration, or topic.

Examples:

- "Brand identity exploration" — a canvas-chat where the CEO and Tamir explored brand options over several sessions
- "Tech stack modernization" — the canvas-chat where the decision to rewrite demos was made
- "Q3 content strategy" — an active canvas-chat exploring what to build next

The CEO can:

- **Create a new canvas-chat** when starting a new strategic conversation
- **Return to existing canvas-chats** to continue thinking where they left off
- **See a list of all canvas-chats** in a sidebar (like a chat app), with the most recent or active ones on top

A direction may emerge from a single canvas-chat, or a canvas-chat may produce multiple directions. Canvas-chats can also reference or build on each other — Tamir maintains continuity across them.

**The relationship between canvas-chats and directions is many-to-many.** A single canvas-chat about "content strategy" might produce two separate directions. And a direction might be refined across multiple canvas-chats over months as the CEO revisits it with new information. This relationship is tracked implicitly through DecisionRecords — each decision references both the canvas-chat where it was made and the direction(s) it affected.

**Cross-canvas awareness:** When a canvas-chat touches territory explored in a previous canvas-chat, Tamir proactively flags the connection as a light one-liner: *"Related: you explored this in your March 'Tech Stack' canvas — the constraints around developer tooling overlap."* He doesn't auto-pull nodes or merge canvases. Just flags the link so the CEO can decide whether to revisit the older canvas.

### What Each Canvas-Chat Contains

A persistent, spatial workspace where **both the CEO and Tamir** have their hands on the whiteboard:

- **Place ideas** as nodes (sticky notes, text blocks, concept cards) — CEO places them directly, Tamir places them from conversation
- **Draw connections** between ideas (arrows, grouping, proximity) — either party can connect
- **Organize spatially** — important things at center, speculative things at edges
- **Color-code** by theme, urgency, confidence level
- **Annotate freely** — scribble, question marks, exclamation points
- **Evolve over time** — the canvas is not a snapshot, it's a living document

The CEO can directly manipulate the canvas (drag nodes, draw connections, type on it). Tamir also modifies the canvas based on conversation. Both hands on the whiteboard simultaneously. When there's a conflict (CEO drags something Tamir is about to reorganize), Tamir defers to the CEO's placement.

### Canvas Versioning

Each canvas-chat has its own **version control at the bottom** of the canvas.

**Important: the canvas is static between sessions.** Tamir does NOT autonomously update the canvas while the CEO is away. Canvases are for strategic decisions — usually short, focused thinking sessions — and tasks completing or failing is too micro to warrant automatic canvas changes. Instead, when the CEO opens a canvas-chat, Tamir reviews what has changed since the last session (task results, new information, changed conditions) and **proposes updates in the chat**. The CEO approves before any canvas changes are made.

The version control provides:

- **Version timeline**: The CEO can scrub back through the canvas-chat's states — see what the board looked like a week ago, a month ago. This matters because the canvas *is* the thinking space, and being able to revisit past states of your own thinking is valuable.
- **"Since you were last here" summary**: When the CEO opens a canvas-chat, Tamir provides a chat summary of what changed externally since the last visit. This is textual (in the chat), not a visual diff on the canvas itself.
- **Decision-linked snapshots**: Each committed decision automatically captures the canvas state at that moment (stored in the DecisionRecord). These are bookmarked in the version timeline.

### What the Canvas Is NOT

- Not a task board (we already have that)
- Not a Gantt chart or timeline
- Not a structured form with fields to fill
- Not an org chart
- Not the Cortex home page — it's a dedicated strategy space
- Not a single monolithic board — it's multiple focused canvases

It is the digital equivalent of a whiteboard in the CEO's office — but the CEO's Chief of Staff is standing right there at the board with them, marker in hand. When the CEO returns after time away, Tamir briefs them on what's changed before touching the board.

### Tamir's Role on the Canvas

Tamir is not a passive observer of the CEO's thinking. He has two active roles on the canvas:

**Role 1: Mentor & Chief of Staff — Connecting Ideas to Reality**

Tamir has visibility across the entire organization. While the CEO thinks and draws, Tamir actively:

- **Surfaces cross-department context**: The CEO places "experiment with X technology" on the canvas. Tamir immediately flags: *"The CTO department is already trialing X in a mini-scope on the SDK integration. Want me to ask them how it's going? We could add a stage to watch their results before committing to a full direction."*
- **Connects to real business data**: The CEO sketches "grow developer audience." Tamir pulls in: *"Current blog traffic is 400/month, 80% from 3 posts. The SDK docs page has 2x the traffic. Developers are finding us through docs, not content."*
- **Suggests corrections and additions**: The CEO draws "launch paid community." Tamir pushes: *"At 200 active developers, conversion to paid is 4-10 members. That's noise. What if the direction is 'validate developer demand' instead — and a paid community is one of several possible goals under that?"*
- **Challenges in real-time**: Not as a separate phase, but woven into the conversation. Tamir naturally plays devil's advocate as ideas surface — arguing against, surfacing assumptions, presenting counter-data, flagging opportunity costs. This is not an explicit "challenge mode" the CEO activates. It's how Tamir thinks in the strategic context.
- **Pattern-matches to history**: *"Last time you invested in content before product validation, you produced 8 posts that drove traffic but no conversions. The sequence matters."*

**Role 2: Canvas Organizer — Maintaining Structure and Clarity**

As the CEO talks and thinks (via chat, or voice in the future), Tamir simultaneously:

- **Translates conversation to canvas**: The CEO says "I've been thinking about brand identity" — Tamir creates a node, places it in the right area, connects it to related existing nodes
- **Reorganizes for clarity**: Groups related ideas, aligns spatial layout, ensures the canvas doesn't become a mess over time
- **Maintains the visual hierarchy**: Strategic directions in prominent positions, supporting ideas clustered around them, resolved or abandoned ideas moved to edges or archived
- **Labels and categorizes**: Adds tags, status indicators, date stamps to nodes as the conversation evolves
- **Preserves the CEO's intent**: The layout reflects *what the CEO means*, not just what was said. If the CEO talks about three separate things that Tamir recognizes as facets of the same direction, he groups them

### The Challenge Is Not a Phase

In the original framing, "Challenge" was a separate phase the CEO entered. That's wrong. Challenge is a *behavior* that Tamir exhibits continuously during canvas collaboration.

When the CEO places an idea, Tamir doesn't wait to be asked. He simultaneously:

- Helps structure it (organizer hat)
- Connects it to reality (CoS hat)
- Pushes back on it (challenger hat)

All in the same breath. This mirrors how a great Chief of Staff actually operates — they don't switch between "helping mode" and "challenging mode." They do both at once.

**What this looks like in practice:**

```
CEO: "I'm thinking we should build a paid community for BCI developers."

Tamir: [places "Paid BCI Community" node on canvas, connects to
"Developer Audience" direction]

"A few things to consider as I place this:
1. Your current reach is ~200 developers — at 2-5% conversion that's
   4-10 paying members. Not enough signal to validate anything.
2. The CTO team is already running a small beta program with 3 external
   developers on the SDK. Their feedback loop might tell us more about
   developer willingness to invest time (and eventually money) than a
   cold launch would.
3. If the goal is market signal, there might be cheaper probes —
   I'm placing a 'Demand Validation' cluster next to this with some
   alternatives.

Want me to check with CTO on how their beta developers are engaging?"

CEO: "Yeah, actually — let's watch that beta for two weeks before
deciding on community. Can you restructure this area to show the
beta as the first validation step?"

Tamir: [reorganizes canvas: "Demand Validation" becomes a direction
candidate, "Watch CTO beta" becomes a near-term probe, "Paid Community"
moves to a conditional position downstream]

"Done. I've also flagged this cluster with a 2-week review date.
I'll remind you on April 24th."
```

### Canvas → Structure Pipeline (The Commit Flow)

The canvas is the *input* to the decomposition model. Committing a direction is a **conversational trigger + structured side panel** flow:

1. The CEO tells Tamir in the chat: *"Let's ingest this into a direction"* (or similar natural language)
2. A **structured direction panel** opens on the side of the canvas — showing Tamir's suggested title, rationale, initial goals, and links to the canvas areas that informed it
3. The CEO can **optionally select or highlight elements on the canvas** as input hints — e.g., circling a cluster and saying "this is what I mean." The selection acts as additional context for Tamir's structuring, not as a required step
4. Tamir and the CEO iterate on the direction panel content conversationally until the CEO confirms
5. The committed direction links back to the canvas area and a DecisionRecord captures the canvas state at that moment

The key insight: the **canvas selection is an input to the conversation**, not a replacement for it. The CEO can commit a direction purely through conversation without selecting anything, or they can select canvas elements to help Tamir understand what they mean. Both paths converge on the structured panel.

This preserves the messy, creative, non-linear nature of strategic thinking while creating the structured artifacts the system needs to drive execution.

## The Human-AI Interaction Flow

The full strategic → tactical flow has three distinct phases. Note that exploration and challenge are *not* separate phases — they coexist in the canvas collaboration.

### Phase 1: Canvas Collaboration (Explore + Challenge) — CEO & Tamir Together

**Where:** Strategic Canvas with Tamir chat panel
**Human role:** Think, sketch ideas, talk through reasoning, make decisions
**Tamir role:** Organizes the canvas, connects ideas to business reality, challenges in real-time, surfaces cross-department context, suggests additions and corrections, help in visualization (diagrams, tables, graphs, images and resources helping to view).  
**Output:** An evolving canvas with direction candidates, tested ideas, and connected clusters. Decisions happen naturally in conversation and reshape the canvas.

This is the *living* phase. It's not a step the CEO enters and exits — it's an ongoing workspace they return to. A canvas session might last 10 minutes or 2 hours. The CEO might come back daily to iterate, or leave it for a week. Tamir remembers the state and picks up where they left off.

### Phase 2: Commit (Direction Lock) — Human Decides

**Where:** Canvas chat → triggers structured direction panel on the side
**Human role:** Says "let's ingest this into a direction." Optionally selects/highlights canvas elements as input. Reviews and confirms the structured direction in the side panel.
**Tamir role:** Structures the commitment — formalizes the direction with title, rationale, initial goals in the side panel. Records the decision event that created it. Tags related canvas areas. Sets up the direction in the strategic registry.
**Output:** A formal Direction record with rationale, assumptions, risks acknowledged, and a link back to the canvas area where the thinking happened.

### Phase 3: Decompose (Strategic → Tactical) — Mutual Creation

**Where:** Direction detail page (`/strategy/directions/{id}`) — structured tree/outline view
**Human role:** Guides priorities, validates decomposition makes sense, adds domain knowledge
**Tamir role:** Suggests goals, assets, and task seeds. Has better knowledge of what's technically feasible, what's already in progress across departments, and what other directions/assets already exist. Suggests synergies ("This goal could reuse the asset you're already building under Direction 2"). Flags resource conflicts ("Directions 1 and 3 both need heavy content creation — current capacity supports one well or both poorly").
**Output:** A structured tree: Direction → Goals → Assets → Task Seeds

**Task Seeds, Not Tasks:** Decomposition produces **task seeds** — lightweight idea-level descriptions of work to be done, NOT fully planned tasks. A task seed contains:

- Title and description (what needs to be done, at a high level)
- Suggested department (who should do it)
- Rough scope estimate (small/medium/large — explicitly humble, since planning hasn't happened)
- Dependencies on other seeds in the same goal (ordering hints)
- Strategic context from the decomposition conversation

Task seeds sit in a **planned queue** under their goal. They are NOT real tasks in the Myelin execution system yet. When the CEO decides to activate a seed (or Tamir suggests it's time), the seed enters the normal Tamir routing → CEO ↔ dept head planning → approval → execution pipeline. This is where the seed becomes a real task with a detailed plan, specific agent assignment, and approved scope.

**Why seeds, not tasks?** Decomposition happens at strategy-level. The CEO shouldn't be forced to fully plan 15 tasks during a strategic thinking session. Seeds capture intent and ordering; the existing planning pipeline handles the detail when the time comes.

### Phase 4: Execute (Existing System) — AI Executes, Tamir Observes

**Where:** Existing Tamir → Department Head → Agent pipeline
**Human role:** Approves plans (as today), monitors progress, intervenes when needed
**AI role:** Full execution as the current system already provides

**Tamir as third participant in planning:** When a task enters the planning conversation (CEO ↔ department head), Tamir is a **visible third participant** in the chat. His messages appear with a **distinct avatar and color** (different from the dept head's), making it clear there are three speakers: CEO, department head, and Tamir.

Tamir's planning contributions are **visible to both the CEO and the department head**. This means the department head sees Tamir's strategic context directly — e.g., *"This task connects to the 'Modernize tech stack' direction. The CTO's plan should account for the SDK asset's current state."* — and can incorporate it into their planning. The department head may even respond to Tamir's points.

Tamir also classifies the task against directions and goals during planning, so the `goalId` is set naturally as part of the conversation rather than as a manual tagging exercise after the fact. After plan approval, Tamir logs the full planning conversation into his knowledge for future reference — as a Chief of Staff would.

**Output:** Deliverables, completed tasks, growing assets — all with strategic context attached

**Retroactive linking:** When a new direction is committed, Tamir scans recent completed tasks and suggests retroactive links: *"These 5 completed tasks seem related to your new 'Developer Community' direction — want to link them?"* The CEO confirms each suggestion. The `goalId` on existing tasks is mutable for this purpose.

### The Loop Back

Execution feeds back into the canvas — but **on-open only**, not in real-time:

- A task reveals that the assumed technology doesn't work → when the CEO next opens the relevant canvas-chat, Tamir flags it: *"The SDK migration task hit a blocker — the assumed API isn't compatible. This affects the 'rewrite demos' goal. Want to revise?"*
- An asset grows faster than expected → the CEO may want to double down → new goals spawn from the same direction
- The constellation visualization shows one direction consuming 80% of resources while another is stalled → CEO opens the relevant canvas-chat to revisit resource allocation
- A department reports unexpected results (good or bad) → Tamir surfaces this in the next canvas session: *"CTO's beta got 3x expected engagement. This changes the assumptions behind your 'validate demand' direction — want to accelerate?"*

## Strategic Visualization (Not a Dashboard)

The CEO needs to *see* the strategic landscape — but not through a dashboard. Dashboards are tables with progress bars. They show data, not understanding. The strategic view should be an intuitive visualization that communicates the shape, weight, momentum, and health of the CEO's strategic world at a glance.

**Visual direction: constellation map.** The visualization takes the form of a **constellation/graph map** — similar in spirit to Obsidian's graph view but purpose-built for strategic navigation. Directions appear as major nodes (stars/clusters) with visual weight proportional to their activity and progress. Goals orbit their parent directions. Connections between directions, shared assets, and cross-cutting goals are visible as edges. The map is alive — momentum shows as brightness/pulse, staleness shows as dimming.

Priority acts as a filter layer on this visualization (see "Direction Priority and Focus" above) — focus directions blaze, active directions glow, background directions fade.

**The exact visual design is deferred to the UI implementation phase** — prototyping will determine the specific rendering approach, interaction patterns, and animation style. But the principles are clear:

### What It Must Communicate

- **Focus vs. spread**: Are the CEO's 2-3 focus directions getting the lion's share of activity? Or is energy scattered across 8 directions?
- **Direction momentum**: Is a direction gaining velocity (more tasks completing, assets growing) or stalling?
- **Direction staleness**: How long since the last decision touched this direction? Stale directions may need revisiting on the canvas.
- **Goal progress**: Within a direction, which goals are advancing and which are stuck?
- **Asset health**: Which assets are growing vs. neglected? (Ties into doc 13's maturity and health signals.)
- **Resource allocation**: Where is agent time actually going? Does it match the CEO's declared priorities?
- **Decision rhythm**: How often is the CEO making strategic decisions? Is the decision log active or stale?

### What It Should NOT Be

- Not a table of rows with status columns
- Not a Gantt chart
- Not a list of KPIs
- Not something the CEO reads — something they *see*

Think: the canvas shows the CEO's *thinking*. The strategic visualization shows the CEO's *progress*. Together they form a complete picture: where you intend to go and how far you've gotten.

## High-Level Implementation Direction

### Data Model Additions

The existing Myelin data model (tasks, deliverables, employees, etc.) needs new entities:

```
CanvasChat
  ├── id, title, createdAt, updatedAt, lastOpenedAt
  ├── chatFilePath (path to JSONL conversation file)
  ├── canvasFilePath (path to canvas JSON state file)
  │
  └── DecisionRecord[] (decisions made during this canvas-chat)
        ├── id, canvasChatId, summary, createdAt
        ├── conversationRef (full Tamir conversation that led to this decision)
        ├── canvasSnapshotRef (canvas state at decision time)
        ├── constraints (what constraints were considered — budget, time, dependencies)
        ├── alternatives (what was rejected and why)
        ├── challengeHighlights (key counter-arguments raised, whether accepted or overridden)
        │
        └── Direction[] (many-to-many via decision_directions junction)

Direction
  ├── id, title, rationale, status (active|paused|completed|abandoned)
  ├── priority (focus|active|background)
  ├── createdAt, updatedAt
  │
  ├── DecisionRecord[] (many-to-many via decision_directions junction)
  │     A single decision can affect multiple directions.
  │     A direction accumulates decisions over its lifetime.
  │
  └── Goal[] (many-to-many via direction_goals junction)
        ├── id, title, definitionOfDone
        ├── status (planned|active|at-risk|completed|abandoned)
        ├── progress (derived from task/seed completion)
        │
        ├── Asset[] (many-to-many via goal_assets junction — links to doc 13's asset system)
        │
        ├── TaskSeed[] (lightweight task ideas from decomposition)
        │     ├── id, goalId, title, description
        │     ├── suggestedDepartment, roughScope (small|medium|large)
        │     ├── dependencies (references to other TaskSeed IDs)
        │     ├── strategicContext (from the decomposition conversation)
        │     └── status (planned|activated|discarded)
        │
        └── Task[] (existing Myelin tasks, linked via goalId FK)
              └── goalId (nullable FK on existing task table — mutable for retroactive linking)

Junction Tables:
  decision_directions  (decisionId, directionId)
  direction_goals      (directionId, goalId)
  goal_assets          (goalId, assetId)
```

**Key design choices:**

- **Directions are top-level.** They are the persistent strategic organisms the CEO tracks.
- **Many-to-many relationships everywhere.** A goal can serve multiple directions ("Build SDK docs" serves both "Developer community" and "Tech modernization"). A decision can affect multiple directions. This reflects the reality that strategic thinking is interconnected, not siloed.
- **DecisionRecords live under canvas-chats.** A decision is born in a specific conversation on a specific canvas. It then links to the direction(s) it creates or modifies. DecisionRecords are rich and append-only — each captures the full context of a strategic moment: the conversation, the canvas state, constraints, alternatives rejected, and challenge highlights. You never edit a past decision — you make a new one. This is the institutional memory Tamir draws on when the CEO faces a related fork in the future.
- **CanvasChat is a first-class entity.** Each has its own conversation file (JSONL) and canvas state file (JSON). The DB holds metadata and paths, not content.
- **TaskSeeds are NOT tasks.** They're lightweight placeholders from strategic decomposition. When activated, a seed enters the normal Tamir routing pipeline and becomes a real task with a real plan. Seeds carry enough context (department, scope, dependencies, strategic context) for Tamir to route them, but estimates are explicitly rough.
- **Tasks get a mutable `goalId` FK.** This is the bridge from strategic to tactical. Every task in the existing system can optionally link to a goal. The FK is mutable to support retroactive linking — when a new direction is committed, Tamir suggests linking existing tasks that seem related. Deliverables (already linked to tasks) inherit the strategic context transitively.
- **Direction lifecycle: auto-complete + confirm.** When all goals under a direction are completed or abandoned, Tamir suggests completing the direction. The CEO confirms or adds new goals. Directions never auto-close silently.

### Canvas Persistence

**Architecture: hybrid.** The canvas uses a **freeform canvas library** for the thinking/decision surface (where the CEO and Tamir sketch, connect, and explore ideas). Committed directions, goals, and decomposition trees live in a **structured React UI** (the direction detail page). The canvas links to structured records; the structured records link back to the canvas area where the thinking happened.

**Storage model:**

- **Chat:** JSONL files on the filesystem (one per canvas-chat), consistent with existing chat storage patterns
- **Canvas state:** Canvas library's native JSON format (snapshots on filesystem), one file per canvas-chat
- **DB:** Holds metadata and file paths only — `CanvasChat` rows reference the JSONL and canvas JSON paths. No content blobs in SQLite.
- **Versioning:** Periodic snapshots of the canvas JSON file. Decision-linked snapshots are automatic (captured when a decision is committed). The version timeline at the bottom of the canvas scrubs through these snapshots.

**Canvas library: research required.** The project has an existing Excalidraw MCP server, making Excalidraw a strong candidate. However, the right choice depends on how well the library integrates as an embedded React component within the Cortex UI — it must support programmatic node creation (for Tamir), CEO direct manipulation, and JSON serialization for versioning. Alternatives to evaluate include tldraw, reactflow, and other embeddable canvas libraries. This is a **pre-implementation research task**.

### Tamir's Strategic Soul

When Tamir is in the strategic canvas context, his soul/system prompt extends beyond the normal CoS routing behavior. In addition to his standard capabilities, he gains:

- **Challenger instinct with auto-escalation**: Automatically push back on ideas, surface counter-arguments, flag assumptions. This is not a mode switch — it's baked into how Tamir thinks in the strategic context. **Challenge intensity auto-escalates**: light touch during early brainstorming (the CEO is just exploring), harder push as the conversation moves toward commitment (the CEO is about to allocate real resources and agent time). Tamir reads the conversational context to calibrate — when he detects phrasing like "let's commit this" or "I want to move forward," he shifts into stronger challenge mode, surfacing final counter-arguments and forcing the CEO to explicitly override them.
- **Cross-department awareness**: Tamir draws on his existing knowledge systems — COMPANY.md, his own memory, and the ability to query or recall what departments are working on — to surface relevant context in real-time. This is an extension of what Tamir already has, not a new data source.
- **Canvas tool access**: Tools to create, move, connect, and organize nodes on the canvas. Tamir co-authors the canvas alongside the CEO — both have their hands on the whiteboard. Canvas updates between sessions are on-open only (Tamir proposes in chat, CEO approves).
- **Decision logging**: When the CEO commits a direction, Tamir formalizes the decision event and structures the direction record in the side panel.
- **Focus guardian**: Tamir actively resists direction sprawl. When the CEO has too many active directions, Tamir pushes for consolidation or prioritization before adding more. Tamir understands that spreading across too many fronts is actively destructive, not just inefficient.
- **Planning presence**: When tasks enter the normal CEO ↔ dept head planning flow, Tamir participates as a **visible third party** with his own avatar and color. His messages are visible to both the CEO and the department head. He contributes strategic context, classifies the task against directions/goals (setting `goalId` naturally), and logs the full planning conversation into his knowledge for future reference.
- **Retroactive linking**: When a new direction is committed, Tamir scans recent tasks and suggests retroactive links to the CEO.
- **Cross-canvas awareness**: When a canvas-chat touches territory from a previous canvas-chat, Tamir proactively flags the connection with a light one-liner.

This is the same Tamir, same agent — but the strategic canvas gives him a richer prompt and additional tools. And his role in planning conversations gives the strategic layer continuity into the execution flow.

### Cortex UI: New Surfaces

The Cortex needs **three separate pages** (not an integrated hub):

1. **Strategic Canvas** — `/strategy/canvas` — Canvas-chat list in sidebar (like a chat app) + active canvas with Tamir chat panel. The CEO's thinking space. The **main Tamir routing interface opens as a slide-over panel from the right** so the CEO can route tasks, check on things, or give quick instructions without leaving the canvas and losing their place. The canvas remains visible but partially covered by the slide-over.
2. **Strategic Constellation** — `/strategy` — The constellation/graph visualization of all directions, goals, and their relationships. Directions as major nodes with visual weight proportional to activity/progress. Goals orbit their parent directions. Priority filter in sidebar highlights focus directions and shadows background ones (see "Direction Priority and Focus" section). This is where the CEO *sees* their strategic progress. Clicking a direction node navigates to its detail page.
3. **Direction Detail** — `/strategy/directions/{id}` — The decomposition tree for a single direction: goals, assets, task seeds, linked tasks, decision log, progress. This is where decomposition happens (Phase 3). Shows the full goal → asset → task seed hierarchy with status, progress, and the ability to activate seeds into real tasks.

### Integration Points with Existing System


| Existing System            | Integration                                                                                                                                                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tamir chat**             | The canvas has its own Tamir chat panel in strategic mode. The main Tamir routing interface opens as a **slide-over panel** on top of the canvas. CEO can also reference directions from the normal Tamir chat ("create a task under the YouTube goal").                                |
| **Planning conversations** | Tamir is a **visible third participant** (own avatar + color) in CEO ↔ dept head planning. Messages visible to both parties. He contributes strategic context, classifies the task against directions/goals (setting `goalId` naturally), and logs the conversation into his knowledge. |
| **Task creation**          | Decomposition creates **task seeds** (lightweight idea-level). When the CEO activates a seed, it enters the normal Tamir routing → planning flow and becomes a real task. The task carries a `goalId` linking it back to the strategic layer.                                           |
| **Asset system (doc 13)**  | Assets in the strategic layer are the same entities as doc 13. The strategic layer adds direction/goal context. Doc 13 provides stewardship, health, maturity, and intimacy. Both dimensions are visible when the CEO encounters an asset.                                              |
| **Deliverable workspace**  | Deliverables show which goal/direction they serve. A breadcrumb: "Direction: Public Content → Goal: YouTube Channel → Task: Write script"                                                                                                                                               |
| **Department heads**       | During decomposition, Tamir suggests which department should own each goal or task. The CEO confirms. During execution, dept heads have implicit awareness of strategic context through Tamir's participation in planning.                                                              |
| **Worker/execution**       | No changes. Tasks execute as before. The strategic layer is upstream.                                                                                                                                                                                                                   |


## What This Is Not

- **Not a project management tool.** Jira tracks tasks. This tracks *why* tasks exist and whether they matter.
- **Not a business plan generator.** This doesn't write plans for the CEO. It helps them think, challenges their thinking, and structures the results.
- **Not a replacement for the existing system.** The task → agent → deliverable pipeline stays exactly as it is. This is the layer *above* it.
- **Not mandatory for every task.** Quick, tactical tasks ("fix this bug," "draft this email") don't need a strategic decision. The `goalId` on tasks is nullable. The strategic layer is for the CEO's important decisions.

## Resolved Design Decisions

The following questions were explicitly resolved during design:

1. **Challenge intensity**: Auto-escalates. Light touch during brainstorming, harder push approaching commitment. Tamir reads conversational context to calibrate.
2. **Goal quantification**: Start qualitative. Tamir nudges toward measurable targets as goals mature ("Can we define what good looks like? 500 newsletter subs?"). No hard requirement for metrics at creation.
3. **Canvas modality**: Both CEO and Tamir manipulate the canvas directly. Both hands on the whiteboard. Tamir defers on conflicts.
4. **Retroactive linking**: Yes. Tamir scans recent tasks when a new direction is committed and suggests links. CEO confirms each.
5. **Cross-canvas references**: Proactive + light. Tamir flags connections as one-liners in chat, doesn't auto-pull nodes or merge canvases.
6. **Goal ↔ Direction**: Many-to-many. A goal can serve multiple directions.
7. **Decision ↔ Direction**: Many-to-many. A single decision can create or modify multiple directions.
8. **Direction lifecycle**: Auto-complete + confirm. When all goals done, Tamir suggests completing. CEO confirms or adds new goals.
9. **Canvas-chat ↔ Direction**: Many-to-many. Linked implicitly through DecisionRecords.
10. **Three-party planning**: Tamir visible to both CEO and dept head. Own avatar + color. Not a private whisper.
11. **Task decomposition**: Produces task seeds (lightweight ideas), not real tasks. Seeds enter normal planning pipeline when activated.
12. **Canvas between sessions**: Static. On-open only updates — Tamir proposes, CEO approves.
13. **Commit UX**: Conversational trigger + structured side panel. Canvas selection as optional input hint.
14. **Tamir overlay on canvas**: Slide-over panel from right.
15. **Decomposition location**: Direction detail page (`/strategy/directions/{id}`).
16. **Route structure**: Three separate pages — `/strategy`, `/strategy/canvas`, `/strategy/directions/{id}`.

## Open Questions

1. **Canvas library selection**: The hybrid architecture requires a freeform canvas library that embeds in React, supports programmatic node creation (for Tamir), CEO direct manipulation, and JSON serialization for versioning. Excalidraw (MCP server already exists), tldraw, and reactflow are candidates. Requires pre-implementation research.
2. **Constellation visualization design**: The direction is set (constellation/graph map, Obsidian-like, with priority filtering), but the specific rendering approach, interaction patterns, animation style, and library choice are deferred to UI implementation with prototyping. again - research needed. 
3. **Seed activation workflow**: When the CEO activates a task seed, what's the UX? Does the seed transform into a task in-place on the direction detail page? Does it pop open the normal Tamir routing flow? Does the strategic context from the seed auto-populate the planning conversation?

## Summary

The strategic layer transforms Myelin from a task execution system into a CEO operating system. It adds the missing top layer:

```
┌──────────────────────────────────────────────────────────┐
│  STRATEGIC LAYER (new)                                   │
│  Canvas-chats + Tamir → Commit → Decompose               │
│  Directions (focus/active/background) → Goals → Assets   │
│  Decisions are rich events, not tracked entities          │
│  Task seeds → activate → enter normal pipeline            │
│  Constellation viz: see progress. Canvas: think.          │
│  Tamir: organizer, challenger, focus guardian             │
├──────────────────────────────────────────────────────────┤
│  EXECUTION LAYER (existing, with Tamir as 3rd party)     │
│  Tamir + CEO + Dept Head → Plan → Approve → Execute      │
│  Tasks (with goalId) → Agents → Deliverables → Assets    │
│  Assets: doc 13 system + strategic context from above     │
└──────────────────────────────────────────────────────────┘
```

The CEO thinks on versioned canvas-chats with Tamir as active collaborator — both hands on the whiteboard, organizing ideas, connecting them to real business data, challenging with auto-escalating intensity. The canvas is static between sessions; when the CEO returns, Tamir briefs them on what changed and proposes updates. Decisions happen naturally in conversation and reshape the canvas. When a direction crystallizes, the CEO says "let's ingest this" and a structured side panel opens for commitment.

Tamir helps decompose directions into goals, assets, and **task seeds** — lightweight ideas that sit in a planned queue until the CEO activates them into the normal execution pipeline. Tamir stays present as a **visible third party** in planning conversations (own avatar, own color, visible to both CEO and department head), maintaining the strategic thread all the way through to task creation and retroactively linking completed tasks to new directions.

The CEO sees their strategic world through a **constellation map** — not a dashboard, but a living visualization where directions blaze or dim based on focus, momentum, and health. Three separate pages: the constellation for seeing, the canvas for thinking, and the direction detail page for decomposing.

Directions carry explicit priority. Tamir guards focus. Assets are the same living entities from doc 13, now with strategic context explaining *why* they exist. Goals start qualitative and mature toward measurable. Everything is many-to-many — goals serve multiple directions, decisions affect multiple directions, canvas-chats birth multiple directions.

Three right decisions a day. Tamir makes sure the CEO is making the *right* three, isn't spreading too thin, and that every decision actually compounds into something real.