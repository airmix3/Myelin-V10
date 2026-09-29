# 14 -- The Command Layer

## Brief Background

Every productivity tool ever built assumes the CEO's job is to complete tasks. It isn't. The CEO's job is to read the world, identify what matters, allocate scarce resources, make irreversible bets, and live with the consequences.

Running a company is, structurally, a strategy game. Not as metaphor -- as fact. It has scarce resources, a world that moves without you, decisions with real trade-offs, fog, fast feedback, and progression. Strategy games make this structure *visible*. Most business software strips it away and leaves a list.

The Command Layer is the design principle that unifies everything downstream of this insight: the CEO is not a worker clearing a queue. They are a commander running a campaign on a live map. The system's job is to show the world honestly -- scarce, uncertain, consequential -- so that the CEO's judgment lands on the right decisions at the right time.

This is not gamification. There are no points, badges, streaks, or leaderboards -- and there will never be. The compulsion comes from honesty, not decoration. When the map shows what is actually there, the CEO cannot look away.

This document explains how the Command Layer maps onto Myelin's existing architecture, what new primitives it introduces, how Tamir's role expands from router to game master, and what the UX and backend implications are for every layer of the system.

---

## The Vocabulary Shift

The Command Layer introduces new first-class objects that don't yet exist in the codebase, and it clarifies the meaning of some objects that do. Getting this vocabulary right early is essential -- it determines schema names, API surfaces, and how every subsequent piece is built.

### What Already Exists (and What It Becomes)

| Today's model | Article construct | Relationship |
|---|---|---|
| `Task` | Order | An Order is a small, tactical Task. Most existing tasks remain Orders. |
| `Escalation` | Weak Decision Card | Escalations already surface things that need CEO input, but they're unstructured -- no options, no costs, no confidence, no consequences. Decision Cards subsume them. |
| `Skill` (per department) | `AgentSkill` (renamed) | The current `Skill` model tracks proposed *agent* capabilities. The article's Skill is *organizational* capability. To avoid collision, the existing model is renamed. |
| `Asset` | Institutional memory | Assets already fit the Command Layer's "compounding" axis -- they are what the company keeps. No change to the model. |
| `ActivityLog` | Signal source | The activity stream already contains raw signals. The new Signal pipeline reads from it and synthesizes. |
| Tamir as router | Tamir as game master | Today Tamir only routes when the CEO speaks. In the Command Layer, Tamir reads the world continuously, synthesizes situations, and populates the Command Queue whether the CEO is present or not. |

### What Is New

**Signal** -- Raw observation, pre-interpretation. A commit frequency delta. A missed heartbeat. A cost anomaly. A vault document filed. Signals are cheap, plentiful, and low-signal individually. They exist to be synthesized.

**Situation** -- Tamir's interpretation of one or more signals into a structured world-state observation. "Sales pipeline is cooling in mid-market." "Engineer X shows early burnout signals." A Situation is not yet a decision -- it is a described fact, with confidence bounds.

**DecisionCard** -- A Situation that has ripened into a moment requiring CEO judgment. Contains: the situation, why-now, two-or-more options, each option's cost/upside/risk/confidence, impact-if-ignored. This is the object the CEO commands from.

**Campaign** -- A named, multi-phase operation with an objective, phases, sub-moves, owners, checkpoints, and a success metric. Not a Gantt chart. A living operation that Tamir tracks and briefs on.

**CampaignPhase** -- One phase within a Campaign. Has its own objective, timeline, sub-moves (which decompose into existing `Task`s), owner, and status.

**PostActionReview** -- The doctrine-generating output of a closed Campaign. What was the objective, what happened, what worked, what didn't, what was learned. Written by Tamir. Filed to vault. Indexed for future pattern retrieval.

**CompanySkill** -- An organizational capability node in the Skill Tree. Has a level (1-5), a tree position (Foundation / Growth / Excellence / Mastery layer), prerequisites, and evidence.

**SkillAssessment** -- A time-stamped assessment of a CompanySkill along three dimensions (consistency, success rate, independence). Written *only* by Tamir. The rule that makes the tree honest.

**Doctrine** -- A ratified operating principle. "We prioritize retention over acquisition when churn exceeds 8%." Proposed by Tamir from repeated decisions; ratified by the CEO; applied automatically as a constraint on subsequent routing.

**Bet** -- A quarterly-horizon Doctrine subtype. A named commitment the CEO makes at the start of a quarter and is confronted with at the Quarterly Reckoning.

**Consequence** -- The outcome of a past Decision, populated by Tamir on a schedule (7/14/30 days after the decision). Links the decision to the observed reality that followed.

**TheaterState** -- The current health, momentum, confidence, and open situations for one of the six theaters (Sales, Product, People, Finance, Operations, Market). Rendered as the top-level map view.

**Brief** -- A stored, structured briefing generated on the operating rhythm (Morning, Midday, Evening, Weekly, Quarterly). Not a notification -- a durable object the CEO can revisit.

---

## The Data Model

The Command Layer adds thirteen new Prisma models. They are additive -- no existing model is destructively changed except for the `Skill` rename.

### Additions to `prisma/schema.prisma`

