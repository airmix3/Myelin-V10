# 23 -- Command Layer, Executive Assistant, and Cortex Synergy

## Purpose

This document explains how the Command Layer, the Executive Assistant, and the existing Cortex execution system connect into one operating system.

Docs 20, 21, and 22 define the product requirements for the Command Layer and Executive Assistant. This document defines the system relationship between them:

- **Command Layer** -- interprets the company as a live strategic world
- **Executive Assistant** -- protects CEO attention, separates work from judgment, and manages the CEO operating surface
- **Cortex execution system** -- turns approved judgment and promoted artifacts into agent work through A2A tasks, workspaces, deliverables, and review

The key principle:

```text
Command Layer decides what matters in the company.
Executive Assistant decides what deserves the CEO's attention.
Judgment Queue explains why the CEO is needed.
A2A execution turns approved moves into work.
```

These are not three separate products. They are three layers of the same Tamir intelligence.

## Core Model

Tamir has one intelligence and two spaces:

- **Company Space** -- the company operating map: theaters, situations, missions, campaigns, agents, deliverables, escalations, resources, consequences, doctrine, and skills.
- **CEO Space** -- the CEO operating surface: attention, Judgment Queue, attention budget, operating mode, The Three, CEO Missions, commitments, relationships, calendar, energy, private decision log, personal model, taste standards, negative space rules, anti-busyness insights, and CEO workspace.

The spaces are connected but not symmetrical.

Company Space can produce CEO-visible needs. CEO Space can promote approved outputs into Company Space. But private CEO data does not flow automatically into the company.

```text
Company Space
  -> command situations
  -> command missions
  -> attention signals
  -> attention budget + operating mode
  -> CEO brief / Judgment Queue / The Three / CEO Mission / interruption
  -> CEO decision
  -> promotion to company execution
  -> A2A task / campaign / recon / direction
  -> consequence tracking
  -> doctrine / skill / memory
```

## Layer Responsibilities

### Command Layer

The Command Layer is responsible for interpreting company reality.

It consumes operational evidence from Cortex:

- tasks
- task runs
- deliverables
- escalations
- agent activity
- strategic directions
- goals
- task seeds
- assets
- routines
- company memory
- future external data sources

It transforms raw activity into command meaning:

```text
Signal -> Event -> Situation -> Quest -> Mission -> Decision -> Campaign -> Consequence -> Doctrine / Skill
```

The Command Layer should answer:

- what changed in the company?
- which theater is under pressure?
- which opportunity is opening?
- which area is dark or uncertain?
- which resource is constrained?
- which decision requires judgment?
- what did the last decision cause?
- what capability is the company gaining or failing to gain?

The Command Layer should not manage the CEO's calendar, private inbox, energy state, or personal commitments. Those belong to CEO Space.

### Executive Assistant

The Executive Assistant is responsible for protecting and shaping CEO attention.

Its first job is not productivity. Its first job is the attention boundary: deciding what deserves the CEO at all.

It separates ordinary work from CEO-only judgment. Work can be routed, scheduled, delegated, batched, or suppressed. Judgment is different because it requires the CEO's taste, authority, risk tolerance, relationship context, or strategic frame.

It consumes:

- command missions from Company Space
- escalations and agent blockers
- deliverables ready for CEO review
- decision revisit prompts
- decision outcome review prompts
- CEO commitments
- relationship maintenance signals
- calendar signals
- inbox signals
- quality or taste review signals
- CEO Mission candidates
- CEO state
- current attention budget
- current operating mode
- personal model observations
- Taste Standards
- Negative Space Rules

It normalizes these into Attention Signals, then applies the Attention Shield.

The Attention Shield decides:

- **interrupt now** -- break focus because the cost of waiting is higher than the cost of interruption
- **bundle later** -- include in the next brief or review
- **delegate or route** -- send away from the CEO when CEO judgment is not required
- **suppress** -- record as noise, duplicate, or low-value urgency

If an item needs CEO judgment but does not justify immediate interruption, it becomes a Judgment Queue Item.

The Judgment Queue is not a task list. It is the filtered set of judgment calls that survived routing, batching, and suppression. Each item must explain:

- why the CEO is seeing it
- why now
- what happens if ignored
- suggested action

