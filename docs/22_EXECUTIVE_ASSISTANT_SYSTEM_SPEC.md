# 22 -- Executive Assistant System Requirements

## Purpose

This document turns the Executive Assistant product vision in Doc 21 into concrete system requirements. Doc 21 is the vision and narrative source. This document is the implementation reference for building Tamir's CEO Space as a reliable product surface.

The Executive Assistant mode is not a separate assistant. It is Tamir operating in a private CEO context with access to personal work signals, company state, and a policy layer that protects the CEO's attention.

## Product Boundary

The Executive Assistant system manages the CEO's operating surface:

- **Attention** -- decide what reaches the CEO, what is bundled, what is routed, and what is suppressed
- **Judgment** -- separate ordinary work from CEO-only judgment calls
- **Attention budget** -- treat interruptions as a scarce daily resource
- **Daily focus** -- select and track The Three
- **Operating mode** -- reshape filtering and scheduling around the CEO's current mode
- **CEO-only work** -- surface and execute CEO Missions
- **Commitments** -- extract, track, and revisit promises made by the CEO
- **Decisions** -- log significant CEO decisions, revisit them, and review outcomes
- **Relationships** -- track trust, commitments, context, and decay for key people
- **Calendar and energy** -- shape the day based on commitments, meetings, and CEO state
- **Negative space** -- protect the right kind of empty space for deep work and judgment
- **Strategic time** -- protect blocks for thinking and high-leverage work
- **CEO workspace** -- provide a canvas for writing, planning, analysis, and deliverable production
- **Taste and standards** -- learn the CEO's quality bar and pre-filter work before it reaches them

The system does not replace the company task lifecycle. When CEO work becomes company work, it must enter the existing Cortex planning and execution flow through the normal A2A task system.

## Core Principle

The Executive Assistant system is built around this rule:

**Tamir protects the CEO's attention before he optimizes the CEO's productivity.**

This is the ordering:

1. Preserve focus unless interruption is justified.
2. Convert raw signals into meaning.
3. Decide whether the CEO is required.
4. Route non-CEO work away from the CEO.
5. Spend the CEO's daily attention budget deliberately.
6. Surface only the highest-value CEO-visible items.
7. Maintain an audit trail so protection never becomes silent loss.

## System Primitives

### Attention Signal

An **Attention Signal** is any input that may compete for CEO attention.

Sources include:

- Email message or thread
- Calendar event, invite, conflict, or change
- Slack or communication-channel mention
- Company escalation
- Agent dependency
- Deliverable ready for review
- External market or competitor event
- Commitment due date
- Decision revisit trigger
- CEO Mission candidate
- Relationship maintenance signal
- Quality or taste review signal

Every signal is normalized before Tamir evaluates it.

```typescript
type AttentionSource =
  | "email"
  | "calendar"
  | "slack"
  | "company"
  | "agent"
  | "deliverable"
  | "external"
  | "commitment"
  | "decision"
  | "relationship"
  | "quality_review"
  | "manual";

type AttentionSignalStatus =
  | "new"
  | "classified"
  | "interrupted"
  | "bundled"
  | "delegated"
  | "suppressed"
  | "dismissed";

interface AttentionSignal {
  id: string;
  source: AttentionSource;
  sourceRef: string | null;
  title: string;
  summary: string;
  observedAt: string;
  status: AttentionSignalStatus;
  privateToCeo: boolean;
  extractedEntities: string[];
  relatedCompanyTaskIds: string[];
  relatedDecisionIds: string[];
  relatedCommitmentIds: string[];
}
```

### Attention Decision

An **Attention Decision** records what Tamir decided to do with an Attention Signal.

The decision must be stored even when the item is suppressed. This is the core auditability requirement.

```typescript
type AttentionDecisionAction =
  | "interrupt_now"
  | "bundle_later"
  | "delegate_or_route"
  | "suppress";

interface AttentionDecision {
  id: string;
  signalId: string;
  action: AttentionDecisionAction;
  confidence: number;
  reason: string;
  scores: AttentionScores;
  decidedAt: string;
  visibleToCeo: boolean;
  reviewableByCeo: boolean;
}

interface AttentionScores {
  urgency: number;
  strategicImportance: number;
  ceoOnlyRequirement: number;
  judgmentRequirement: number;
  relationshipTrustImpact: number;
  downstreamRisk: number;
  reversibility: number;
  interruptionCost: number;
  attentionBudgetImpact: number;
  currentFocusConflict: number;
  confidence: number;
}
```

### Judgment Queue Item

A **Judgment Queue Item** is a CEO-visible item that has passed the Attention Shield because it requires the CEO's judgment, taste, authority, relationship context, or risk tolerance.

Judgment Queue Items are the canonical way to present "why this needs you" to the CEO.