```prisma
// ── Signals: raw observations ──

model Signal {
  id          String   @id
  source      String                        // activity_log | task_run | cost_event | deliverable | employee | external_calendar | external_github | external_email
  sourceRefId String?                       // pointer back to the origin record
  theater     String?                       // sales | product | people | finance | operations | market
  kind        String                        // "commit_freq_drop" | "cost_anomaly" | "deliverable_late" | ...
  payload     String                        // JSON: source-shaped observation
  synthesized Boolean  @default(false)      // has Tamir consumed this into a Situation?
  createdAt   DateTime @default(now())

  @@index([synthesized, createdAt])
  @@index([theater, createdAt])
  @@map("signals")
}

// ── Situations: Tamir-authored world state ──

model Situation {
  id             String   @id
  theater        String                     // enum of 6 theaters
  headline       String                     // one-line human read
  narrative      String                     // Tamir's structured description
  signalIds      String                     // JSON array of Signal IDs synthesized
  confidence     String                     // clear | uncertain | dark
  evidence       String                     // JSON: [{claim, source, confidence}]
  timeWindow     DateTime?                  // real timestamp -- deal close, budget cycle, calendar event. NEVER synthetic.
  timeWindowRef  String?                    // human-readable source of the window ("Acme deal close, CRM")
  status         String   @default("open")  // open | ripened | expired | archived
  ripenedIntoId  String?                    // DecisionCard.id once promoted
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([theater, status])
  @@map("situations")
}

// ── Decision Cards: structured moments of judgment ──

model DecisionCard {
  id               String   @id
  situationId      String?                  // origin Situation
  theater          String
  title            String
  situation        String                   // "what happened / what changed"
  whyNow           String                   // "why this needs attention at this moment"
  options          String                   // JSON: [{label, cost, upside, risk, confidence, secondaryEffects}]
  impactIfIgnored  String
  confidence       String                   // clear | uncertain | dark
  scarcity         String                   // JSON: {attention, capacity, capital, timeWindow, trust} -- what resource is at stake
  status           String   @default("open") // open | decided | expired | superseded
  decidedOptionIdx Int?                     // which option the CEO chose
  ceoReasoning     String?                  // free-form log entry from the commander
  decidedAt        DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  consequences     Consequence[]
  @@index([status, createdAt])
  @@index([theater, status])
  @@map("decision_cards")
}

// ── Consequences: what actually happened after a decision ──

model Consequence {
  id             String   @id
  decisionCardId String
  observedAt     DateTime @default(now())
  horizonDays    Int                        // 7 | 14 | 30
  assessment     String                     // Tamir's structured read of the outcome
  metrics        String                     // JSON: measured deltas
  verdict        String                     // positive | mixed | negative | too_early
  createdAt      DateTime @default(now())

  card           DecisionCard @relation(fields: [decisionCardId], references: [id])
  @@index([decisionCardId, horizonDays])
  @@map("consequences")
}

// ── Campaigns: multi-phase strategic operations ──

model Campaign {
  id             String   @id
  name           String                     // "Operation Pipeline Recovery"
  objective      String
  theater        String
  type           String                     // operational | capability -- the article's distinction
  targetSkillId  String?                    // for capability campaigns: which CompanySkill this levels
  successMetric  String                     // structured measurement to check at close
  status         String   @default("proposed") // proposed | active | paused | resolved | abandoned
  proposedBy     String                     // usually "tamir"
  approvedById   String?                    // Employee.id
  approvedAt     DateTime?
  resolvedAt     DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  phases         CampaignPhase[]
  postActionReview String?                  // markdown, populated at close
  @@index([status])
  @@map("campaigns")
}

model CampaignPhase {
  id            String   @id
  campaignId    String
  ordinal       Int                         // 1, 2, 3
  objective     String
  ownerAgentId  String?
  startsAt      DateTime?
  endsAt        DateTime?
  status        String   @default("pending") // pending | active | complete | skipped
  subMoves      String   @default("[]")     // JSON: task IDs this phase spawned
  notes         String?
  createdAt     DateTime @default(now())

  campaign      Campaign @relation(fields: [campaignId], references: [id])
  @@index([campaignId, ordinal])
  @@map("campaign_phases")
}

// ── Skill Tree: organizational capability ──

model CompanySkill {
  id              String   @id              // stable slug: "enterprise_sales", "sales_documentation"
  name            String
  layer           String                    // foundation | growth | excellence | mastery
  theater         String                    // which theater the skill belongs to
  description     String
  prerequisites   String   @default("[]")   // JSON array of CompanySkill IDs required
  currentLevel    Int      @default(0)      // 0 = not yet assessed; 1-5 per article
  targetLevel     Int?                      // optional: level Tamir is aiming for right now
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  assessments     SkillAssessment[]
  @@index([layer, theater])
  @@map("company_skills")
}

model SkillAssessment {
  id             String   @id
  skillId        String
  level          Int                        // 1-5
  consistency    Float                      // 0.0-1.0
  successRate    Float                      // 0.0-1.0
  independence   Float                      // 0.0-1.0
  evidence       String                     // JSON: [{observation, source, weight}]
  rationale      String                     // Tamir's narrative on why this level
  authoredBy     String                     // MUST equal "tamir" -- enforced at API layer
  assessedAt     DateTime @default(now())

  skill          CompanySkill @relation(fields: [skillId], references: [id])
  @@index([skillId, assessedAt])
  @@map("skill_assessments")
}

// ── Doctrine and Bets ──

model Doctrine {
  id             String   @id
  statement      String                     // "We prioritize retention over acquisition when churn > 8%"
  domain         String                     // sales | product | people | finance | operations | market | general
  originCardIds  String   @default("[]")    // JSON: DecisionCard IDs that this pattern came from
  proposedBy     String   @default("tamir")
  status         String   @default("proposed") // proposed | ratified | retired
  ratifiedAt     DateTime?
  retiredAt      DateTime?
  createdAt      DateTime @default(now())

  @@map("doctrines")
}

model Bet {
  id             String   @id
  quarterLabel   String                     // "2026-Q1"
  statement      String                     // "We double enterprise pipeline by end of quarter"
  domain         String
  successCriteria String                    // structured measurable outcome
  status         String   @default("open")  // open | won | lost | ambiguous
  reckonedAt     DateTime?
  reckoningNotes String?
  createdAt      DateTime @default(now())

  @@index([quarterLabel, status])
  @@map("bets")
}

// ── Theater state and briefings ──

model TheaterState {
  id             String   @id              // stable slug: "sales", "product", ...
  name           String
  health         String   @default("unknown")   // healthy | strained | critical | unknown
  momentum       String   @default("flat")      // rising | flat | falling
  confidence     String   @default("uncertain") // clear | uncertain | dark
  openSituationCount Int  @default(0)
  activeCampaignCount Int @default(0)
  lastAssessedAt DateTime @default(now())
  narrative      String?                        // one-paragraph Tamir summary

  @@map("theater_state")
}

model Brief {
  id             String   @id
  type           String                     // morning | midday | evening | weekly | quarterly
  scope          String   @default("commander") // commander (CEO) | department
  markdown       String                     // rendered briefing body
  metadata       String?                    // JSON: linked DecisionCard/Campaign/Situation IDs
  createdAt      DateTime @default(now())
  readAt         DateTime?

  @@index([type, createdAt])
  @@map("briefs")
}
```

### Migration notes

1. Rename existing `Skill` → `AgentSkill` in a dedicated migration. Update MCP tool `propose_skill` → `propose_agent_skill`. Update all references in `src/lib/mcp/tools/skills.ts`, `src/app/api/skills/route.ts`, and any UI consumers.