The Attention Shield must also spend the CEO's daily Attention Budget deliberately. Modes such as Standard, Deep Work, Board / Investor, Hiring, Crisis, and Recovery adjust thresholds, brief length, scheduling rules, and interruption budgets without changing the privacy boundary.

The Executive Assistant should answer:

- what should the CEO know now?
- what requires CEO judgment?
- what should be saved for the brief?
- what can be routed away?
- how much attention budget remains?
- what operating mode is active?
- what is one of The Three today?
- what CEO-only work is missing an owner?
- what promise did the CEO make?
- what decision should be revisited?
- what outcome review is due?
- which relationship is cooling or at risk?
- which work is below the CEO's taste or quality standard?
- where is busyness displacing leverage?
- what strategic time must be protected?

The Executive Assistant should not silently create company work from private CEO data. Company-facing work requires explicit promotion.

### Cortex Execution System

The existing Cortex system is responsible for execution.

It owns:

- A2A task lifecycle
- department routing
- planning with department heads
- task approval
- task runs
- workspaces
- deliverables
- review
- escalations
- cost and activity logs
- agent memory and knowledge

This layer should remain the canonical path for company work.

When a command move becomes executable work, it enters the existing system as:

- a task
- a task seed
- a direction
- a goal
- a campaign task
- a recon task
- a deliverable review
- an escalation response

The Command Layer and Executive Assistant should not bypass A2A execution. They should prepare better work for it.

## End-to-End Flow

### 1. Company Reality Produces Signals

Signals come from operational state.

Examples:

- a task is blocked for two days
- a deliverable is ready for CEO review
- an agent asks the same strategic question repeatedly
- a routine generated no useful output
- a goal has active task seeds but no owner
- a campaign milestone slipped
- a prior decision reaches its review date

Signals are evidence, not yet command work.

### 2. Command Layer Builds Situations

Tamir groups related signals into a Situation.

Example:

```text
Three marketing tasks stalled because brand direction is inconsistent.
```

The Situation should include:

- theater
- summary
- evidence
- confidence
- urgency
- leverage
- resource pressure
- what is known
- what is inferred
- what is dark

### 3. Situations Become Quests or Command Missions

Not every Situation deserves immediate CEO attention.

A Situation may become:

- **Quest** -- a meaningful optional or future move
- **Command Mission** -- a ranked item in the command queue
- **Recon Mission** -- a move to reduce uncertainty
- **Campaign Candidate** -- a multi-step strategic operation
- **Doctrine Candidate** -- a repeated pattern that may need codification
- **Suppressed Background State** -- tracked but not surfaced

Mission quality is judged by whether the item changes company state:

- reduces risk
- captures an opportunity
- improves confidence
- unblocks execution
- advances a campaign
- builds capability
- reviews a consequence
- updates doctrine
- improves autonomy

### 4. Command Missions Become Attention Signals

When a Command Mission may require CEO attention, it becomes an Attention Signal in CEO Space.

This is the connection point between the Command Layer and Executive Assistant.

```text
CommandMission
  -> AttentionSignal(source = "company")
  -> AttentionDecision
```

The Attention Signal should reference the originating company objects but remain evaluated by CEO-space policy.

The conversion should add CEO-space scoring fields that do not belong to the company map itself:

- judgment requirement
- relationship trust impact
- interruption cost
- attention budget impact
- current focus conflict
- operating mode relevance
- negative space conflict
- taste or quality review requirement

Example:

```text
Command Mission:
Product launch campaign is blocked by missing pricing direction.

Attention Signal:
CEO-only decision may be required today because two agents are waiting and the campaign review is tomorrow.
```

### 5. Attention Shield Chooses the CEO Surface

The Attention Shield decides where the item goes.

Possible outcomes:

- immediate interruption
- Judgment Queue item
- morning brief item
- one of The Three
- CEO Mission candidate
- commitment reminder
- decision revisit prompt
- decision outcome review prompt
- relationship prompt
- anti-busyness insight
- delegated company task
- suppressed audit record

The CEO should not see every company signal. The CEO should see the highest-leverage interpretation of what matters.

The Attention Shield should prefer this order:

1. Preserve focus unless interruption is justified.
2. Convert raw signals into meaning.
3. Decide whether CEO judgment is required.
4. Route non-CEO work away.
5. Spend attention budget deliberately.
6. Queue judgment calls that matter but can wait.
7. Interrupt only when waiting is more expensive than breaking focus.

### 6. CEO Makes a Move

The CEO can respond with command actions:

- **Decide** -- choose a direction or option
- **Delegate** -- send execution to an agent or department
- **Defer** -- postpone intentionally with a reason and revisit date
- **Reject** -- reject a proposed option, mission, artifact, or recommendation
- **Open Workspace** -- move CEO-only thinking or production into the CEO canvas
- **Monitor** -- keep watching without intervention
- **Recon** -- gather evidence before committing
- **Campaign** -- start or adjust a strategic operation
- **Codify** -- turn a lesson into doctrine or a playbook
- **Dismiss** -- close the item as not useful or not worth tracking

This is where the Command Layer and Executive Assistant meet the existing Cortex system.

### 7. Approved Moves Enter A2A Execution

If the move requires company work, it should become an explicit company artifact.

Examples:

- CEO delegates research -> create recon task
- CEO approves campaign -> create campaign and supporting tasks
- CEO promotes strategy memo -> create direction, goal, or task seed
- CEO asks for execution -> create A2A task
- CEO approves deliverable review -> update task state
- CEO codifies doctrine -> write company-visible doctrine artifact

The A2A system remains authoritative for execution state.

```text
CEO approval
  -> redacted company artifact
  -> A2A task / direction / goal / task seed / campaign
  -> agent execution
  -> deliverable or result
```

### 8. Consequences Return to the Command Layer

Execution results are not the end of the loop.

The Command Layer must observe what happened afterward:

- Did the decision unblock work?
- Did the campaign advance?
- Did the recon reduce uncertainty?
- Did the deliverable improve the company state?
- Did the expected outcome happen?
- Did the move create a new resource collision?
- Did the company become more autonomous?

This creates a Consequence Review.

The Consequence Review may produce:

- updated Situation
- updated Campaign
- updated Decision Card
- Doctrine Proposal
- Skill Assessment change
- new Command Mission
- memory update

## Data Visibility Rules

### Default Privacy

CEO Space data is private by default.

Company agents must not read:

- raw CEO inbox content
- private calendar details
- CEO state snapshots
- personal model observations
- suppressed attention signals
- private commitments
- private decision log entries
- private decision outcome reviews
- Relationship Assets
- Taste Standards
- Negative Space Rules
- Anti-Busyness Insights
- private workspace drafts

### Promotion Only

CEO Space content crosses into Company Space only through explicit promotion.

Allowed promotions:

- CEO Mission becomes company task
- CEO workspace output becomes mission brief
- decision becomes company direction
- memo becomes department objective
- inbox-derived request becomes delegated task
- commitment becomes company-visible deadline
- relationship follow-up becomes delegated outreach task
- taste feedback becomes a company-visible quality standard only after explicit CEO approval
- anti-busyness correction becomes a company process change only after explicit CEO approval

Promotion must create a redacted company-visible artifact.

The artifact should contain only what agents need to execute.

### Redaction

Promotion should remove:

- raw email bodies unless explicitly included
- private personal state
- private calendar context
- personal model observations
- suppressed signal history
- relationship intelligence not required for execution
- Taste Standards not explicitly promoted
- Negative Space Rules
- Anti-Busyness Insights
- sensitive counterparties not required for execution
- private rationale not required by agents

## Object Mapping