```typescript
type JudgmentQueueItemSource =
  | "attention_signal"
  | "commitment"
  | "decision"
  | "mission"
  | "relationship"
  | "quality_review"
  | "company_blocker";

type JudgmentQueueAction =
  | "decide"
  | "delegate"
  | "defer"
  | "reject"
  | "open_workspace"
  | "promote_to_company";

type JudgmentQueueItemStatus =
  | "open"
  | "acted"
  | "deferred"
  | "delegated"
  | "dismissed";

interface JudgmentQueueItem {
  id: string;
  source: JudgmentQueueItemSource;
  sourceRef: string;
  title: string;
  summary: string;
  whySeeingThis: string;
  whyNow: string;
  ifIgnored: string;
  suggestedAction: JudgmentQueueAction;
  status: JudgmentQueueItemStatus;
  priority: number;
  privateToCeo: boolean;
  createdAt: string;
  resolvedAt: string | null;
}
```

Every item surfaced outside a scheduled brief should be representable as a Judgment Queue Item or an Attention Decision.

### Attention Budget

An **Attention Budget** defines how many interruptions and high-friction judgment prompts the system may spend in a day or mode.

```typescript
interface AttentionBudget {
  id: string;
  date: string;
  mode: CEOOperatingMode;
  maxInterruptions: number;
  interruptionsUsed: number;
  maxJudgmentPrompts: number;
  judgmentPromptsUsed: number;
  strictness: "low" | "standard" | "high" | "critical_only";
  createdAt: string;
  updatedAt: string;
}
```

The budget does not block critical risk. It raises thresholds as attention gets spent.

### CEO Operating Mode

**CEO Operating Mode** controls filtering, brief length, scheduling recommendations, and interruption thresholds.

```typescript
type CEOOperatingMode =
  | "standard"
  | "deep_work"
  | "board_investor"
  | "hiring"
  | "crisis"
  | "recovery";

interface CEOOperatingModeState {
  id: string;
  mode: CEOOperatingMode;
  startsAt: string;
  endsAt: string | null;
  reason: string | null;
  setBy: "ceo" | "tamir_suggestion";
  createdAt: string;
}
```

Modes must never override privacy boundaries. They only change prioritization and scheduling behavior.

### CEO Brief

A **CEO Brief** is a bundled summary generated for a specific time window.

Briefs are the preferred output path for non-urgent but meaningful items.

```typescript
type BriefType =
  | "morning"
  | "midday"
  | "evening"
  | "weekly"
  | "ad_hoc";

interface CEOBrief {
  id: string;
  type: BriefType;
  title: string;
  operatingMode: CEOOperatingMode;
  attentionBudget: AttentionBudget;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  summary: string;
  judgmentQueueItems: JudgmentQueueItem[];
  focusItems: CEOFocusItem[];
  missionCandidates: CEOMission[];
  decisionsToReview: DecisionLogEntry[];
  decisionOutcomeReviews: DecisionOutcomeReview[];
  commitmentsDue: Commitment[];
  relationshipPrompts: RelationshipAsset[];
  antiBusynessInsight: AntiBusynessInsight | null;
  suppressedCount: number;
}
```

### The Three

**The Three** are the three highest-leverage items the CEO should personally complete today.

The Three are not a simple task list. They are selected from tasks, commitments, CEO Missions, decision needs, company blockers, and strategic priorities.

```typescript
type CEOFocusItemSource =
  | "task"
  | "commitment"
  | "decision"
  | "mission"
  | "company_blocker"
  | "strategic_time";

type CEOFocusItemStatus =
  | "selected"
  | "in_progress"
  | "completed"
  | "deferred"
  | "replaced"
  | "canceled";

interface CEOFocusItem {
  id: string;
  date: string;
  rank: 1 | 2 | 3;
  source: CEOFocusItemSource;
  sourceRef: string | null;
  title: string;
  rationale: string;
  estimatedMinutes: number;
  requiredEnergy: 1 | 2 | 3 | 4 | 5;
  status: CEOFocusItemStatus;
  selectedAt: string;
  completedAt: string | null;
}
```

Selection criteria:

- CEO-only requirement
- Strategic leverage
- Company dependency pressure
- Deadline proximity
- Commitment risk
- Fit with today's CEO state
- Current operating mode
- Remaining attention budget
- Available calendar blocks
- Negative Space Rules
- Recent deferral history

### CEO Mission

A **CEO Mission** is meaningful CEO-only work that has material company impact and no existing owner.

CEO Missions are generated from company-state gaps, repeated agent questions, inconsistent strategic answers, external requests, or inbox patterns.

```typescript
type CEOMissionStatus =
  | "candidate"
  | "accepted"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "rejected"
  | "archived";

interface CEOMission {
  id: string;
  title: string;
  summary: string;
  status: CEOMissionStatus;
  originSignalIds: string[];
  rationale: string;
  expectedImpact: string;
  estimatedMinutes: number;
  suggestedScheduleAt: string | null;
  workspaceId: string | null;
  relatedDirectionIds: string[];
  relatedTaskIds: string[];
  createdAt: string;
  resolvedAt: string | null;
}
```

CEO Missions must not auto-create company tasks. The CEO must accept the mission first. If the mission produces work for agents, it enters the normal planning flow.

### Commitment