2. Seed `CompanySkill` in `prisma/seed.ts` with the article's four-layer tree. Each seeded skill starts at `currentLevel: 0` until Tamir has enough evidence to assess.

3. Seed `TheaterState` with the six theaters from the article.

4. Add `confidence` values as string enums, not Prisma `enum` (SQLite compatibility): `"clear" | "uncertain" | "dark"`.

---

## Tamir Becomes the Game Master

Today, Tamir is a routing function: the CEO speaks, Tamir picks a department. In the Command Layer, Tamir becomes a persistent, world-reading intelligence. This is the largest behavioral change in the system.

### The Loop

The article describes a five-beat loop: Clarity → Discovery → Decision → Consequence → Mastery. Tamir owns four of the five beats; the CEO owns Decision. Every beat is a real function in the codebase.

**Clarity** -- Tamir composes the current world state. Populates `TheaterState`, refreshes open Situations, updates confidence bands. Runs on the 15-minute cron.

**Discovery** -- Tamir reads new Signals and synthesizes them into Situations. Cross-references against ActivityLog history. Runs on the 15-minute cron.

**Decision** -- Situations that meet ripeness criteria are promoted to Decision Cards. Tamir does not decide -- the CEO does. Tamir surfaces.

**Consequence** -- 7/14/30 days after each Decision, Tamir observes reality and writes a Consequence record.

**Mastery** -- SkillAssessments update the tree. Doctrine proposals emerge from decision patterns. Campaign Post-Action Reviews are written and filed.

### The Cron Architecture

`node-cron@4.2.1` is already in the stack. In `src/instrumentation.ts`, Tamir's cron is registered on server start.

Three concurrent schedules:

```typescript
// src/lib/tamir/cron.ts
import cron from 'node-cron';

export function registerTamirCron() {
  // World-reading loop: signals → situations → decision cards
  cron.schedule('*/15 * * * *', () => runWorldReadLoop());

  // Operating rhythm briefings
  cron.schedule('0 7 * * *',   () => generateBrief('morning'));
  cron.schedule('0 13 * * *',  () => generateBrief('midday'));
  cron.schedule('0 19 * * *',  () => generateBrief('evening'));
  cron.schedule('0 8 * * MON', () => generateBrief('weekly'));
  cron.schedule('0 9 1 */3 *', () => generateBrief('quarterly'));

  // Consequence tracking sweep -- runs hourly, finds decisions due for observation
  cron.schedule('0 * * * *', () => sweepConsequences());
}
```

Each schedule runs `invokeAgent('tamir', ...)` with a specific structured-output zod schema and a task-scoped context. The Agent SDK handles the tool loop; Tamir uses MCP tools to read state and write findings.

### The World-Read Loop

```typescript
// src/lib/tamir/world-read.ts
export async function runWorldReadLoop() {
  // 1. Collect unsynthesized signals
  const signals = await prisma.signal.findMany({
    where: { synthesized: false },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  if (signals.length === 0) return;

  // 2. Group signals by theater
  const grouped = groupBy(signals, 'theater');

  // 3. For each theater, invoke Tamir with the signal batch
  for (const [theater, batch] of Object.entries(grouped)) {
    const result = await invokeAgent('tamir', {
      systemPrompt: TAMIR_WORLD_READ_PROMPT,
      task: `Analyze this batch of ${batch.length} signals from ${theater}. Produce zero or more Situations.`,
      context: { signals: batch, priorSituations: await openSituationsFor(theater) },
      outputFormat: WORLD_READ_SCHEMA,
    });

    // 4. Persist situations + mark signals synthesized (transactional)
    await persistSituations(result.situations, batch.map(s => s.id));
  }

  // 5. Ripeness check: which open situations should become Decision Cards?
  await ripenSituations();

  // 6. Update TheaterState summary
  await refreshTheaterStates();
}
```

The `WORLD_READ_SCHEMA` (zod v4) constrains Tamir's output to structured Situation objects with mandatory confidence bands and evidence arrays. No free-form text can bypass the structure.

### Ripeness Rules

A Situation is not automatically a Decision Card. Ripeness is a computed predicate:

- **Time-boxed** -- the Situation has a real `timeWindow` (deal close, budget cycle, calendar event) within the next 14 days.
- **Non-recoverable** -- if ignored, `impactIfIgnored` is judged severe or moderate by Tamir.
- **Multi-optioned** -- Tamir can name at least two viable options with distinct trade-offs.
- **Sufficient confidence on at least one option** -- if every option is `dark`, ripen a reconnaissance Campaign instead of a Decision Card.

Situations that fail ripeness stay in the `open` pool. Tamir revisits them on the next loop. Situations that expire (timeWindow passes) are archived with a reason.

### Signal Sources: Start Cheap, Expand Later

The article implies rich external integration -- calendar, email, CRM, competitor intelligence. Ship those later. The v1 signal pipeline reads only from what the codebase already produces:

**Phase 1 signal sources (in-process):**
- `ActivityLog` — every task transition, tool call, deliverable event
- `TaskRun` heartbeats — missed heartbeats are `employee_stalled` signals
- `CostEvent` — spend anomalies (agent burns 3× normal budget on a task)
- `Deliverable` — late deliverables, low-review-round completions, absorbed-to-asset events
- `Escalation` — every pending escalation is itself a signal
- `HireRequest` — unresolved hires past N hours

**Phase 2 signal sources (external adapters):**
- Google Calendar (deal-close events, meetings)
- GitHub (commit frequency deltas per employee, PR staleness)
- Gmail (customer sentiment via labelled inboxes)
- Notion / Supabase (product usage metrics)

Each adapter implements a `SignalSource` interface that emits `Signal` records. The adapter contract is intentionally minimal -- one function, `poll()`, returning an array of Signal payloads. This makes it trivial to add new sources over time without touching Tamir's synthesis code.

```typescript
// src/lib/signals/source.ts
export interface SignalSource {
  name: string;
  poll(since: Date): Promise<Omit<Signal, 'id' | 'synthesized' | 'createdAt'>[]>;
}
```

---

## Decision Cards: The Backbone of Command

Decision Cards are the single most important UX object in the Command Layer. Everything else exists to feed or explain them. Their design is where the article's principles get tested.

### Backend Shape

A DecisionCard's `options` field is a JSON array conforming to:

```typescript
type Option = {
  idx: number;
  label: string;
  action: string;              // concrete moves to execute if chosen
  cost: {
    attention: 'low' | 'medium' | 'high';
    capacity?: string;         // "6 weeks of solutions engineer"
    capital?: number;          // dollars
    timeWindow?: string;       // "delays product launch by 2 weeks"
    trust?: 'low' | 'medium' | 'high';
  };
  upside: string;
  risk: string;
  confidence: 'clear' | 'uncertain' | 'dark';
  secondaryEffects: string[];  // "SMB response times will increase"
};
```

Every option must have all five scarcity dimensions filled or explicitly marked `n/a` -- forcing Tamir to think in scarcity, not vague benefit.

### The Decide API

```
POST /api/decisions/:id/decide
{
  "optionIdx": 1,
  "reasoning": "Enterprise timing is fragile; product can absorb a two-week slip."
}
```

Server-side, this:
1. Validates the card is `open`.
2. Writes `decidedOptionIdx`, `ceoReasoning`, `decidedAt`.
3. Instantiates the chosen option's `action` (which is typically a Campaign or a Task).
4. Schedules Consequence observations for T+7, T+14, T+30 days via the hourly consequence sweeper.
5. Emits SSE update to `/api/sse` so the UI advances.

### The Decision Card UI

The Decision Card view is the second-most-important screen in the Cortex, after the Command Queue itself. Its layout is deliberate.

```
┌─────────────────────────────────────────────────────────────────┐
│  ◆ SALES · Uncertain · Window closes Fri (Acme budget cycle)   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Two enterprise deals are cooling after competitor launch       │
│                                                                 │
│  ── SITUATION ──                                                │
│  Acme (Q3, $220K ARR) and Trellis ($140K ARR) both went quiet   │
│  in the 72 hours after Competitor X's product announcement…     │
│                                                                 │
│  ── WHY NOW ──                                                  │
│  Acme's procurement window closes Friday. Trellis has a         │
│  quarterly board review Monday…                                 │
│                                                                 │
│  ── OPTIONS ──────────────────────────────────────────────────  │
│                                                                 │
│  ┌── Option A ─────────┐    ┌── Option B ────────────────────┐ │
│  │ Deploy CTO for      │    │ Send pricing counter and       │ │
│  │ technical deep-dive │    │ delay CTO involvement          │ │
│  │                     │    │                                │ │
│  │ Cost: 2 weeks of    │    │ Cost: pricing precedent risk   │ │
│  │  CTO. Arch review   │    │  across pipeline               │ │
│  │  slips 2 wks.       │    │                                │ │
│  │ Upside: Re-engages  │    │ Upside: Preserves CTO capacity │ │
│  │  both accounts w/   │    │  for arch review               │ │
│  │  ~65% confidence    │    │                                │ │
│  │ Risk: If Acme is    │    │ Risk: Discount telegraphs      │ │
│  │  already lost, cost │    │  weakness; likely won't        │ │
│  │  is wasted          │    │  re-engage technical buyers    │ │
│  │ Confidence: clear   │    │ Confidence: uncertain          │ │
│  └─────────────────────┘    └────────────────────────────────┘ │
│                                                                 │
│  ── IMPACT IF IGNORED ──                                        │
│  Both deals likely lost. Q3 pipeline down $360K. Recovery       │
│  cycle ~2 quarters if we re-engage cold in Q4.                  │
│                                                                 │
│  ── COMMANDER'S REASONING (required) ──                         │
│  [ multi-line text input ]                                      │
│                                                                 │
│  [Choose Option A]  [Choose Option B]  [Defer 24h]  [Discuss]   │
└─────────────────────────────────────────────────────────────────┘
```

Design notes:

- **Options are side-by-side, not sequential.** The CEO cannot read one, decide, and move on. They must see the trade-off simultaneously. This is a strategy-game affordance -- the map shows both moves at once.
- **The reasoning field is required.** Not for compliance -- for the Decision Log. The CEO's future self needs to know what they were thinking when the consequence lands three weeks later.
- **Confidence is displayed on every claim, not summarized.** Each option has its own confidence pill. The card header displays the aggregate confidence for the whole moment.
- **The time window is anchored to a real event.** "Window closes Fri (Acme budget cycle)" -- never "urgent" or "act soon." Fake urgency is banned.
- **"Discuss" opens a chat with Tamir** -- for the case where the CEO needs to poke at Tamir's analysis before choosing. The chat is scoped to this card; every message is retained in the Decision Log.
- **"Defer 24h" is a first-class action.** It moves the card to a snoozed state and returns to the queue at the specified time. Tamir may re-rank the card in the interim if the world changes.

### Consequence Rendering

Once decided, the Decision Card moves to the Decision Log (a separate view under `/app/decisions/`). The card stays visible but its layout inverts: the chosen option is highlighted, the alternative is grayed but readable, and a **Consequence Ribbon** appears at the bottom that populates over time:

```
── CONSEQUENCE ──
T+7d  ✓ Acme re-engaged (revised proposal requested). Trellis silent.
T+14d ◐ Acme moved to eval stage. Trellis lost to competitor.
T+30d ● Net: +$220K ARR captured, -$140K ARR lost. CTO's arch review
        finished 3 weeks late. Verdict: mixed.
```

This is the payoff. The CEO learns that their read was half-right. The next similar Decision Card, Tamir will surface a variant with the pattern noted: "This resembles the Acme/Trellis moment from Q3. That one recovered 1 of 2 deals; you may want to escalate Trellis-shape accounts earlier."

---

## Campaigns: The Long Game

An Order takes seconds. A Decision takes minutes. A Campaign takes weeks -- and it is where the deepest compounding lives.

### Backend

Campaigns are proposed by Tamir via a new MCP tool `propose_campaign`. The CEO ratifies via `POST /api/campaigns/:id/approve`. On approval, the system:

1. Instantiates the `CampaignPhase` records with `pending` status.
2. Activates Phase 1: sets `status: 'active'`, spawns the phase's initial `Task`s (existing task system -- no new machinery needed).
3. Wires the campaign into Morning Briefs -- Tamir will report on active campaigns every day.

Each `CampaignPhase.subMoves` is a JSON array of `Task.id`s. When all tasks in a phase are `completed`, Tamir writes a phase-closing summary and advances to the next phase. The state machine is: `pending → active → complete` per phase, and `proposed → active → resolved | abandoned` per campaign.

### The Two Types

The article's operational-vs-capability distinction becomes a schema field: `Campaign.type = 'operational' | 'capability'`.