| Company / Command Object | CEO Space Object | Cortex Execution Object |
| --- | --- | --- |
| Signal | Attention Signal | Activity log, task event, escalation, deliverable event |
| Situation | Brief item or mission candidate | None until promoted |
| Quest | CEO Mission candidate or command queue item | Task seed if promoted |
| Command Mission | Attention Signal or Judgment Queue Item | Task, campaign, recon task, direction, goal |
| Decision Card | Decision prompt | Decision record, direction, task metadata |
| Decision Outcome Review | Outcome review prompt | Decision record update, consequence evidence |
| Recon Mission | CEO Mission or delegated action | A2A task |
| Campaign | Brief item, The Three input | Tasks, task seeds, deliverables, reviews |
| Consequence Review | Decision revisit prompt | Activity and deliverable evidence |
| Doctrine Proposal | CEO Mission or brief item | Knowledge, vault, memory, skill |
| Skill Assessment | Brief item or command map state | Agent memory, task outcomes, deliverable reviews |
| Relationship Signal | Relationship prompt or Judgment Queue Item | Follow-up task only if promoted |
| Quality Review Signal | Taste review prompt or Judgment Queue Item | Revision task, deliverable review, quality doctrine |
| Attention Budget | CEO Home state | No execution object |
| Operating Mode | CEO Home state and shield input | No execution object |
| Negative Space Rule | Scheduling constraint | Calendar block only if connected and approved |
| Anti-Busyness Insight | Evening or weekly review item | Process change only if promoted |

## UI Relationship

### `/tamir` -- Company Space

The `/tamir` surface should evolve into the command surface.

It should show:

- company situation report
- theater map
- command queue
- active campaigns
- decision cards
- recon opportunities
- consequence reviews
- resource collisions
- doctrine and skill progression

This space answers:

```text
What is happening in the company, and what move should be made?
```

### `/executive-assistant` -- CEO Space

The `/executive-assistant` surface should manage the CEO's operating day.

It should show:

- current brief
- Judgment Queue
- The Three
- interruptions requiring action
- attention budget remaining
- current operating mode
- open CEO Missions
- commitments due soon
- decision revisit prompts
- decision outcome review prompts
- key relationship prompts
- anti-busyness insight
- protected strategic blocks
- Attention Shield summary
- private relationships surface
- private taste and standards surface
- private CEO workspace

This space answers:

```text
What should the CEO personally pay attention to now?
```

More precisely, it answers:

```text
What requires my judgment, what should be protected from me, and where should my attention go today?
```

### Shared Tamir Context

The context should carry across both spaces.

Example:

```text
/tamir:
Product campaign is blocked by missing pricing direction.

/executive-assistant:
Pricing direction should be one of The Three today because Product, Sales, and investor messaging are all waiting on it.
```

This is the desired synergy: Company Space explains the strategic reality. CEO Space translates that reality into human attention and daily execution.

## System Contracts

### Command Layer to Executive Assistant

The Command Layer should emit CEO-attention candidates with structured context.

Minimum fields:

```typescript
interface CommandAttentionCandidate {
  id: string;
  sourceType:
    | "situation"
    | "mission"
    | "campaign"
    | "decision"
    | "consequence"
    | "skill"
    | "doctrine"
    | "relationship"
    | "quality_review";
  sourceId: string;
  title: string;
  summary: string;
  theater: string | null;
  evidenceRefs: string[];
  confidence: number;
  urgency: number;
  strategicImportance: number;
  ceoOnlyRequirement: number;
  judgmentRequirement: number;
  relationshipTrustImpact: number;
  downstreamRisk: number;
  reversibility: number;
  qualityRisk: number;
  suggestedAction:
    | "decide"
    | "delegate"
    | "defer"
    | "reject"
    | "open_workspace"
    | "monitor"
    | "recon"
    | "campaign"
    | "codify"
    | "promote_to_company"
    | "dismiss";
  createdAt: string;
}
```

The Executive Assistant converts this into an Attention Signal and applies the Attention Shield.

### Attention Shield to Judgment Queue

The Attention Shield should create a Judgment Queue Item when CEO judgment is required but interruption is not justified.

Minimum fields:

```typescript
interface JudgmentQueueBridgeItem {
  id: string;
  source: "attention_signal" | "commitment" | "decision" | "mission" | "relationship" | "quality_review" | "company_blocker";
  sourceRef: string;
  title: string;
  summary: string;
  whySeeingThis: string;
  whyNow: string;
  ifIgnored: string;
  suggestedAction: "decide" | "delegate" | "defer" | "reject" | "open_workspace" | "promote_to_company";
  priority: number;
  privateToCeo: boolean;
  createdAt: string;
}
```

Every CEO-visible item outside a scheduled brief should be representable as either an Attention Decision or a Judgment Queue Item.

### Executive Assistant to Command Layer