A **Commitment** is a promise, deadline, follow-up, or obligation attributed to the CEO.

Commitments can be explicit or inferred from email, chat, meetings, and CEO workspace text.

```typescript
type CommitmentStatus =
  | "open"
  | "scheduled"
  | "completed"
  | "missed"
  | "renegotiated"
  | "canceled";

interface Commitment {
  id: string;
  title: string;
  description: string;
  counterparty: string | null;
  dueAt: string | null;
  source: AttentionSource;
  sourceRef: string | null;
  confidence: number;
  status: CommitmentStatus;
  privateToCeo: boolean;
  createdAt: string;
  closedAt: string | null;
}
```

Low-confidence commitments must be shown as proposed commitments before they become active accountability items.

### Decision Log Entry

A **Decision Log Entry** captures a significant CEO judgment call.

It is not a generic note. It must preserve the reasoning that made the decision valid at the time.

```typescript
type DecisionStatus =
  | "active"
  | "revisited"
  | "reversed"
  | "superseded"
  | "archived";

interface DecisionLogEntry {
  id: string;
  title: string;
  decision: string;
  rationale: string;
  alternativesRejected: string[];
  expectedOutcome: string | null;
  scope: "personal" | "company" | "strategic" | "hiring" | "product" | "finance" | "marketing" | "operations";
  sourceRefs: string[];
  privateToCeo: boolean;
  status: DecisionStatus;
  decidedAt: string;
  revisitAt: string | null;
  supersededById: string | null;
}
```

Decision entries must support future prompts such as "this decision is 90 days old and the outcome changed."

### Decision Outcome Review

A **Decision Outcome Review** captures what happened after a significant decision.

```typescript
type DecisionOutcomeStatus =
  | "worked"
  | "failed"
  | "mixed"
  | "unclear"
  | "too_early";

interface DecisionOutcomeReview {
  id: string;
  decisionId: string;
  expectedOutcome: string;
  actualOutcome: string;
  status: DecisionOutcomeStatus;
  lessons: string[];
  patternObservations: string[];
  reviewedAt: string;
  nextReviewAt: string | null;
}
```

Outcome reviews must not grade the CEO. They exist to improve future judgment by making decision patterns visible.

### CEO State

**CEO State** is the system's estimate of today's operating capacity.

It is used only to shape workload, interruption thresholds, and decision-safety prompts. It must not become a moral judgment or performance score.

```typescript
interface CEOStateSnapshot {
  id: string;
  date: string;
  explicitRating: 1 | 2 | 3 | 4 | 5 | null;
  inferredRating: 1 | 2 | 3 | 4 | 5 | null;
  signals: string[];
  confidence: number;
  notes: string | null;
  createdAt: string;
}
```

Inferred CEO state should be conservative. The system may adjust workload quietly, but explicit claims about stress, fatigue, or readiness should require high confidence and careful language.

### Personal Model Observation

A **Personal Model Observation** records a behavioral pattern Tamir learns about the CEO.

Examples:

- Approves faster before noon
- Defers finance decisions after meeting-heavy days
- Produces better strategy documents after protected blocks
- Repeatedly delays a specific category of work

```typescript
interface PersonalModelObservation {
  id: string;
  pattern: string;
  evidenceRefs: string[];
  confidence: number;
  lastObservedAt: string;
  active: boolean;
  privateToCeo: true;
}
```

These observations must remain private to CEO Space unless the CEO explicitly promotes a derived output into company space.

### Relationship Asset

A **Relationship Asset** represents an important person whose trust, context, commitments, and communication rhythm matter to the CEO or company.

```typescript
type RelationshipType =
  | "investor"
  | "candidate"
  | "advisor"
  | "customer"
  | "partner"
  | "team"
  | "other";

type RelationshipTemperature =
  | "strong"
  | "stable"
  | "cooling"
  | "at_risk"
  | "unknown";

interface RelationshipAsset {
  id: string;
  name: string;
  type: RelationshipType;
  organization: string | null;
  strategicRelevance: string | null;
  lastMeaningfulContactAt: string | null;
  expectedCadenceDays: number | null;
  temperature: RelationshipTemperature;
  openCommitmentIds: string[];
  relatedDecisionIds: string[];
  sourceRefs: string[];
  privateToCeo: true;
  updatedAt: string;
}
```

Relationship Assets are private to CEO Space unless a specific follow-up or artifact is promoted.

### Taste Standard

A **Taste Standard** records the CEO's quality bar for writing, design, product judgment, narrative, or other subjective work.

```typescript
type TasteDomain =
  | "writing"
  | "design"
  | "product"
  | "brand"
  | "investor_narrative"
  | "hiring"
  | "general";

interface TasteStandard {
  id: string;
  domain: TasteDomain;
  principle: string;
  positiveExamples: string[];
  negativeExamples: string[];
  confidence: number;
  privateToCeo: true;
  updatedAt: string;
}
```

Taste Standards are used to pre-filter work before it reaches the CEO. They must remain correctable by the CEO.

### Negative Space Rule