**Operational campaigns** run, resolve, close. Post-Action Review is filed. Doctrine may or may not emerge.

**Capability campaigns** have `Campaign.targetSkillId` set. When the campaign resolves, Tamir does NOT auto-level the target skill. Tamir schedules a delayed skill assessment for T+30 or T+60 days, and reads the evidence at that time. If evidence supports it, the skill levels. If not, Tamir writes to the PAR: "Campaign ran to completion but capability did not improve. Next attempt should address X."

This is the mechanism that gives the Skill Tree teeth: campaigns can run and still not raise the tree, because the tree measures results, not effort.

### The Campaign View

`/app/campaigns/:id/page.tsx` renders each Campaign as a persistent operation view:

```
┌── Operation Pipeline Recovery ── Active · Week 2 of 6 ──────────┐
│                                                                 │
│  Objective: Re-engage enterprise pipeline after competitor      │
│  disruption.                                                    │
│                                                                 │
│  ── Phases ──                                                   │
│  ● Phase 1 · CTO Deep-Dives      Complete   Week 1-2            │
│    ✓ Acme deep-dive         (Task #4421 · complete)             │
│    ✓ Trellis deep-dive      (Task #4423 · complete)             │
│    ◐ Ventra deep-dive       (Task #4425 · in progress)          │
│  ○ Phase 2 · Repositioned Pilot   Pending    Week 3-4           │
│  ○ Phase 3 · Close/Qualify        Pending    Week 5-6           │
│                                                                 │
│  ── Success Metric ──                                           │
│  2 of 3 deals re-engaged; pipeline value restored to            │
│  pre-disruption levels ($540K+).                                │
│                                                                 │
│  ── Tamir's Daily Read ──                                       │
│  Acme requested revised proposal (Wed). Trellis contact         │
│  silent -- assessment: 40% chance recovery without VP-level     │
│  escalation. Ventra deep-dive scheduled Thursday.               │
│  Campaign is on track. Recommendation: authorize VP outreach    │
│  to Trellis before Phase 2 begins.                              │
│  [Authorize] [Discuss] [Adjust plan]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Post-Action Review

On `resolved` or `abandoned`, Tamir generates the PAR via a scheduled job. The PAR is:
- Stored in `Campaign.postActionReview` (markdown)
- Filed to vault via existing `file_to_vault` MCP tool
- Indexed in FTS5 so future situations retrieve it by similarity
- Optionally promotes an implicit doctrine into the `Doctrine` model as `status: 'proposed'` for CEO ratification

This is where the article's claim -- "six months later, when the next competitive disruption hits, Tamir surfaces the playbook" -- becomes real. It's just FTS5 search + Tamir's system prompt including retrieved PARs when composing new Situations.

---

## The Skill Tree

The Skill Tree is the article's most opinionated construct. It is deliberately not what a naive engineer would build.

### The Non-Negotiable Rule

**Only Tamir can write SkillAssessments.** This must be enforced at three layers:

1. **API layer** -- `POST /api/company-skills/:id/assess` requires the request to originate from the Tamir agent's MCP context; any other caller returns 403.
2. **MCP layer** -- the `assess_company_skill` tool is registered only for the Tamir agent in `src/lib/mcp/access-control.ts`. No other agent has it.
3. **Database layer** -- add a Prisma-level check in the service that writes `SkillAssessment` records: `if (authoredBy !== 'tamir') throw new Error('SkillAssessment is Tamir-only')`. Belt and suspenders.

There is no UI affordance for the CEO to edit a skill level. Not "removed for now" -- not there.

### The Three Dimensions

Every assessment stores three separate 0.0-1.0 scores:

- **Consistency** -- does the outcome repeat across people, time, and conditions?
- **Success rate** -- what fraction of attempts produced the intended result?
- **Independence** -- how much CEO involvement did it require?

Level is derived from the three dimensions, not stored directly (though `SkillAssessment.level` caches the derivation for query performance):

```typescript
function deriveLevel(a: SkillAssessment): number {
  const min = Math.min(a.consistency, a.successRate, a.independence);
  if (min < 0.30) return 1;
  if (min < 0.55) return 2;
  if (min < 0.75) return 3;
  if (min < 0.90) return 4;
  return 5;
}
```

The "min" rule is deliberate -- a skill is only as strong as its weakest dimension. A sales motion with 90% success rate but requiring the CEO on every call is Level 1, not Level 4. The article is explicit about this.

### Evidence, Not Vibes

Every SkillAssessment carries an `evidence` array. Each evidence entry references concrete records:

```json
[
  {"observation": "Sales cycle length averaged 42 days across 8 deals",
   "source": "task_ids:[4401,4409,4412,...]", "weight": 0.4},
  {"observation": "CEO involvement in 6 of 8 deals for pricing negotiation",
   "source": "escalation_ids:[221,224,...]", "weight": 0.3},
  {"observation": "New rep ramp time: 4 months average, target 8 weeks",
   "source": "employee_metrics", "weight": 0.3}
]
```

If Tamir cannot cite evidence, Tamir cannot assess. The tree stays at `currentLevel: 0` (unassessed) until data accumulates.

### Prerequisites and Blockers

The `CompanySkill.prerequisites` array encodes the tree dependency graph. When Tamir considers advancing a skill, it evaluates whether all prerequisites are at least at the target level. If not, Tamir surfaces the blocking prerequisite as the actionable insight:

> "Enterprise Sales is stuck at Level 2 after 6 months of effort. Sales Process Documentation is at Level 1. Advancing Enterprise Sales further requires Sales Process Documentation at Level 2 first. Recommend Campaign: 'Sales Playbook Foundation.'"

This is the highest-leverage output the tree produces, and the article is right that it usually costs six figures to hire a consultant to reach it.

### The Tree UI

`/app/skill-tree/page.tsx` renders the four-layer tree as a canvas:

```
┌── Foundation ──────────────────────────────────────────────────┐
│  [L4] Financial Tracking     [L3] Core Delivery                │
│  [L3] Basic Sales            [L2] Hiring Fundamentals          │
│  [L4] Internal Comms                                            │
├── Growth ──────────────────────────────────────────────────────┤
│  [L2] Pipeline Mgmt          [L1] Structured Onboarding ⚠      │
│  [L1] User Research          [L2] Perf Mgmt                     │
│  [L2] Financial Forecasting  [L0] Customer Success ⚠           │
├── Excellence ──────────────────────────────────────────────────┤
│  [L1] Enterprise Sales ⚠     [L0] PLG                           │
│  [L0] Partner Development    [L0] Talent Brand                  │
│  [L0] Culture as Retention   [L0] Strategic Finance             │
├── Mastery ─────────────────────────────────────────────────────┤
│  [L0] Category Creation      [L0] Platform Development          │
│  [L0] M&A                    [L0] Predictive Org Design         │
└────────────────────────────────────────────────────────────────┘
```

Each node is a card. Clicking opens a detail panel:

- Level history over time (line chart -- levels down as well as up)
- Three-dimension breakdown for the latest assessment
- Evidence trail with links to source records
- Prerequisites: satisfied ✓, blocked ⚠, or n/a
- Recommended Campaigns to advance this skill (Tamir-generated)
- A "why not higher?" narrative from the most recent assessment

The critical UI rule: **the tree is view-only for the CEO.** There is no "edit level" button. This is not a limitation to explain -- it is the design.

---

## Fog of War

Fog of War is not a feature -- it's a rendering discipline applied to every piece of information Tamir surfaces. It is what makes the system trustworthy.

### Confidence at Every Layer

The `confidence` enum (`clear | uncertain | dark`) appears on:
- Every `Situation`
- Every option in every `DecisionCard`
- Every `TheaterState`
- Every claim in every `Brief`

At the UI layer, confidence is rendered as a color band, an icon, and a hover-explaining label. Dark zones are never hidden -- they are labeled as dark, with the missing data named explicitly.

### The Reconnaissance Pattern

Dark zones create a first-class command action: **run reconnaissance**. When Tamir surfaces a Decision Card whose best option is `dark`, the card offers a "Reconnaissance" branch instead of just "decide anyway."

Backend: reconnaissance is a scoped `Campaign` of `type: 'operational'` with a fixed structure -- one or two research phases, an expected duration, and a bounded cost. When the reconnaissance resolves, Tamir revisits the original Decision Card, updates its options based on the new evidence, and returns it to the queue.

This is a distinct branch in the state machine: `DecisionCard.status = 'awaiting_recon'`, with a linked `Campaign.id`.

### Theater HUD

The Command Queue view (`/`) renders a compact Theater HUD at the top:

```
Sales ● healthy · rising     Product ◐ strained · falling ⚠
People ● healthy · flat      Finance ● healthy · flat
Ops    ◑ strained · flat     Market ○ dark · unknown ⚠
```

- Filled dot: clear confidence
- Half dot: uncertain
- Empty dot: dark
- Trend arrow: rising / flat / falling
- Warning triangle: an open Situation is ripening

Clicking a theater opens its detail view: open Situations, active Campaigns, unassessed skills, recent Decisions.

---

## The Operating Rhythm

Cron-scheduled briefings are the system's heartbeat. Each is a persistent `Brief` object, not an ephemeral notification.

### Morning Brief

Fired at 07:00. Structure (Tamir's zod-constrained output):

```
MORNING BRIEF · 2026-01-15

