# 20 -- Command Layer Requirements

## Purpose

This document translates the article "The Game That Was Always There" into product and system requirements for Cortex.

It is not an implementation plan. It does not prescribe which files to edit, which modules to create, or what the database schema should look like. Those choices belong to the implementation phase.

The goal here is to answer a different question:

```text
If we believe the article, what capabilities must Cortex gain?
```

The article argues that running a company is already structurally similar to a strategy game:

- the world changes while the CEO is away
- resources are scarce
- decisions have trade-offs
- information is incomplete
- consequences matter
- capability compounds over time

The product requirement is not to "gamify" work. The requirement is to make those real structures visible and usable inside Cortex.

---

## Core Product Shift

Today, most business tools ask:

```text
What tasks need to be completed?
```

The Command Layer should ask:

```text
What is happening in the company, what matters now, and what move should the CEO make?
```

This changes the role of Cortex from an execution dashboard into a command surface.

The CEO should not experience Cortex as a list of things to clear. They should experience it as a live operating map:

- what changed
- what is under pressure
- what is uncertain
- what choices are available
- what each choice costs
- what past decisions caused
- what the company is becoming more capable of doing

---

## Non-Negotiable Product Principles

### 1. No Gamification

Cortex should not add points, badges, streaks, leaderboards, or fake celebrations.

The article is explicit: the product is compelling because it reveals real strategy, not because it adds artificial rewards.

Requirement:

- reward loops must come from clarity, consequence, and capability growth
- the UI should never reward activity for its own sake
- the system should measure judgment and impact, not task volume

### 2. The World Must Move

The system should not feel frozen between sessions.

When the CEO returns, Cortex should be able to answer:

- what changed since the last session
- which situations improved
- which situations deteriorated
- which opportunities are opening
- which windows are closing
- which decisions now need attention

Requirement:

- Cortex needs a concept of company state that changes over time
- changes should be summarized into meaningful situations, not dumped as raw events
- the CEO should feel that the company continued operating while they were away

### 3. Uncertainty Must Be Honest

The system must distinguish between:

- what it knows
- what it suspects
- what it does not know

Requirement:

- every major situation, recommendation, theater, and capability assessment should carry a confidence level
- areas with insufficient evidence should be shown as dark or unknown
- missing data must not be presented as neutral, healthy, or stable

### 4. Scarcity Must Be Visible

Real CEO decisions exist because resources are limited.

Requirement:

- the system must expose constraints around attention, team capacity, capital, timing, and organizational trust
- decisions should show what resource they consume
- collisions between good options should be visible

### 5. Consequences Must Close the Loop

A decision is not complete when it is made. It is complete when the system learns what happened afterward.

Requirement:

- important decisions should have expected outcomes
- the system should revisit decisions later and compare expected vs actual results
- consequence review should feed future recommendations and institutional memory

---

## Capability Map

The table below maps the article's abstract concepts into concrete capabilities Cortex needs.

| Article Concept | Capability Cortex Needs | Product Outcome |
| --- | --- | --- |
| The company is a living world | Company-state awareness | Cortex can summarize what changed without being asked |
| There is always a move | Mission generation | Cortex continuously generates meaningful CEO moves from company state |
| Strategy games generate quests | Command mission queue | The CEO opens Cortex and sees real missions waiting, not a blank task board |
| Scarcity drives decisions | Resource pressure visibility | Choices show what they consume and what they delay |
| Decisions have trade-offs | Decision cards | The CEO sees options, upside, downside, risk, confidence, and ignored cost |
| Fog of war exists | Confidence and unknown-state modeling | The system shows dark/uncertain zones honestly |
| Recon matters | Information-gathering actions | The CEO can choose to reduce uncertainty before deciding |
| Campaigns are the long game | Multi-step strategic operations | Cortex tracks operations over weeks, not just tasks over hours |
| The world responds | Consequence tracking | Past decisions are reviewed against outcomes |
| Companies mature | Progression model | Cortex shows how the operating system becomes more capable |
| Skills are organizational capabilities | Evidence-based skill tree | The system shows what the company has proven it can do |
| Tamir is a game master | World interpretation | Tamir synthesizes signals into meaningful command context |