A **Negative Space Rule** describes work that should not be scheduled in certain conditions.

```typescript
interface NegativeSpaceRule {
  id: string;
  title: string;
  condition: string;
  prohibitedWorkType: string;
  rationale: string;
  confidence: number;
  active: boolean;
  privateToCeo: true;
}
```

Examples: no hard decisions after back-to-back meetings, no investor prep in 30-minute gaps, no strategic thinking between operational calls.

### Anti-Busyness Insight

An **Anti-Busyness Insight** identifies when visible activity is displacing high-leverage CEO work.

```typescript
type AntiBusynessSignal =
  | "three_displaced"
  | "strategic_block_consumed"
  | "delegatable_work_done_by_ceo"
  | "meeting_load_high"
  | "approval_cleared_but_mission_stalled"
  | "decision_throughput_low";

interface AntiBusynessInsight {
  id: string;
  date: string;
  signals: AntiBusynessSignal[];
  summary: string;
  recommendedCorrection: string;
  createdAt: string;
}
```

## Attention Shield Policy

The Attention Shield is the central policy layer. It decides what reaches the CEO.

### Inputs

The shield evaluates:

- Normalized Attention Signal
- Current attention budget
- Current CEO operating mode
- Current CEO calendar
- Current focus block
- The Three
- Open Judgment Queue Items
- Accepted CEO Missions
- Open commitments
- Relationship Assets
- Active company escalations
- Company task dependencies
- CEO state snapshot
- Personal model observations
- Taste Standards, when the signal concerns quality or approval
- Negative Space Rules
- Source-level user preferences

### Decision Actions

| Action | Meaning | CEO-visible timing |
|--------|---------|--------------------|
| `interrupt_now` | Break focus immediately | Immediate notification |
| `bundle_later` | Save for next brief or review | Morning, midday, evening, weekly, or ad hoc brief |
| `delegate_or_route` | Send to an agent, department head, or existing mission | Optional confirmation unless policy allows auto-route |
| `suppress` | Hide as noise or duplicate | Audit log only |

### Scoring Rules

Scores are normalized from 0 to 1.

- **Urgency** -- how soon action is required
- **Strategic importance** -- how much the signal affects company direction
- **CEO-only requirement** -- whether the CEO is uniquely needed
- **Judgment requirement** -- whether the CEO's taste, authority, risk tolerance, or relationship context is required
- **Relationship trust impact** -- whether delay or mishandling damages an important relationship
- **Downstream risk** -- how much delay blocks agents, deadlines, or external commitments
- **Reversibility** -- whether waiting can be repaired later
- **Interruption cost** -- cost of breaking current focus based on calendar, focus block, and CEO state
- **Attention budget impact** -- how expensive this interruption is relative to the day's remaining budget
- **Current focus conflict** -- whether the signal undermines today's selected focus
- **Confidence** -- confidence in extraction and interpretation

Recommended initial policy:

```typescript
const shouldInterrupt =
  confidence >= 0.7 &&
  (ceoOnlyRequirement >= 0.65 || judgmentRequirement >= 0.7) &&
  (
    urgency >= 0.75 ||
    downstreamRisk >= 0.75 ||
    strategicImportance >= 0.85 ||
    relationshipTrustImpact >= 0.8
  ) &&
  interruptionCost < 0.75 &&
  attentionBudgetImpact <= remainingBudgetTolerance;
```

This formula is not final product logic. It establishes the required shape: interruption must be justified by importance, CEO-only need, confidence, and low enough interruption cost.

### Judgment Queue Rule

If a signal requires CEO judgment but does not require immediate interruption, it should become a Judgment Queue Item.

Judgment Queue Items must include:

- Why the CEO is seeing it
- Why now
- What happens if ignored
- Suggested action

The queue is not a task list. It is a filtered set of judgment calls that survived routing, batching, and suppression.

### Attention Budget Rule

The Attention Shield must consult the current Attention Budget before interrupting.

Rules:

- Critical risk may exceed the budget, but must be marked as budget override.
- Deep Work and Recovery modes lower the budget and raise thresholds.
- Crisis mode raises budget only for crisis-relevant categories.
- Board / Investor mode raises priority for finance, investor, narrative, metrics, and deadline signals.
- Hiring mode raises priority for candidates, references, compensation, and org-design signals.
- When budget is nearly exhausted, Tamir should prefer bundling, routing, and suppression.

### Audit Rule

Every Attention Signal must produce an Attention Decision.

The CEO must be able to open a review surface showing:

- What was interrupted
- What was bundled
- What was delegated or routed
- What was suppressed
- Why Tamir made each decision
- How to correct the policy

Suppression without auditability is not allowed.

### Correction Loop

Every attention decision must support feedback:

- **More like this** -- increase priority for similar signals
- **Less like this** -- reduce priority for similar signals
- **Always interrupt** -- promote source or category
- **Never interrupt** -- demote source or category
- **Wrong interpretation** -- correct extracted meaning
- **Should have routed** -- teach delegation preference