The Executive Assistant should emit CEO decisions and promotion events.

Minimum fields:

```typescript
interface CEOPromotionEvent {
  id: string;
  sourceSpace: "ceo";
  sourceType:
    | "ceo_mission"
    | "commitment"
    | "decision"
    | "decision_outcome_review"
    | "workspace"
    | "brief_item"
    | "attention_signal"
    | "judgment_queue_item"
    | "relationship"
    | "taste_standard"
    | "anti_busyness_insight";
  sourceId: string;
  targetType: "task" | "task_seed" | "direction" | "goal" | "campaign" | "doctrine" | "decision_record";
  redactedArtifactRef: string;
  approvedBy: "ceo";
  approvedAt: string;
}
```

The Command Layer uses promotion events to update company state and track consequences.

### Executive Assistant to A2A Execution

CEO-approved execution should enter the existing task system.

Minimum rule:

```text
No private CEO-space signal creates a company task unless the CEO explicitly approves promotion or routing policy allows it for a low-risk category.
```

When a task is created, it should include references back to the CEO-space source and redacted artifact, not raw private data.

## Processing Pipeline

The combined pipeline should preserve the distinction between company interpretation and CEO attention filtering.

```text
Company and CEO sources
  -> ingest
  -> normalize
  -> extract meaning
  -> relate to company and CEO context
  -> apply operating mode and attention budget
  -> score attention, judgment, relationship, quality, and interruption cost
  -> decide through Attention Shield
  -> queue judgment when needed
  -> act by interrupting, bundling, routing, or suppressing
  -> record every decision
  -> learn from CEO feedback and outcome reviews
```

The important handoff is:

```text
Company interpretation produces candidates.
CEO policy decides visibility.
CEO approval produces execution.
Execution results produce consequences.
Consequences improve future interpretation.
```

Pipeline stages must be idempotent. Reprocessing the same source event must not create duplicate commitments, decisions, Judgment Queue Items, or alerts.

## Private CEO Primitives

Doc 22 is authoritative for the full Executive Assistant schema. Doc 23 treats the following as CEO-private primitives that influence the Command Layer only through attention decisions, promotion events, or redacted artifacts:

- Attention Signals
- Attention Decisions
- Judgment Queue Items
- Attention Budgets
- CEO Operating Mode States
- CEO Briefs
- CEO Focus Items
- CEO Missions
- Commitments
- Decision Log Entries
- Decision Outcome Reviews
- CEO State Snapshots
- Personal Model Observations
- Relationship Assets
- Taste Standards
- Negative Space Rules
- Anti-Busyness Insights
- Source Permission Settings
- Attention Feedback Events

These records may affect what Tamir recommends to the CEO, but company agents must not query them directly.

## Operating Rhythm

The combined system should have one rhythm, with different surfaces for different questions.

### Morning

Command Layer:

- what changed overnight?
- which theaters moved?
- which campaigns need attention?
- which decisions are due?
- which dark areas need recon?

Executive Assistant:

- what reaches the CEO today?
- what mode is the CEO operating in?
- how much attention budget is available?
- what belongs in the Judgment Queue?
- what are The Three?
- what commitments are due?
- which relationships need care?
- what can be bundled, routed, or suppressed?
- what work should not be scheduled today?
- what strategic blocks must be protected?

### Midday

Command Layer:

- did company state materially change?
- did a blocker age into risk?
- did recon return?

Executive Assistant:

- should the CEO be interrupted?
- is the interruption worth the remaining attention budget?
- should The Three change?
- should the calendar be protected?
- should a judgment call be queued instead of interrupting?

### Evening

Command Layer:

- what moved?
- what stalled?
- what decisions produced evidence?

Executive Assistant:

- what did the CEO complete?
- what deferred?
- what commitments aged?
- did low-leverage work displace The Three?
- were attention budget decisions right?
- what should tomorrow inherit?

### Weekly

Command Layer:

- campaign movement
- theater movement
- consequence reviews
- capability changes

Executive Assistant:

- bottleneck mirror
- approval latency
- Judgment Queue aging
- attention budget use
- strategic time protection
- relationship decay
- taste pre-filter corrections
- anti-busyness patterns
- repeated avoidance or overload patterns