Overnight changes:
- Acme deal moved to eval stage (Sales · clear)
- Engineer C's commit frequency dropped 40% (People · uncertain)

The Three (highest-leverage moves today):
1. Decide Trellis escalation card (window closes Fri)
2. Approve Pipeline Recovery Phase 2 pivot
3. Assess Customer Success skill (evidence threshold reached)

Active campaigns:
- Pipeline Recovery: Phase 1 complete, Phase 2 pending your approval
- Culture Reset: Week 2, on track

New situations (not yet ripe):
- Mid-market pricing pattern (3 signals, still uncertain)
```

Rendered as a markdown card at the top of `/`. Marked as read when the CEO opens it.

### Midday Pulse

Fired at 13:00. Silent by default. Only surfaces if something changed materially since morning -- a decision consequence landed, a campaign phase completed, a critical signal fired.

**The system MUST prefer silence over noise here.** If nothing meaningful changed, no Brief is generated. Add a `Brief.suppressed: true` field for logging that the pulse ran but had nothing worth surfacing.

### Evening Review

Fired at 19:00. Structure:

```
EVENING REVIEW · 2026-01-15

What you did:
- Decided Trellis escalation (Option B: pricing counter)
- Approved Pipeline Recovery Phase 2 pivot
- Skipped Customer Success skill assessment

What deferred:
- Investor update draft (still not started, due Thursday)

Consequences updating:
- Yesterday's decision on Acme is trending positive (T+7 observation)

Tamir's honest assessment:
You spent attention well on Sales but the Customer Success work
you keep deferring is now 3 days overdue. It's a Level 0 skill --
every week you don't invest here compounds churn. Recommend
tomorrow's Morning Brief lead with a CS Campaign proposal.
```

The "honest assessment" section is important. Tamir names deferrals and their consequences. Not to shame -- to make the map complete.

### Weekly Campaign Review

Fired Monday 08:00. Zooms out: how did the six theaters move? Which campaigns advanced? What decisions from last week played out?

### Quarterly Reckoning

Fired the first day of each quarter at 09:00. This is the article's most demanding briefing:

- State of every theater
- Outcome of every resolved campaign
- Accuracy of every major decision (via Consequences)
- Gaps not addressed
- **The Bets question**: "What are the three bets for this quarter? Not the tasks. The bets."

The CEO answers by creating `Bet` records. The next Quarterly Reckoning reads them and asks: won? lost? ambiguous?

---

## The Command Queue: The New Home Screen

The current `/` dashboard is replaced by the Command Queue. This is where the CEO enters the system every day. Everything else is a click away, but this is the map.

### Layout

```
┌── COMMAND QUEUE · Wed Jan 15 · 09:22 ──────────────────────────┐
│                                                                 │
│  [Theater HUD: Sales · Product · People · Finance · Ops · Mkt] │
│                                                                 │
│  ── Morning Brief ────── read → ─────────────────────────────  │
│                                                                 │
│  ── The Three ──                                                │
│  1. [Reactive · Sales] Trellis escalation                       │
│     Window: closes Fri  · Confidence: uncertain                 │
│     [Open Card →]                                               │
│                                                                 │
│  2. [Strategic · Product] Repositioned pilot approval           │
│     Window: none · Confidence: clear                            │
│     [Open Card →]                                               │
│                                                                 │
│  3. [Capability · People] Customer Success gap                  │
│     Window: rolling · Confidence: clear                         │
│     [Open Card →]                                               │
│                                                                 │
│  ── Active Campaigns (2) ──                                     │
│    ● Pipeline Recovery · Phase 1 complete · pivot pending       │
│    ● Culture Reset · Week 2 · on track                          │
│                                                                 │
│  ── Watching (5 open situations, not yet ripe) ──               │
│    ◐ Mid-market pricing pattern (uncertain)                     │
│    ◐ Engineer C velocity drop (uncertain)                       │
│    ◐ Competitor Y hiring signals (dark)                         │
│    ◐ SMB response time creep (uncertain)                        │
│    ◐ Renewal cohort Q1 (dark)                                   │
│                                                                 │
│  ── Recent Consequences ──                                      │
│    Acme decision (T+7): trending positive                       │
│    Rebrand approval (T+14): net positive                        │
│    VP Sales hire delay (T+30): -$180K revenue attributed        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Key design commitments:

- **The Three is ranked by Tamir, not the CEO.** The CEO can override by opening a lower-priority card, but the ranking is Tamir's job. If the CEO overrides frequently, Tamir learns and re-ranks future queues.
- **Every item shows type (Reactive / Strategic / Capability).** The article's three mission types are always visible so the CEO doesn't drift into 100% reactive command.
- **"Watching" is intentional visibility of things that are NOT ripe.** This is the strategy game "you see it but can't fight it yet" affordance. Prevents surprise.
- **"Recent Consequences" is always visible.** The CEO cannot avoid looking at what their past decisions produced.
- **No badges, streaks, or scores anywhere.** Ever.

---

## New MCP Tools

The Command Layer adds a set of MCP tools scoped exclusively to Tamir (except where noted). Each is registered in `src/lib/mcp/tools/` and gated in `src/lib/mcp/access-control.ts`.

| Tool | Owner | Purpose |
|---|---|---|
| `emit_signal` | any agent | Any agent can drop a Signal into the pipeline. Used by dept heads to flag observations Tamir wouldn't otherwise see. |
| `synthesize_situation` | tamir | Take N signals and produce a Situation. |
| `ripen_decision_card` | tamir | Promote a Situation to a Decision Card. |
| `propose_campaign` | tamir | Propose a Campaign for CEO approval. |
| `advance_campaign_phase` | tamir | Move a campaign to the next phase; write the phase-closing summary. |
| `write_post_action_review` | tamir | Generate the PAR on campaign close. |
| `assess_company_skill` | tamir **only** | Write a SkillAssessment. Rejected for every other agent. |
| `propose_doctrine` | tamir | Emerge a Doctrine from decision patterns. |
| `ratify_doctrine` | *not a tool -- API endpoint* | Doctrines are ratified via CEO action in the UI. |
| `observe_consequence` | tamir | Write a Consequence record for a past Decision. |
| `refresh_theater_state` | tamir | Recompute a TheaterState from open situations + campaigns. |
| `compose_brief` | tamir | Generate a Brief of a given type. |

Access control (`src/lib/mcp/access-control.ts`) declares which agents can call which tools. Enforcement is at the MCP server layer -- if a CTO or CMO agent tries to call `assess_company_skill`, the call is rejected and logged.

---

## API Surface

New Next.js Route Handlers:

```
GET  /api/command-queue                    → Command Queue payload (theaters, the-three, situations, campaigns, consequences)
GET  /api/situations                       → open situations, filterable by theater
GET  /api/situations/:id                   → single situation with evidence
POST /api/situations/:id/dismiss           → CEO overrides Tamir; situation archived with reason

GET  /api/decisions                        → open Decision Cards (queue)
GET  /api/decisions/log                    → decided cards + consequences
GET  /api/decisions/:id                    → single card
POST /api/decisions/:id/decide             → resolve a card
POST /api/decisions/:id/defer              → snooze
POST /api/decisions/:id/discuss            → open a Tamir chat scoped to this card

GET  /api/campaigns                        → active + proposed campaigns
GET  /api/campaigns/:id                    → single campaign with phases
POST /api/campaigns/:id/approve            → CEO approves a proposed campaign
POST /api/campaigns/:id/pause              → CEO pauses
POST /api/campaigns/:id/resolve            → CEO marks resolved (Tamir writes PAR)
POST /api/campaigns/:id/abandon            → CEO abandons

GET  /api/company-skills                   → full tree with current levels
GET  /api/company-skills/:id               → skill with assessment history + evidence
GET  /api/company-skills/:id/assessments   → all assessments over time
                                             (NO POST/PUT endpoint -- Tamir-only via MCP)

GET  /api/doctrines                        → all doctrines
POST /api/doctrines/:id/ratify             → CEO ratifies a proposed doctrine
POST /api/doctrines/:id/retire             → CEO retires a ratified doctrine

GET  /api/bets                             → all bets, filterable by quarter
POST /api/bets                             → CEO creates a new bet (at Reckoning)

GET  /api/briefs?type=morning              → most recent brief of type
GET  /api/briefs/:id                       → single brief

GET  /api/theaters                         → all theater states
GET  /api/theaters/:id                     → theater with situations + campaigns
```

All GETs return JSON that maps 1:1 to a zod schema in `src/a2a/schemas.ts`. All POSTs validate input via zod. SSE updates emit whenever any of these records change so the UI is live.

---

## UX Principles

The article's non-negotiables translate into concrete UI rules that must be enforced. Some are already listed above but they deserve consolidation:

### 1. No Points, Badges, Streaks, Leaderboards

Enforcement: a CI check greps the codebase for the strings `points`, `badge`, `streak`, `leaderboard`, `xp`, `achievement`, `level_up_animation`. Any match in `src/` fails CI. The list is maintained in `.github/no-gamification.txt`. Exceptions require a comment explaining why (e.g., `level` in `SkillAssessment.level` is contextually different).

### 2. No Artificial Urgency

Every `Situation.timeWindow` and `DecisionCard`-derived urgency must reference a real timestamp with a source. UI never renders phrases like "act soon" or "urgent" -- it renders "closes Fri (Acme budget cycle)" or "expires in 3 days (Q1 board review)."

Enforcement: schema validation. `Situation.timeWindow` requires `timeWindowRef` to be non-null when `timeWindow` is set. The UI reads from `timeWindowRef` and displays it verbatim.

### 3. No Noise

Midday Pulse produces no Brief when nothing changed. SSE only fires on state changes. Notifications are opt-in per event class and off by default. The system's default posture is quiet.