Corrections update source preferences and the personal model.

## Privacy Boundary

The Executive Assistant system handles more sensitive data than company execution. Privacy rules must be explicit.

### Spaces

- **Company Space** -- agents, tasks, deliverables, escalations, budgets, departments, and company memory
- **CEO Space** -- inbox signals, calendar, personal state, commitments, decision log, The Three, CEO Missions, personal model, and CEO workspace

The same Tamir can operate in both spaces. Data visibility is not symmetrical.

### Default Rule

CEO Space data is private by default.

Company agents must not read raw CEO inbox content, CEO state snapshots, personal model observations, private commitments, private decision logs, or suppressed signals.

### Crossing Into Company Space

CEO Space data can cross into Company Space only through explicit promotion.

Allowed promotions:

- CEO approves a CEO Mission becoming a company task
- CEO sends a strategy memo into a department plan
- CEO converts a canvas output into a mission brief
- CEO shares a decision as company direction
- CEO delegates a non-private request to an agent

Promotion must create a redacted company-visible artifact. The artifact should contain only what agents need.

### Redaction Requirements

When promoting CEO Space content, the system must remove:

- Raw email bodies unless explicitly included
- Private personal state
- Health-adjacent or energy signals
- Personal model observations
- Suppressed signal history
- Private counterparties not required for execution
- Sensitive rationale not needed by agents

### Source Permissions

Each source must support:

- Connected or disconnected state
- Read scope
- Write scope, if any
- Sync frequency
- Retention policy
- Last sync timestamp
- Error state
- Revocation

The CEO must be able to disconnect a source and delete derived records from that source.

## Processing Pipeline

The system should process signals in this order:

1. **Ingest** -- pull raw events from connected sources and company state
2. **Normalize** -- convert raw events into Attention Signals
3. **Extract** -- identify commitments, decisions, opportunities, blockers, and relationships
4. **Relate** -- connect signals to company tasks, agents, calendar, decisions, and commitments
5. **Mode** -- apply the current CEO operating mode and attention budget
6. **Score** -- compute attention, judgment, relationship, and interruption scores
7. **Decide** -- apply the Attention Shield policy
8. **Queue** -- create Judgment Queue Items when CEO judgment is needed but interruption is not
9. **Act** -- interrupt, bundle, delegate, or suppress
10. **Record** -- store signal, decision, queue item, and action
11. **Learn** -- incorporate CEO feedback, outcome reviews, and taste corrections

Pipeline stages must be idempotent. Reprocessing the same source event must not create duplicate commitments, decisions, or alerts.

## User Controls

The CEO must have direct control over how much authority Tamir has in CEO Space.

### CEO Operating Modes

| Mode | Behavior |
|------|----------|
| **Standard** | Interrupt only for high-confidence, high-impact CEO-only items |
| **Deep Work** | Almost nothing gets through; only severe downstream risk, hard deadlines, or explicit alarms interrupt |
| **Board / Investor** | Finance, investor, narrative, metrics, and deadline signals rise in priority |
| **Hiring** | Candidate, compensation, org-design, reference, and leadership signals rise in priority |
| **Crisis** | Relevant signals surface faster; unrelated signals are suppressed harder |
| **Recovery** | Short briefs, fewer decisions, more deferral, and stronger calendar protection |

### Attention Budget Controls

The CEO can configure:

- Daily interruption limit
- Judgment prompt limit
- Mode-specific budgets
- Critical categories allowed to override the budget
- Whether unused budget carries into later parts of the day

Tamir may suggest budget changes, but the CEO remains in control.

### Source Controls

For each source, the CEO can configure:

- Include in attention shield
- Include in briefs
- Allow commitment extraction
- Allow CEO Mission generation
- Allow proactive outreach
- Allow auto-routing
- Retention period

### Category Controls

The CEO can tune categories:

- Investor communications
- Board items
- Hiring
- Customer escalations
- Product decisions
- Finance and runway
- Personal commitments
- Relationship maintenance
- Market intelligence
- Agent blockers
- Quality and taste review

Each category can be set to interrupt, brief, route, or suppress by default.

### Taste and Relationship Controls

The CEO can:

- Mark people as key relationships
- Set expected relationship cadence
- Correct relationship temperature
- Add positive and negative quality examples
- Mark a deliverable as below standard
- Promote or demote taste rules
- Disable taste pre-filtering for a domain

## UI Surfaces

### CEO Home

The CEO Home is the default `/executive-assistant` surface.

Required sections:

- Morning or current brief
- Judgment Queue
- The Three
- Interruptions requiring action
- Attention budget remaining
- Current operating mode
- Open CEO Missions
- Commitments due soon
- Decision revisit prompts
- Decision outcome review prompts
- Key relationship prompts
- Anti-busyness insight
- Protected strategic blocks
- Attention Shield summary

### Judgment Queue

This surface shows the CEO-only judgment calls that survived filtering.

Each item shows:

- Why you are seeing this
- Why now
- If ignored
- Suggested action
- Source trace

Actions:

- Decide
- Delegate
- Defer
- Reject
- Open workspace
- Promote to company task or direction

### Attention Shield Review

This surface shows what Tamir filtered.

Required tabs:

- Interrupted
- Bundled
- Delegated
- Suppressed

Each row shows:

- Signal title
- Source
- Decision action
- Reason
- Scores
- Feedback controls

### CEO Mission Inbox

This surface shows CEO Mission candidates and active missions.

Actions:

- Accept
- Reject
- Ask why
- Schedule
- Convert to workspace
- Convert to company task
- Archive

### Decision Log

The Decision Log must support:

- Search
- Filter by scope
- View rationale and rejected alternatives
- View related tasks, missions, and documents
- Mark revisited
- Add outcome review
- Reverse or supersede
- Promote to company direction

### Commitment Ledger

The Commitment Ledger must support:

- Open commitments
- Due soon
- Overdue
- Completed
- Renegotiated
- Source trace
- Confidence review

### CEO Workspace

The CEO Workspace supports writing, planning, analysis, and deliverable production.

Required capabilities:

- Canvas documents
- Tamir side panel
- Insert company data
- Fact-check against company state
- Convert output to CEO Mission
- Convert output to company task
- Link output to Decision Log
- Apply Taste Standards before CEO review
- Record CEO quality feedback
- Export or share final artifact

### Relationships

The Relationships surface must support:

- Key relationship list
- Relationship temperature
- Last meaningful contact
- Open commitments
- Expected cadence
- Source trace
- Suggested follow-up
- Promote follow-up to company task

### Taste and Standards

The Taste and Standards surface must support:

- Quality principles by domain
- Positive examples
- Negative examples
- Corrections from CEO feedback
- Domains where pre-filtering is active
- Audit trail for quality-based routing decisions

## Core Workflows

### Morning Brief

1. Pull overnight company and CEO-space signals.
2. Apply current CEO operating mode and attention budget.
3. Score all open signals through the Attention Shield.
4. Create or update Judgment Queue Items.
5. Select The Three.
6. Surface urgent commitments, decision prompts, relationship prompts, and outcome reviews.
7. Bundle non-urgent meaningful items.
8. Show suppressed count with review link.

Output:

- Today state
- Operating mode
- Attention budget remaining
- The Three
- Judgment Queue summary
- One-line company state
- CEO-only decisions
- Commitment risks
- Relationship risks
- Mission candidates
- Anti-busyness warning, when relevant
- Suggested schedule changes

### Judgment Queue Surfacing

1. Signal or derived item requires CEO judgment.
2. System verifies it does not need immediate interruption.
3. System creates a Judgment Queue Item with `whySeeingThis`, `whyNow`, `ifIgnored`, and `suggestedAction`.
4. Item appears in CEO Home or the next brief.
5. CEO acts, delegates, defers, rejects, or opens a workspace.
6. Feedback updates the Attention Shield and personal model.

### Interruption

1. Signal arrives.
2. Shield scores it.
3. System checks operating mode and attention budget.
4. If interruption threshold passes, Tamir interrupts with concise context.
5. CEO can act, defer, delegate, or mark wrong.
6. Decision, budget spend, and feedback are stored.

Interruption copy must be short and specific. It must explain why this matters, why it needs the CEO, and why it cannot wait.

### CEO Mission Generation

1. Detect repeated gap, inconsistency, or CEO-only unresolved work.
2. Create CEOMission in `candidate` state.
3. Attach evidence signals.
4. Add impact and estimated time.
5. Surface in brief or mission inbox.
6. CEO accepts or rejects.
7. Accepted mission gets scheduled and workspace-created.

### Commitment Extraction

1. Detect commitment language from source event.
2. Extract counterparty, due date, action, and confidence.
3. If confidence is high, create open commitment.
4. If confidence is medium or low, ask CEO to confirm.
5. Track until completed, renegotiated, canceled, or missed.

### Decision Logging

1. Detect explicit decision or CEO confirms a decision prompt.
2. Capture decision, rationale, alternatives, expected outcome, and source references.
3. Ask for missing rationale when needed.
4. Set optional revisit date.
5. Use future context changes to prompt revisit.

### Decision Outcome Review

1. Decision reaches revisit date or relevant context changes.
2. System gathers expected outcome, actual outcome, and related metrics or signals.
3. Tamir proposes an outcome review.
4. CEO confirms or edits the review.
5. System records lessons and pattern observations.
6. Future decision prompts can cite the pattern.

### Operating Mode Change

1. CEO manually selects a mode or Tamir suggests one.
2. System updates interruption thresholds, attention budget, brief length, and scheduling rules.
3. Mode applies until manually changed or until its end time.
4. Privacy boundaries remain unchanged.

### Relationship Maintenance

1. Source signals update relationship context.
2. System detects trust decay, open commitment, or timely follow-up opportunity.
3. Attention Shield decides whether to suppress, brief, queue, or interrupt.
4. If queued, the item explains why the relationship matters and why now.
5. CEO can follow up, delegate, or dismiss.