---

## Requirement 1: Company as a Living World

### Concept

The article says the company should not appear as a static task list. It should appear as a world with state.

That means Cortex needs to understand the company as a changing system with multiple areas of operation, each with its own health, momentum, risks, and unknowns.

### Capability Required

Cortex needs a live company-state model.

This model should answer:

- what changed recently
- where momentum increased or decreased
- where risk is rising
- where an opportunity appeared
- what became more or less certain
- what now requires CEO judgment

### UX Implications

The home surface should begin with a situation report, not a task board.

The CEO should see:

- a short "since you were last here" summary
- the most important changes
- the areas of the company that need attention
- which areas are clear, uncertain, or dark

The experience should feel like opening a live map.

### Backend and Logic Implications

The system needs to collect signals from existing activity and turn them into a coherent company-state summary.

Signals may come from:

- task progress
- deliverables
- escalations
- asset changes
- routines
- agent activity
- future integrations such as calendar, CRM, support, finance, and market data

The logic should group related signals into meaningful company-state changes.

### Acceptance Signals

This requirement is met when:

- the CEO can open Cortex after time away and immediately see what changed
- the system can explain why something is now more important than before
- raw activity is grouped into meaningful state changes
- areas with no evidence are shown as unknown, not silently ignored

---

## Requirement 2: Theaters of Operation

### Concept

The article describes the company as multiple theaters: sales, product, people, finance, operations, market, and so on.

The CEO cannot command the company well if everything is flattened into one list.

### Capability Required

Cortex needs theater-level awareness.

Initial theaters:

- Sales
- Product
- People
- Finance
- Operations
- Market
- Internal Capability

Each theater should have:

- current state
- momentum
- primary pressure
- primary opportunity
- confidence level
- evidence freshness

### UX Implications

The UI should give the CEO a fast read of the company by theater.

Each theater should answer:

- is this area healthy, strained, improving, or deteriorating?
- how confident is Cortex in that assessment?
- what is the most important situation in this theater?
- what does the CEO need to decide or watch?

Some theaters should be visibly dark at first.

That is acceptable and important. A dark Sales theater is more honest than pretending the system understands sales without CRM data.

### Backend and Logic Implications

The system must classify signals into theaters and assess confidence based on evidence quality.

The logic should not require every theater to have the same data quality.

Each theater should support:

- measured state when data exists
- estimated state when data is partial
- qualitative state when Tamir is synthesizing weak signals
- dark state when evidence is insufficient

### Acceptance Signals

This requirement is met when:

- every major company area has a visible state
- weakly instrumented areas are marked uncertain or dark
- the CEO can see where the system is informed and where it is guessing
- theater states are based on evidence, not generic status labels

---

## Requirement 2A: Real Resource Layer

### Concept

The Command Layer should expose real company resources, not fake engagement scores.

Resources are the constraints that make strategy real: money, time, attention, capacity, trust, model budget, relationships, decision latency, confidence, and execution momentum.

The goal is not gamification. The goal is to make the real operating constraints of the company visible enough to affect decisions.

### Capability Required

Cortex should track and display resource state across the company.

Initial resources:

- cash runway
- mission budget
- model and tool spend
- CEO attention budget
- agent execution capacity
- human review capacity
- decision debt
- relationship health
- execution momentum
- confidence level by theater
- strategic windows
- trust in autonomy

Each resource should answer:

- current state
- trend
- source of truth
- confidence level
- evidence freshness
- which missions or theaters it affects
- what decision it should influence

### UX Implications

The CEO should see resources as operating facts, not decorative metrics.

Examples:

- "CEO attention: 2 high-judgment slots left today"
- "Model budget: 68% of weekly cap used"
- "Sales confidence: low, CRM not connected"
- "Review capacity: overloaded, 7 agent outputs waiting"
- "Decision debt: 5 unresolved calls older than 72 hours"
- "Runway: 8.5 months, deteriorating if hiring plan proceeds"

The command surface should show a resource only when it changes priority, timing, risk, confidence, allocation, or escalation.

### Backend and Logic Implications

Resources should be first-class objects.

Each resource should include:

- type
- current value
- unit
- trend
- source references
- confidence
- freshness
- affected theaters
- affected missions
- thresholds
- recommended action when constrained

Resource constraints should be available to mission generation, campaign planning, attention filtering, and decision cards.

For example, a mission may become higher priority because budget is being consumed faster than expected, review capacity is overloaded, or a strategic window is closing.

### Acceptance Signals

This requirement is met when:

- the CEO can see the real constraints behind company decisions
- resource changes affect mission ranking and decision recommendations
- low-confidence resources are labeled as uncertain or dark
- resource metrics cite their source of truth
- the interface does not show decorative numbers that do not change decisions

### Non-Negotiable Rule

```text
Measure only what changes decisions.
```

If a number does not affect what the CEO should do, it should not appear on the command surface.

---

## Requirement 3: Generated Command Missions

### Concept

The article says there is always a move.

In a strategy game, the player does not open the map and find an inert system. The world has moved. New threats appeared, opportunities opened, dependencies changed, resources became constrained, and prior choices created consequences.

Cortex needs the same property.

The system should generate meaningful missions for the CEO from the live state of the company. These missions are not fake quests, reminders, or gamified chores. They are real command opportunities produced by the state of the business.

This does not mean every notification becomes urgent. It means Cortex should identify real situations that require attention, judgment, monitoring, reconnaissance, or capability-building.

### Capability Required

Cortex needs mission-generation capability.

A generated mission is a structured command opportunity.

It may come from:

- something that happened
- something that is about to happen
- something the company failed to notice
- a resource collision
- a dark area that needs recon
- a capability gap
- a campaign that needs a move
- a decision whose consequences are now visible

A mission is not the same thing as a task. A task is execution work. A mission is something the CEO must decide, direct, investigate, or intentionally ignore.

Situation types:

- threat
- opportunity
- inflection point
- accountability trigger
- capability gap
- execution blocker

Mission classes:

- reactive
- strategic
- capability-building
- operational

The system should be able to generate missions even when no one manually created a task.

Examples:

- "Market theater is dark before pricing decision. Run recon."
- "Product campaign is on track, but its next phase needs CEO priority confirmation."
- "Three execution blockers share the same root cause: unclear planning handoff."
- "A capability gap is recurring: review throughput is limiting delivery speed."
- "A prior decision is due for consequence review."
- "A strategic window exists because a competitor delay reduced pressure."

### UX Implications

The home surface should have a command mission queue.

The CEO should open Cortex and see:

- missions generated by the system
- why each mission exists
- whether it is reactive, strategic, operational, or capability-building
- what action is available
- what happens if the CEO ignores it
- what confidence the system has

The queue should show generated missions and situations, not raw tasks.

Each situation should explain:

- what happened
- why it matters
- why now
- what theater it affects
- what evidence supports it
- how confident Cortex is
- what command action is available

The CEO should be able to:

- decide
- delegate
- monitor
- run recon
- start or adjust a campaign
- invest in a capability
- review a prior consequence
- link it to a campaign
- dismiss or resolve it with a reason

### Backend and Logic Implications

The system needs to transform company signals into generated CEO missions.

Mission generation should look across:

- active company state
- theater state
- task and execution blockers
- campaign progress
- decision review dates
- capability gaps
- confidence gaps
- changes since the last CEO session

The system needs to group raw signals into higher-level situations and then decide which of those situations should become CEO-facing missions.

It must prevent queue spam by:

- merging duplicate signals
- reopening old situations only when materially justified
- suppressing weak repeated alerts
- grouping related events under one situation
- separating operational blockers from strategic situations without hiding either
- ranking missions by leverage, not just urgency
- ensuring low-confidence missions become recon-first where appropriate

The system should also support non-urgent generated missions. Some of the most important missions will not be emergencies:

- build a missing capability
- clarify a dark theater
- review a strategic assumption
- start a campaign before a window closes
- revisit a past decision because conditions changed

### Acceptance Signals

This requirement is met when:

- Cortex generates missions without the CEO manually creating them
- the queue contains high-signal missions rather than raw event spam
- duplicate events do not create duplicate situations
- task approvals and blockers still surface when they block execution
- the CEO can understand why each mission exists
- the queue is useful even when nothing is urgent
- the queue includes capability-building and recon missions, not only reactive issues
- opening Cortex feels like returning to a live company map with moves waiting

---

## Engagement Model: Why The CEO Comes Back

### Concept

The system should be engaging because returning to Cortex gives the CEO leverage.

The goal is not to make the CEO addicted to activity. The goal is to make the CEO want to return because Cortex reliably answers:

- what changed?
- what matters now?
- what can I do that will move the company?
- what did my last move cause?
- what is the company becoming better at?

Engagement should come from clarity, consequence, and compounding capability.

### Core Return Loop

The core loop should be:

1. **Return**

The CEO opens Cortex and sees that the company moved while they were away.

2. **Read The Map**

Cortex shows the live state: changed theaters, new pressure, open windows, dark areas, active campaigns, and pending consequences.

3. **Choose A Mission**

The CEO sees a small set of high-leverage generated missions, not a large undifferentiated task list.

4. **Make A Move**

The CEO decides, delegates, starts recon, adjusts a campaign, invests in a capability, or explicitly defers.

5. **See Consequence**

Later, Cortex shows what changed because of the move.

6. **Feel Progression**

The CEO sees that the company became more capable, more autonomous, or more informed.

This loop is the strategic equivalent of a game loop. It repeats because the company keeps moving.

### Daily, Weekly, And Long-Term Hooks

The daily hook is curiosity:

- what changed while I was away?
- what is the best move now?
- what did yesterday's decision cause?

The weekly hook is mastery:

- which campaigns advanced?
- where did momentum build or erode?
- am I making better decisions?
- which recurring problems are still unresolved?

The long-term hook is identity:

- I am not just completing work
- I am building a company that can operate better without me
- my command decisions are turning into doctrine, capability, and autonomy

### Mission Quality Bar

Not every task should become a mission.

A mission is worth surfacing only if completing it changes company state in at least one meaningful way:

- reduces risk
- captures or protects an opportunity
- improves confidence
- unblocks execution
- advances a campaign
- builds an organizational capability
- reviews the consequence of a prior decision
- creates or updates doctrine
- improves future autonomy
- reveals a hidden constraint

If a generated item does not change company state, it should stay a task, notification, or background detail. It should not become a command mission.

### Mission Variety

The mission queue should not be only urgent problems.

It should include a healthy mix of:

- **Threat missions:** something will get worse if ignored
- **Opportunity missions:** a window is open now
- **Recon missions:** the map is too dark to decide safely
- **Unblock missions:** execution is stuck and needs CEO judgment
- **Campaign missions:** an active operation needs its next move
- **Capability missions:** the company needs to become better at a class of work
- **Consequence missions:** a prior decision is ready to be reviewed
- **Doctrine missions:** a repeated pattern may deserve a company rule

This variety matters because the CEO should not experience Cortex as a fire-fighting machine. The system should surface both urgent work and compounding work.

### Capability Missions Are The Deepest Engagement

The strongest long-term engagement comes from capability growth.

A task says:

```text
You solved this one thing.
```

A capability mission says:

```text
You made the company better at solving this class of thing forever.
```

Examples:

- Instead of only surfacing "approve this proposal," Cortex should notice if proposals repeatedly stall at pricing and generate a mission to clarify pricing doctrine.
- Instead of only surfacing "review failed task," Cortex should notice if failures repeat because specs are ambiguous and generate a mission to improve planning reliability.
- Instead of only surfacing "respond to sales issue," Cortex should notice if enterprise sales is founder-dependent and generate a mission to reduce CEO involvement.

The CEO returns because they are not just handling the present. They are building the company's future operating capacity.

### Anti-Patterns

Avoid:

- turning every task into a mission
- surfacing low-leverage busywork as command work
- creating fake urgency to increase engagement
- rewarding login frequency
- rewarding number of completed items
- hiding uncertainty to make the system feel more confident
- making the queue so full that the CEO cannot tell what matters
- making missions feel like reminders the CEO already knew about

The queue should feel curated by judgment, not inflated by activity.

### Acceptance Signals

This requirement is met when:

- the CEO wants to open Cortex to see what changed
- the mission queue is small enough to choose from but rich enough to feel alive
- completing a mission changes visible company state
- the system surfaces compounding capability work, not only urgent work
- the CEO can see consequences of prior moves
- repeated use makes the company feel more capable, not just more tracked

---

## Requirement 4: Scarcity and Resource Pressure

### Concept

The article says decisions become meaningful because resources are scarce.

If the system hides scarcity, decisions look easier than they are.

### Capability Required

Cortex needs resource-pressure awareness.

Important scarce resources:

- CEO attention
- team or agent capacity
- capital
- timing windows
- organizational trust

Not all of these can be measured precisely at first.

### UX Implications

Decision surfaces should show what a move consumes.

Examples:

- "This uses CTO attention for two weeks."
- "This delays the current product campaign."
- "This consumes budget that was reserved for marketing."
- "This requires CEO involvement during an already crowded week."
- "This spends organizational trust because it changes direction again."

The UI should show resource collisions directly when two good options compete for the same scarce resource.

### Backend and Logic Implications

The system needs a way to represent resource pressure with confidence.

Some resources can be measured now:

- budget spent
- active tasks
- blocked work
- review load
- agent workload

Some resources may start as estimates:

- CEO attention
- team fatigue
- organizational trust
- market timing windows

The system must label estimates as estimates.

### Acceptance Signals

This requirement is met when:

- decisions show the cost of each option
- resource conflicts are visible before the CEO chooses
- the system distinguishes measured pressure from estimated pressure
- no precise resource meter is shown without real evidence

---

## Requirement 5: Decision Cards

### Concept

The article says the CEO does not manage items. The CEO makes moves.

Important decisions need structure. A Slack-style question like "should we do X?" is not enough.

### Capability Required

Cortex needs structured decision cards.

Each decision card should include:

- situation
- why now
- options
- cost of each option
- upside of each option
- risk of each option
- confidence level
- consequence of ignoring it
- decision window
- expected review point

### UX Implications

Decision cards should feel like command moments.

The CEO should be able to:

- compare options side by side
- understand what each option sacrifices
- choose one option
- defer with a review date
- request recon before deciding
- convert the decision into a campaign or order

The card should not pretend Tamir can decide everything. Some choices require human judgment because they depend on values, risk tolerance, or strategic belief.

### Backend and Logic Implications

The system needs to preserve the decision context.

For meaningful later learning, Cortex must remember:

- what options were available
- which option was chosen
- why it was chosen
- what was expected to happen
- when the decision should be reviewed
- what actually happened later

### Acceptance Signals

This requirement is met when:

- a decision can be reviewed months later with its original trade-offs intact
- the CEO can see what was chosen and what was rejected
- decisions can produce orders, campaigns, recon, or deferral
- later consequence review can compare expected vs actual outcomes

---

## Requirement 6: Campaigns

### Concept

The article distinguishes between quick actions, decisions, and campaigns.

Campaigns are the long game: multi-step strategic operations that unfold over weeks.

### Capability Required

Cortex needs campaign capability.

A campaign should have:

- name
- objective
- theater
- owner
- phases
- current phase
- key moves
- dependencies
- success criteria
- blockers
- momentum
- review cadence
- resolution summary

Campaigns can be operational or capability-building.

### UX Implications

Campaigns should be persistent and visible.

The CEO should see:

- which campaigns are active
- whether each campaign is on track
- what phase each campaign is in
- what moved since the last review
- what decision is needed next
- whether the campaign is still worth continuing

Campaigns should not feel like a Gantt chart. They should feel like named operations.

### Backend and Logic Implications

The system needs to track campaign state separately from individual tasks.

Tasks may support a campaign, but completing tasks is not the same as winning the campaign.

Campaign progress should consider:

- phase completion
- objective evidence
- blockers
- decision outcomes
- external changes
- whether success criteria are becoming more or less likely

### Acceptance Signals

This requirement is met when:

- the CEO can understand an active campaign in under a minute
- a campaign can continue even after the original situation is resolved
- campaign progress is not reduced to task completion percentage
- every completed campaign produces a post-action review

---