### 4. Confidence is Always Displayed

Every claim carries a confidence band. Never a bare number. Never a raw string. The UI renders confidence with a consistent affordance across every card, briefing, and theater tile.

### 5. Reasoning is Required

Every Decision Card resolution requires the CEO to write a reasoning line. It's not optional. Not because compliance -- because the Decision Log's value is entirely dependent on future-you understanding past-you.

### 6. The Skill Tree is Read-Only

Zero CEO write affordances. No "self-report level" button will ever exist. This is a hard rule that the codebase enforces at three layers.

### 7. Fog Is Named

Dark zones are labeled dark. Uncertain zones are labeled uncertain. The system never renders a fully-lit map when the underlying confidence isn't there.

---

## Phased Build Plan

The Command Layer is large. It is buildable in slices. Each phase is independently shippable and delivers user value.

### Phase 1 -- The Skeleton (2-3 weeks)

- Prisma migration: all thirteen new models
- Rename `Skill` → `AgentSkill` across codebase
- Seed CompanySkill tree + TheaterState
- Signal pipeline v1: internal sources only (ActivityLog, TaskRun, CostEvent, Deliverable, Escalation)
- Tamir cron: world-read loop only, every 15 min
- `Situation` synthesis + `DecisionCard` ripening (rule-based ripeness)
- `/api/command-queue` endpoint
- Command Queue home screen (replaces `/`)
- Decision Card view + decide/defer endpoints
- Non-negotiables CI check

**Ship criterion:** CEO sees a live Command Queue with Tamir-authored Decision Cards derived from real system activity, and can decide them.

### Phase 2 -- Campaigns (2 weeks)

- Campaign + CampaignPhase models
- `propose_campaign` MCP tool
- Campaign view + approve/pause/resolve endpoints
- Auto-generated Post-Action Reviews on close
- Vault filing + FTS5 indexing of PARs
- Pattern retrieval: when a new Situation ripens, search PARs for similar past ops

**Ship criterion:** Tamir proposes multi-phase Campaigns; CEO approves; phases execute via existing Task system; PARs are filed and retrieved.

### Phase 3 -- Skill Tree (2 weeks)

- SkillAssessment writes (Tamir-only, three-layer enforcement)
- Evidence collectors: metric adapters per skill class (sales, product, people, finance, operations)
- Skill Tree UI at `/skill-tree`
- Prerequisite blocker detection + Tamir recommendations
- Capability campaign type with delayed skill re-assessment

**Ship criterion:** the tree renders live, updates over time from real evidence, and produces "the blocking prerequisite is X" insights.

### Phase 4 -- Operating Rhythm (1-2 weeks)

- Brief model + cron schedules for morning/midday/evening/weekly/quarterly
- Consequence sweeper (hourly, T+7/14/30 observation)
- Brief UI cards on the Command Queue
- Decision Log view
- Silence-preferred midday pulse enforcement

**Ship criterion:** the system has a heartbeat -- daily and weekly briefings appear, past decisions accumulate consequences, and the CEO can review them.

### Phase 5 -- Fog, Doctrine, Bets (1-2 weeks)

- Reconnaissance branch on Decision Cards
- Reconnaissance Campaign template
- Doctrine model + proposal/ratification flow
- Doctrine injection into Tamir's routing prompt (ratified doctrines become constraints)
- Bet model + Quarterly Reckoning scoring
- Full fog rendering across every UI surface

**Ship criterion:** the CEO can ratify operating principles, commit to quarterly bets, and see reconnaissance surface as a first-class command action when confidence is dark.

### Phase 6 -- External Signal Sources (ongoing)

Adapters for Calendar, GitHub, Gmail, Notion, Supabase. Each is independently buildable via the `SignalSource` interface. Priority depends on which external systems are richest for the founder's actual operating context.

---

## Open Design Questions

These are questions worth deciding early, but they don't block Phase 1.

**1. Should Tamir's decision to promote a Situation to a Decision Card be reviewable by the CEO?**
The current design says: Tamir promotes; the CEO decides or defers. An alternative is Tamir marks a Situation as "ripening" and asks the CEO whether to promote. This adds friction but gives the CEO more control over their queue. Recommendation: start with automatic promotion, add a "hide this class of situation" affordance if it becomes noisy.

**2. Are Decision Cards mutable once open?**
If Tamir gets new information about an open card -- e.g., a competitor moves -- can Tamir rewrite the options? Recommendation: yes, but every mutation is versioned in a `decision_card_revisions` shadow table so the Log has full history. The CEO sees the current version but can toggle to see prior versions.

**3. Where does "Discuss" chat live?**
Attached to the Decision Card record, using the existing chat JSONL pattern (`data/decisions/{cardId}/chat.jsonl`)? Or as a first-class Task with `type: 'consultation'`? Recommendation: JSONL pattern, matches existing convention.

**4. How does Doctrine ratification actually change Tamir's behavior?**
Ratified doctrines get injected into Tamir's system prompt on every world-read invocation. But at what token cost? For long doctrine lists, we may need a retrieval step (FTS5 over doctrines by domain match to the situation). Recommendation: start with full injection (there won't be many); switch to retrieval when doctrine count exceeds ~30.

**5. Can the CEO create Bets outside the Quarterly Reckoning?**
The article's structure implies Bets are quarterly. But mid-quarter, the CEO might want to commit to a new bet. Recommendation: allow, but tag `Bet.createdAt` relative to `quarterLabel` so the Reckoning knows which bets it's scoring. Off-cycle bets score at the next Reckoning.

**6. Do we ever expose Signals to the CEO directly?**
The pipeline is internal. But a "raw feed" debugging view could be useful during development. Recommendation: ship a `/dev/signals` view behind a debug flag. Not user-facing in production.

---

## What Success Looks Like

Six months after Phase 5 ships, the CEO's experience of Cortex is qualitatively different:

- They open the system in the morning and see a live map, not a task list.
- They make three to five decisions a day, each of which is a real judgment call with visible trade-offs.
- They know exactly what their past decisions produced -- the Log shows it.
- They see the Skill Tree evolve month by month, and they know what the tree evolved *because* of.
- They know which bets they made this quarter and whether they're on track.
- They never see a badge, a streak, or a leaderboard.
- They never open a task list.

The system is not a place they visit to be productive. It is the map from which they command a company.

---

*The map is live. The world is moving. Your move, Commander.*