### Taste Pre-Filter

1. Deliverable or CEO-facing artifact is ready for review.
2. System evaluates it against relevant Taste Standards.
3. If below standard and not CEO-ambiguous, route back for revision.
4. If quality requires CEO taste or authority, create Judgment Queue Item.
5. If high quality and low risk, bundle or surface normally.

### Anti-Busyness Review

1. System compares completed activity against The Three, CEO Missions, strategic blocks, and decision throughput.
2. If low-leverage activity displaced high-leverage work, create Anti-Busyness Insight.
3. Surface in evening or weekly review.
4. Suggest a scheduling or shield-policy correction.

### Promotion to Company Space

1. CEO selects a CEO-space artifact.
2. System proposes a redacted company-visible version.
3. CEO reviews and approves.
4. System creates company task, direction, mission brief, or department objective.
5. Company agents receive only the approved artifact.

## Storage Requirements

The implementation should persist:

- Attention signals
- Attention decisions
- Judgment Queue Items
- Attention budgets
- CEO operating mode states
- CEO briefs
- CEO focus items
- CEO Missions
- Commitments
- Decision log entries
- Decision outcome reviews
- CEO state snapshots
- Personal model observations
- Relationship Assets
- Taste Standards
- Negative Space Rules
- Anti-Busyness Insights
- Source permission settings
- Attention feedback events

All records need:

- Stable IDs
- Created and updated timestamps
- Source references where applicable
- `privateToCeo` flag where applicable
- Deletion or archival path

## API Requirements

Minimum API surface:

```typescript
GET /api/ceo/brief/today
POST /api/ceo/brief/generate

GET /api/ceo/attention/signals
POST /api/ceo/attention/:decisionId/feedback

GET /api/ceo/judgment-queue
POST /api/ceo/judgment-queue/:itemId/action

GET /api/ceo/attention-budget/today
POST /api/ceo/attention-budget/today

GET /api/ceo/focus/today
POST /api/ceo/focus/:itemId/status

GET /api/ceo/mode
POST /api/ceo/mode

GET /api/ceo/missions
POST /api/ceo/missions/:missionId/accept
POST /api/ceo/missions/:missionId/reject
POST /api/ceo/missions/:missionId/promote

GET /api/ceo/commitments
POST /api/ceo/commitments/:commitmentId/status

GET /api/ceo/decisions
POST /api/ceo/decisions
POST /api/ceo/decisions/:decisionId/revisit
POST /api/ceo/decisions/:decisionId/outcome-review

GET /api/ceo/relationships
POST /api/ceo/relationships/:relationshipId

GET /api/ceo/taste-standards
POST /api/ceo/taste-standards
POST /api/ceo/taste-standards/:standardId/feedback

GET /api/ceo/anti-busyness

GET /api/ceo/sources
POST /api/ceo/sources/:sourceId/settings
DELETE /api/ceo/sources/:sourceId
```

All endpoints must enforce CEO-private authorization. Company agents must not be able to call CEO-space APIs unless a specific promotion artifact grants access.

## Agent Behavior Requirements

Tamir in Executive Assistant mode must:

- Use structured output for classifications and decisions
- Cite source references internally for every generated claim
- Distinguish facts from inferences
- Ask for confirmation when confidence is low
- Avoid exposing private CEO-space data to company agents
- Explain interruptions in one or two sentences: why it matters, why it needs the CEO, and why it cannot wait
- Create Judgment Queue Items instead of interrupting when judgment is needed but urgency is lower
- Respect the current attention budget and operating mode
- Use Taste Standards to route low-quality work back before CEO review when appropriate
- Treat relationship trust as a first-class signal
- Prefer bundling over interrupting when urgency is uncertain
- Keep an audit trail for suppressions and routing

Tamir must not:

- Silently create company tasks from private CEO data
- Let agents read raw inbox or personal model data
- Make health or psychological claims with low confidence
- Suppress without recording why
- Treat inferred commitments as confirmed when confidence is low
- Interrupt because an item is merely interesting
- Spend attention budget on items that could be routed, bundled, or suppressed
- Expose relationship intelligence or taste standards to company agents without promotion
- Treat outcome reviews as CEO performance grades

## Failure Modes

### Missed Urgent Item

Risk: Tamir suppresses or bundles something that required immediate attention.

Mitigation:

- Conservative thresholds for high-risk categories
- Suppressed-review surface
- Feedback loop
- Source-specific override rules
- Daily "high-risk suppressed" audit check

### Over-Interruption

Risk: Tamir becomes another noisy assistant.

Mitigation:

- Interruption cost score
- Deep Work mode
- Brief-first policy
- Per-category tuning
- Track interruption acceptance rate

### Privacy Leak

Risk: private CEO context reaches agents or company memory.

Mitigation:

- Private-by-default data model
- Explicit promotion workflow
- Redaction preview
- API authorization boundary
- Audit log for promotions

### Wrong Commitment Extraction

Risk: Tamir logs a promise the CEO did not make.

Mitigation:

- Confidence thresholds
- Confirmation queue
- Source trace
- Easy correction

### Bad Personal Inference

Risk: Tamir misreads stress, avoidance, or energy.

Mitigation:

- Conservative language
- Explicit rating beats inferred rating
- Private observations only
- Correction controls

### Company Routing Mistake

Risk: Tamir routes an item away from the CEO when CEO judgment was needed.

Mitigation:

- CEO-only requirement scoring
- Auditability
- Route confirmation for sensitive categories
- Department-head rejection path back to CEO

### Attention Budget Misuse

Risk: Tamir spends the day's interruption budget on lower-value items, causing important later signals to wait.

Mitigation:

- Critical override path
- Budget spend audit
- Mode-specific category priorities
- Evening budget review
- CEO correction controls

### Bad Taste Filter

Risk: Tamir routes work back for revision even though the CEO wanted to review it, or surfaces low-quality work too often.

Mitigation:

- Taste Standards remain correctable
- Quality-based routing has an audit trail
- Low-confidence quality judgments create Judgment Queue Items instead of auto-routing
- CEO can disable pre-filtering per domain

### Relationship Misread

Risk: Tamir overstates relationship decay or suggests unnecessary outreach.

Mitigation:

- Relationship temperature is visible and correctable
- Cadence can be user-set
- Relationship prompts prefer brief or queue over interruption unless trust impact is high
- Source trace is required

### Anti-Busyness Overreach

Risk: Tamir frames normal operational work as fake productivity.

Mitigation:

- Anti-Busyness Insights appear in reviews, not as constant interruptions
- CEO can mark operational work as intentionally high-leverage
- Insights must cite displaced work, not just volume of activity

## Metrics

The system should track:

- Interruption count per day
- Interruption acceptance rate
- Attention budget spent
- Budget override count
- Judgment Queue size
- Judgment Queue action rate
- Suppressed signal count
- Suppressed signal correction rate
- Brief open rate
- The Three completion rate
- CEO Mission acceptance rate
- Commitment capture accuracy
- Missed commitment count
- Decision revisit completion
- Decision outcome review completion
- Agent wait time caused by CEO
- Approval latency
- Strategic block protection rate
- Strategic block violation rate
- Relationship decay prompts accepted
- Taste pre-filter correction rate
- Anti-busyness insight acceptance rate

Metrics are for product quality and CEO feedback. They must not become a punitive score.

## MVP Scope

### Phase 1: Local CEO Space

Build:

- CEO Home
- Manual CEO state check-in
- Standard and Deep Work operating modes
- Basic attention budget
- Judgment Queue
- The Three
- Manual and company-derived CEO Missions
- Decision Log
- Decision outcome review notes
- Commitment Ledger
- Attention Shield audit model
- Basic Anti-Busyness review

No external email or calendar ingestion required in this phase.

### Phase 2: Company-State Integration

Add:

- Agent blocker signals
- Deliverable-ready signals
- Escalation signals
- Approval latency tracking
- Bottleneck Mirror
- Mission generation from company gaps
- Judgment Queue items from company blockers
- Taste Standards for deliverable review

### Phase 3: Calendar Integration

Add:

- Calendar read access
- Schedule-aware The Three
- Protected strategic blocks
- Deadline convergence
- Full operating modes
- Negative Space Rules
- Attention budget changes by mode

### Phase 4: Inbox Integration

Add:

- Email read access
- Commitment extraction
- Relationship signals
- Relationship Assets
- Inbox-derived CEO Missions
- Meeting-context briefs

### Phase 5: Proactive Outreach

Add:

- Interruption engine
- Push or external channel delivery
- Source and category tuning
- Active learning from feedback
- Relationship maintenance prompts
- Taste pre-filtering from CEO corrections

Proactive outreach should not ship before the Attention Shield audit model is working.

## Open Questions

- Should CEO Space use the same SQLite database with private flags or a separate private store?
- Should personal model observations be encrypted separately from company data?
- What is the first supported external source: calendar or email?
- Should Tamir be allowed to auto-route low-risk items without confirmation?
- What is the minimum confidence threshold for commitment creation?
- How should the system represent "CEO-only" work that later becomes delegatable?
- Should The Three be fixed each morning or dynamically replaceable during the day?
- How much suppressed-signal detail should be visible by default?
- What retention policy should apply to raw source references?
- What should the default attention budget be for each operating mode?
- Should Judgment Queue Items expire, roll over, or require explicit dismissal?
- How should Taste Standards be seeded before enough CEO feedback exists?
- Should Relationship Assets be created automatically or only after CEO confirmation?
- What is the safest first domain for taste pre-filtering: writing, design, or deliverable review?
- How much anti-busyness feedback is helpful before it becomes annoying?

## Implementation Rule

Do not build the Executive Assistant as a notification layer first.

Build the private data boundary, Attention Shield audit trail, Judgment Queue, basic attention budget, The Three, and Decision Log first. Proactive outreach only becomes valuable after the system can prove what it filtered, why it interrupted, how much attention it spent, and how the CEO can correct it.