## Requirement 7: Fog of War

### Concept

The article says business tools lie when they show a fully lit map.

Numbers can be stale, incomplete, misleading, or absent.

### Capability Required

Cortex needs confidence modeling.

Confidence zones:

- clear
- uncertain
- dark

These should apply to:

- theaters
- situations
- decision options
- campaigns
- skill assessments
- recommendations

### UX Implications

The UI should make uncertainty visible.

Examples:

- "Product delivery: clear. Based on current task and deliverable data."
- "Customer satisfaction: uncertain. Based on support sentiment only."
- "Competitor pricing: dark. No recent evidence."

Dark areas should not disappear. They should invite recon.

### Backend and Logic Implications

The system needs to evaluate evidence quality, not just evidence existence.

Confidence should consider:

- freshness
- source count
- source diversity
- source reliability
- contradiction
- directness of evidence
- whether the signal is measured or inferred

### Acceptance Signals

This requirement is met when:

- the CEO can distinguish knowns from guesses
- dark areas are visible
- recommendations become more cautious when confidence is low
- major decisions can trigger recon instead of forcing premature choice

---

## Requirement 8: Reconnaissance

### Concept

The article treats scouting as a first-class command action.

Sometimes the best move is not deciding. It is reducing uncertainty.

### Capability Required

Cortex needs recon actions.

Recon asks a specific question and gathers evidence to answer it.

Examples:

- "What are competitors charging for this segment?"
- "Why did these three deals stall?"
- "Is the issue pricing, onboarding, or perceived value?"
- "Which capability gap is causing this recurring blocker?"
- "What evidence would make this decision safe?"

### UX Implications

When confidence is low, the system should offer recon as an explicit move.

The CEO should see:

- what question recon will answer
- how long it may take
- what it will cost
- what decision it will unlock
- what happens if they decide without recon

### Backend and Logic Implications

Recon may produce tasks, but the system should remember the recon purpose separately from the task.

When recon completes, Cortex should:

- attach evidence to the original situation
- update confidence
- update the relevant decision card
- explain what changed

### Acceptance Signals

This requirement is met when:

- low-confidence decisions can become recon-first
- recon results change the state of the original situation
- the CEO can see what uncertainty was reduced
- the system can say when recon failed to answer the question

---

## Requirement 9: Feedback and Consequence Tracking

### Concept

The article says decisions become meaningful because the world responds.

Cortex must show what happened after a decision.

### Capability Required

Cortex needs consequence tracking.

For important decisions, the system should track:

- what was expected
- what was chosen
- what was sacrificed
- when the outcome should be reviewed
- what actually happened
- whether the decision was positive, negative, mixed, or still unclear

### UX Implications

The CEO should receive consequence briefings.

Examples:

- "The enterprise push re-engaged 2 of 3 deals, but delayed product review by 9 days."
- "The hiring delay is now the largest contributor to the missed sales target."
- "The recon changed the decision: this is not a pricing problem, it is an onboarding problem."

The system should be direct, not flattering.

### Backend and Logic Implications

The system needs to connect decisions to later evidence.

This does not require perfect causality, but it does require disciplined links:

- decision
- expected outcome
- related tasks or campaigns
- observed evidence
- confidence in the assessment

### Acceptance Signals

This requirement is met when:

- major decisions come back for review
- the system can explain what likely changed because of the decision
- mixed outcomes are represented honestly
- consequence reviews improve future recommendations

---

## Requirement 10: Operating Rhythm

### Concept

The article describes a cadence:

- morning brief
- midday pulse
- evening review
- weekly campaign review
- quarterly reckoning

This rhythm is the heartbeat of the command layer.

### Capability Required

Cortex needs recurring command briefings.

Briefing types:

- Morning Brief: what changed and what matters now
- Midday Pulse: only if something materially changed
- Evening Review: what moved, what deferred, what attention was spent on
- Weekly Campaign Review: campaign state and theater movement
- Quarterly Reckoning: decisions, bets, outcomes, capability gaps

### UX Implications

The rhythm should reduce noise, not create it.

The system should not produce updates just because time passed.

It should brief when:

- material state changed
- a decision review is due
- a campaign phase changed
- a dark area became clearer
- a blocker is aging
- a resource threshold was crossed

### Backend and Logic Implications

The system needs to know what has changed since the last relevant review.

It should compare:

- previous state
- current state
- open situations
- resolved situations
- campaign progress
- decision outcomes
- capability changes

### Acceptance Signals

This requirement is met when:

- the CEO can rely on the brief as a high-signal command ritual
- unchanged periods do not create fake updates
- weekly and quarterly reviews are based on accumulated evidence
- the system can identify which prior bets were right, wrong, or unresolved

---

## Requirement 11: Progression

### Concept

The article says the company should feel more capable over time.

Progression is not a level-up animation. It is the lived experience that the system, agents, and organization can handle more without the CEO.

### Capability Required

Cortex needs progression awareness.

Progression should include:

- Tamir understanding the CEO's judgment better
- routine decisions becoming more autonomous
- recurring situations becoming recognized patterns
- campaigns producing reusable playbooks
- agents requiring less CEO intervention
- organizational skills becoming more reliable

### UX Implications

The CEO should see evidence of increased capability.

Examples:

- "This used to require CEO approval. Tamir has handled the last 8 cases correctly."
- "This resembles the Q2 pipeline recovery campaign. That playbook worked last time."
- "Execution reliability improved from uncertain to clear over the last 30 days."

### Backend and Logic Implications

The system needs to track patterns over time:

- repeated decisions
- overrides and corrections
- task success rates
- escalation frequency
- campaign outcomes
- skill assessments
- doctrine proposals

### Acceptance Signals

This requirement is met when:

- the CEO can see what Cortex can now handle that it could not handle before
- autonomy is earned through evidence
- recurring situations surface past playbooks
- progression reflects capability, not usage volume

---

## Requirement 12: Company Skill Tree

### Concept

The article defines skills as organizational capabilities proven by evidence.

A skill is not something the CEO says the company is good at. It is something the company has demonstrated it can do reliably.

### Capability Required

Cortex needs an evidence-based skill tree.

Skill dimensions:

- consistency
- success rate
- independence from CEO

Skill levels should reflect demonstrated capability:

- Level 1: fragile, person-dependent, inconsistent
- Level 2: works sometimes, breaks under pressure
- Level 3: reliable in standard conditions
- Level 4: runs with minimal oversight
- Level 5: institutional capability

### UX Implications

The skill tree should show:

- current level
- evidence behind the level
- confidence in the assessment
- blocker preventing the next level
- related campaigns
- whether the skill is person-dependent

The CEO should not be able to manually level a skill.

### Backend and Logic Implications

The system needs evidence gates.

Before assigning or changing a skill level, Cortex should require:

- enough examples
- recent enough evidence
- clear success criteria
- independence measurement
- stability over time

If evidence is insufficient, the skill should say so.

### Acceptance Signals

This requirement is met when:

- skills level up only when outcomes improve
- skills can downgrade when evidence regresses
- completing a campaign does not automatically level a skill
- each skill assessment can explain its evidence

---

## Requirement 13: Doctrine and Institutional Memory

### Concept

The article says commanded companies develop doctrine: operating principles formed from repeated decisions and outcomes.

Doctrine is not generic advice. It is strategy learned from this company's history.

### Capability Required

Cortex needs doctrine formation.

Doctrine should emerge when:

- similar decisions repeat
- outcomes consistently support a pattern
- the CEO ratifies the principle
- Tamir can apply the principle later

Example:

```text
When churn exceeds 8%, prioritize retention campaigns over acquisition campaigns until churn stabilizes.
```

### UX Implications

Tamir should propose doctrine, not silently invent it.

The CEO should be able to:

- review the evidence
- ratify the rule
- reject it
- edit the wording
- retire it later

### Backend and Logic Implications

Doctrine must link back to:

- source decisions
- outcomes
- campaigns
- evidence
- CEO ratification

Once ratified, doctrine can influence future recommendations.

### Acceptance Signals

This requirement is met when:

- doctrine proposals cite real company history
- Tamir can apply ratified doctrine in future situations
- rejected doctrine does not keep resurfacing unchanged
- doctrine can be retired when it stops fitting reality