## Implementation Path

### Phase 1: Shared Internal Model

Build the company-to-CEO bridge without external integrations.

Add:

- company signals from existing tasks, deliverables, escalations, and activity logs
- simple situations
- generated command missions
- attention signals
- attention decisions
- Judgment Queue
- Standard and Deep Work operating modes
- basic attention budget
- The Three
- CEO Missions
- Decision Log
- decision outcome review notes
- basic Anti-Busyness review

Do not add inbox or calendar yet.

### Phase 2: Promotion Flow

Add explicit promotion from CEO Space to Company Space.

Support:

- CEO Mission to A2A task
- workspace output to task seed
- decision to direction
- Judgment Queue item to task, direction, or workspace
- recon request to A2A task
- relationship follow-up to task only after approval
- taste feedback to quality doctrine only after approval
- doctrine proposal to knowledge or vault artifact

Every promotion should create a redacted artifact and an audit record.

### Phase 3: Company-State Integration

Connect company execution state into CEO-space filtering.

Support:

- agent blocker signals
- deliverable-ready signals
- escalation signals
- approval latency tracking
- Bottleneck Mirror
- Judgment Queue items from company blockers
- Taste Standards for deliverable review
- mission generation from company gaps

### Phase 4: Consequence and Judgment Tracking

Connect execution outcomes back to command state.

Support:

- expected outcomes
- review dates
- evidence collection
- consequence summaries
- decision outcome reviews
- campaign updates
- skill assessment updates
- doctrine proposals

### Phase 5: Calendar Integration

Only after privacy and promotion work:

- calendar read access
- schedule-aware The Three
- protected strategic blocks
- full operating modes
- Negative Space Rules
- attention budget changes by mode

### Phase 6: Inbox and Relationship Integration

Only after CEO-private source controls work:

- email read access
- commitment extraction
- Relationship Assets
- relationship signals
- inbox-derived CEO Missions
- meeting context briefs

### Phase 7: Proactive Outreach

Only after the Attention Shield audit trail works:

- interruption engine
- source/category controls
- proactive messages
- feedback learning
- suppressed signal review
- relationship maintenance prompts
- taste pre-filtering from CEO corrections

## Non-Negotiable Rules

- **No fake gamification** -- engagement comes from clarity, consequence, and capability growth.
- **No raw signal spam** -- raw events become situations before they become CEO-visible work.
- **No certainty without evidence** -- every strategic claim needs confidence and source references.
- **No private leakage** -- CEO Space data crosses into Company Space only by promotion.
- **No task bypass** -- company execution flows through A2A tasks, task seeds, directions, goals, campaigns, or doctrine artifacts.
- **No silent suppression** -- every Attention Signal receives an auditable Attention Decision.
- **No judgment without explanation** -- every Judgment Queue Item explains why the CEO is seeing it, why now, what happens if ignored, and what action is suggested.
- **No attention budget waste** -- interruptions and high-friction prompts spend a scarce daily resource and must justify the cost.
- **No mode-based privacy relaxation** -- operating modes change priority and thresholds, not data visibility.
- **No mission inflation** -- a mission must change company state or it should remain a task, note, or background signal.
- **No disconnected consequence** -- important decisions must return later for review.
- **No relationship leakage** -- relationship intelligence stays private unless the CEO promotes a specific follow-up or artifact.
- **No taste opacity** -- quality-based routing must be correctable and auditable.
- **No punitive anti-busyness** -- anti-busyness insights should cite displaced high-leverage work and remain product feedback, not a score.

## The Synergy

The Command Layer makes the company legible.

The Executive Assistant makes the CEO's attention scarce, protected, and directed. It also separates work from judgment, controls the attention budget, protects negative space, and keeps relationship, taste, and personal operating context private.

The Cortex execution system makes decisions operational.

Together they form the full loop:

```text
Reality moves.
Tamir interprets it.
The CEO sees only what matters.
The CEO makes a move.
Cortex executes through agents.
Reality responds.
Tamir learns.
The company becomes more capable.
```

That is the system Cortex should become: not a dashboard, not a task manager, and not a notification assistant, but a command operating system where company intelligence, CEO attention, and autonomous execution reinforce each other.