---

## Tamir's Role

### Concept

The article's key distinction:

```text
Assistant responds to requests.
Game master runs the world.
```

Tamir should be the intelligence that interprets company reality.

### Capability Required

Tamir should:

- read signals across the company
- synthesize situation reports
- identify what deserves attention
- frame decision trade-offs
- recommend recon when confidence is low
- track consequences
- identify capability gaps
- propose campaigns
- remember relevant prior patterns

### UX Implications

Tamir should feel opinionated and context-aware.

He should not merely say:

```text
You have 3 pending tasks.
```

He should say:

```text
Product execution is stable, but the market theater is dark. The highest-leverage move is recon before making the pricing decision.
```

### Backend and Logic Implications

Tamir should not own all system logic.

The system should provide structured context, evidence, and confidence. Tamir should turn that into judgment-oriented language and recommendations.

This avoids two problems:

- making the product a raw dashboard with no interpretation
- making the product an untestable LLM-only system

### Acceptance Signals

This requirement is met when:

- Tamir can explain why something matters now
- Tamir distinguishes fact from inference
- Tamir recommends recon when evidence is weak
- Tamir connects current situations to past decisions and campaigns
- Tamir's narrative does not override computed evidence or confidence

---

## Cross-Cutting Requirements

### Truthfulness

Every major output should reveal confidence.

The system should classify assessments as:

- measured
- estimated
- qualitative
- unsupported

Only measured assessments should get precise numeric treatment.

### Deduplication

The system must avoid creating repeated situations for the same underlying issue.

Repeated evidence should strengthen or update an existing situation unless the cause materially changed.

### Privacy

People, customer, calendar, and sales signals may contain sensitive information.

The command surface should show strategic implications, not unnecessary private detail.

### Testability

Important behavior should be testable without relying on Tamir's prose.

Examples:

- duplicate signals merge
- dark theaters remain dark
- low-confidence decisions recommend recon
- skill levels require evidence
- decision outcomes append learning rather than rewriting history

---

## Rollout Requirements

### Phase 1: Command Queue From Existing Internal Signals

Capability:

- turn existing task, escalation, deliverable, routine, cost, and asset signals into situations

Success criteria:

- the CEO sees a situation report instead of only task status
- duplicate activity does not create duplicate situations
- execution blockers remain visible
- dark theaters are explicitly shown

### Phase 2: Decision Cards and Recon

Capability:

- represent important choices with options, trade-offs, confidence, and review dates
- allow recon as an explicit move

Success criteria:

- low-confidence decisions can become recon-first
- chosen decisions preserve expected outcomes
- recon results update the original situation

### Phase 3: Campaigns

Capability:

- track multi-step strategic operations over time

Success criteria:

- campaigns have objectives, phases, blockers, and review points
- campaign progress is based on objective movement, not just task completion
- completed campaigns produce post-action reviews

### Phase 4: Skill Tree

Capability:

- assess organizational capabilities using evidence

Success criteria:

- skills can show insufficient evidence
- skill changes require outcomes, not CEO optimism
- capability campaigns can target specific skill gaps

### Phase 5: Doctrine and Reckoning

Capability:

- turn repeated decisions and outcomes into ratified operating principles
- run weekly and quarterly reviews based on evidence

Success criteria:

- doctrine proposals cite company history
- quarterly review confronts decisions, campaigns, and capability gaps
- Tamir can recall prior playbooks when similar situations recur

---

## What This Document Does Not Decide

This document does not decide:

- exact database schema
- exact API routes
- exact React components
- exact file names
- exact implementation order inside the codebase
- exact scoring formulas

Those are implementation decisions.

This document defines the product and system capabilities the implementation must satisfy.

---

## Final Interpretation

The article should change Cortex from:

```text
an AI execution dashboard
```

into:

```text
a live command system for the company
```

That means Cortex must show:

- the map
- the fog
- the scarce resources
- the situations
- the trade-offs
- the campaigns
- the consequences
- the capabilities being built

The right implementation is not the one with the most machinery. It is the one where an agent reading this document understands what new capabilities the system must gain and what product behavior those capabilities must create.
