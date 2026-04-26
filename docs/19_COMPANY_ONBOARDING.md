# 19 — Company Onboarding: Bringing a Living Company to Life

## Overview

This document generalizes the model from previous docs, moving beyond the assumption of a single, built-in company. It defines how we can create the product for any arbitrary company—enabling any founder to bring their own Living Company to life, whether they're uploading an existing business or building one from scratch.

One instance, one company. Each founder gets their own organism. This document defines how it is born.

Onboarding is not a setup wizard. It is an **immersion** — the founder's first encounter with what it feels like to have an elite Chief of Staff who helps them articulate, organize, and operationalize everything they are building. By the end, the system has absorbed the founder's DNA, seeded Memory, grown Organs, and is ready to operate as a Living Company.

---

## Why This Exists

Today, the specifc company identity is hardcoded at every layer:

| Layer | What's Hardcoded |
|-------|-----------------|
| DNA | `data/vault/company-dna.md` — Myelin-specific identity, market, domain |
| Nervous System | `src/agents/{cos}/soul.md` — references Myelin and Omer by name |
| Organs | `src/agents/{cto,cmo,coo}/soul.md` — neurotech startup-specific domain knowledge |
| Memory | `data/cos/{MEMORY,USER,COMPANY}.md` — Omer's operational context |
| The Vault | `data/vault/` — Myelin reference documents |
| Knowledge | `data/departments/{dept}/knowledge/` — Myelin domain material |
| Database | Tasks, deliverables, employees, assets — all Myelin-scoped |

For the system to serve an arbitrary company, all of these layers must be **generated through conversation** — not copied from a template. The onboarding process is how that generation happens.

---

## The Manifesto in Practice

The manifesto defines companies as living organisms. This is not metaphor for decoration — it constrains every design decision.

### DNA Is the Foundation

The founder's vision, values, taste, judgment, non-negotiables, and definition of excellence are the organism's DNA. DNA shapes everything downstream — how Organs behave, what Memory retains, how the Nervous System filters signals. Without DNA, nothing else can grow. The onboarding must extract it before the organism can function.

The DNA has **minimum required fields** — a schema the onboarding enforces. The founder must articulate at least: who the company is, what it does, for whom, and at what stage. Everything beyond this minimum is welcomed, preserved, and used to deepen the organism's intelligence.

### The Upload Is Not a Data Migration

For existing businesses, The Upload is three layers:

1. **DNA Transfer** — Articulating vision, values, and non-negotiables through conversation.
2. **Instinct Development** — Teaching operational preferences through corrections. Seeded during the demo task, deepened over weeks of operation.
3. **Memory Preservation** — Converting fragile institutional knowledge into durable, searchable assets in the Vault and Knowledge systems.

Uploading is not "import your files." It is "help us understand your business so deeply that we can operate within it."

### Creation Is Discovery

A Native company — built from scratch — has no Organizational Debt. It discovers its structure through work, not planning. Creation onboarding is shorter in some phases, more exploratory in others. The Chief of Staff acts as a business advisor, helping the founder think through decisions they have not yet made.

### Trust Through Deliverables

Trust is earned through work, not promises. The onboarding includes a real task — a demo that produces something useful. The founder sees the system deliver before onboarding ends.

### The Fear

Founders will have concerns. The onboarding does not have a dedicated phase for addressing them. Instead, **transparency is woven throughout every phase** —  CoS is always honest about what the system can and cannot do, admits uncertainty when it exists, and addresses fears as they naturally surface. No backend artifacts are exposed. No overselling. A great Chief of Staff tells you what they cannot do, not just what they can.

---

## Dedicated Onboarding UI

Onboarding does not happen in the Cortex. It has its own **dedicated UI** — a separate experience designed for immersion.

### Voice-First Design

The onboarding is currently implemented as chat, but **every phase is designed to be voice-compatible.** The entire flow is conversational by nature — no phase depends on typing, clicking form fields, or text-specific affordances. When voice is added, the onboarding should work as a spoken conversation with the CoS with minimal adaptation.

This means:
- Phase designs must not rely on the founder reading structured output (lists, tables). The CoS should be able to convey the same information conversationally.
- Confirmation flows use natural language ("does that sound right?"), not buttons.
- Visual phases (org builder, file upload) will need companion voice flows — the CoS describes what they see and the founder directs verbally.
- No phase should require the founder to compose long-form text. The CoS extracts structure from natural speech.

### Phase-Based Screens

Each phase has its own screen optimized for what it needs:

- **Conversational phases** (1-6): Chat-forward layout with the CoS guiding the conversation. Clean, focused, no distractions. These phases translate directly to voice with no structural changes.
- **Org design phase** (7): Visual org builder where the founder designs their organizational structure. The CoS assists alongside. In voice mode, the CoS walks through the structure verbally and the founder directs changes.
- **System orientation** (8): Transitions INTO the Cortex. The demo task runs in the real system. This is the start of graduation.
- **Upload phase** (9): File manager interface for organized ingestion. Drag-and-drop files, paste URLs. The CoS triages alongside. Voice mode: the founder describes what they have, the CoS guides them through uploading.

### Gradual Graduation

There is no hard cut from onboarding to operation. Phase 8 (System Orientation) transitions the founder into the Cortex for the first time. The demo task runs in the real system. Phase 9 (Upload) may happen partly in the Cortex. By the time onboarding "ends," the founder is already operating. The Liberation begins without ceremony.

### Multi-Session Support

Onboarding spans multiple sessions. State is persisted — the founder can close the browser and return tomorrow. The CoS resumes where they left off.

Persisted in `data/onboarding/`:
- `state.json` — Phase completion, partial signals, pending items
- `conversation.jsonl` — Full onboarding conversation history

The CoS's session is resumed via SDK `session_id`.

---

## The 9 Phases

Each phase is a conversational arc with a goal. Phases may overlap, and information from later phases can update earlier artifacts. Full immersion — all 9 phases are required. The organism needs all its DNA before it can operate.

---

### Phase 1: Who Is the CoS 

> Defining the Nervous System's personality

**Goal:** Establish the Chief of Staff's identity — name, avatar, communication style, tone, and vibe. The founder chooses who their Nervous System is.

**Conversation:** The system presents a selection of CoS personas to choose from — each with a name, a cartoon-style avatar (not realistic), and a suggested personality. The options should represent diversity (age, gender, ethnicity). The founder picks one or provides their own name and preferences.

Then the CoS (now named and embodied) introduces themselves and asks the founder how they prefer to work. Direct and terse? Warm and detailed? Formal? Casual? Should the CoS push back on bad ideas or just execute? Does the founder want reasoning and context, or just conclusions?

**What gets configured:**
- CoS name and avatar — stored in agent config, used throughout the UI.
- The CoS's soul — personality section (tone, communication style, pushback level). Functional sections (routing logic, tool usage, decision framework) remain from the system template.
- `data/cos/USER.md` — initial communication style preference.

**Completion:** The founder has named their CoS, chosen an avatar, and confirmed the vibe feels right.

**Architecture note:** Soul files have two layers. The **template layer** (routing logic, tool usage, escalation rules) never changes per company. The **generated layer** (personality, tone, domain context) is unique per company. Onboarding only writes the generated layer.

---

### Phase 2: What Is the Company

> Extracting the DNA

**Goal:** Define the company's identity — what it does, why it matters, for whom, at what stage.

**Conversation:** The CoS asks open-ended questions about the company's mission, problem space, customer, market, and stage. Not "what is your company name" but "tell me what you are building and why it matters."

**What gets configured:**
- `data/vault/company-dna.md` — core identity sections. The DNA has minimum required fields:
  - Company name and identity
  - What the company does (product/service)
  - Target customer / market
  - Stage (idea, pre-revenue, revenue, scaling)
  - Domain / industry

  Everything beyond these minimums is captured and preserved. The founder can elaborate as much as they want.

**Completion:** The CoS can articulate the company's identity in a paragraph the founder agrees with. Not comprehensive yet — Phase 6 goes deeper.

**Upload vs. Creation:**
- **Upload:** The CoS may work from existing artifacts the founder describes. If the founder mentions a pitch deck or website, that context informs the DNA draft.
- **Creation:** Pure conversation. The CoS helps the founder discover and articulate what may still be forming.

---

### Phase 3: Who Am I

> Understanding the founder behind the DNA

**Goal:** Get to know the founder — their journey, expertise, working style, decision patterns, strengths, blind spots.

**Conversation:** The CoS asks about the founder's story. Not a resume — a narrative. *"How did you get here? What's your background? What made you decide to start this?"* Then deeper: *"How do you make decisions? What drives you crazy? What do you expect from the people around you?"*

**What gets configured:**
- `data/cos/USER.md` — full founder profile: preferences, decision patterns, domain expertise, communication style.
- `data/vault/founder-profile.md` — detailed vault document capturing the founder's background and story.
- All agent soul files receive the founder's name and relevant context.

**Completion:** The CoS can describe the founder's working style in a way they recognize.

---

### Phase 4: Upload or Create

> Determining the organism's origin

**Goal:** Determine whether this is an existing business being transplanted (The Upload) or a new company being built from scratch (Creation).

**Conversation:** The CoS asks directly and then explores the implications. For Upload: what exists, how established, how much material. For Creation: how far along the thinking is, what has been explored.

This is a deliberate branching point. The CoS pauses, reflects what they have heard, and explicitly determines the path. *"So we are transplanting [Company] into the system"* or *"So we are building [Company] from the ground up."* This sets expectations for everything that follows.

**What gets configured:**
- `data/cos/MEMORY.md` — entry noting the path and implications.
- `data/onboarding/state.json` — path determination stored.

**Completion:** Clear determination confirmed by the founder.

**Design note:** Both paths go through all remaining phases. The conversation depth and approach differ, not the phase structure.

---

### Phase 5: What You Already Have

> Guided inventory of existing assets

**Goal:** Catalog what the founder already has that will serve the company — but through a guided, category-by-category walkthrough, not an open-ended "tell me everything."

**Why guided:** Asking a founder (especially one with an existing business) to freely recall everything they have is overwhelming. They will forget things, feel anxious about completeness, and not know what counts. Instead, the CoS introduces the concept of Assets — what they are in the system, why they matter — and then walks through specific categories one at a time.

**Screen:** The CoS introduces the Asset ecosystem, potentially showing a demo preview from the real Cortex so the founder can see what organized assets look like in practice. This grounds the conversation — the founder understands *where things end up* before being asked what they have.

**Conversation flow — category by category:**

The CoS walks through asset categories systematically, asking about each one:

1. **Brand & Identity** — *"Do you have a logo, brand guidelines, color palette, fonts? Even informal ones count."*
2. **Documents & Strategy** — *"Any pitch decks, business plans, strategy docs, one-pagers? Even old versions."*
3. **Code & Technical** — *"Any existing codebase, repos, prototypes, technical specs, architecture diagrams?"*
4. **Content & Marketing** — *"Blog posts, social media accounts, newsletters, content calendars, audience research?"*
5. **Financial & Legal** — *"Financial models, contracts, term sheets, incorporation docs, compliance materials?"*
6. **Customer & Market** — *"Customer lists, CRM data, market research, competitor analyses, user feedback?"*
7. **Operational** — *"Processes, SOPs, vendor relationships, tool subscriptions, team documentation?"*
8. **Domain Knowledge** — *"Anything in your head that is not written down but critical — key relationships, industry insights, lessons learned?"*

For each category, the founder says what they have (or nothing — that is fine). The CoS captures it and moves on. Anything missed can be added later.

**Screen:** A category checklist sidebar is visible on the right side of the screen, showing all 8 categories. As the founder provides material for a category, it gets a green checkmark indicating progress. The founder can see at a glance what they have covered and what remains — but they are not required to fill every category. They can move on at any time. This makes the phase feel like guided progress rather than interrogation.

**What gets configured:**
- Structured intake list stored in `data/onboarding/state.json` — categorized inventory that Phase 9 will use for organized ingestion.
- `data/cos/MEMORY.md` — entry cataloging known assets by category.

**Completion:** The CoS has walked through all categories. The founder has had a chance to surface what they have in each one.

**Upload vs. Creation:**
- **Upload:** Each category may have substantial material. The CoS spends more time on categories where the founder has depth.
- **Creation:** Most categories will be empty or sparse. The CoS moves through quickly, noting what exists and skipping what does not.

---

### Phase 6: Business Deep-Dive

> Growing the DNA into full resolution

**Goal:** Go deep into the business domain. Market analysis, competitive positioning, business model, pricing, technical architecture, regulatory landscape. The DNA becomes high-resolution.

**Conversation:** For Upload: *"Walk me through your business model. Who pays, how much, for what? What is your sales cycle? What does your tech look like?"* For Creation: *"Let's think through the business model together. Who is your ideal first customer? How will you reach them?"*

**What gets configured:**
- `data/vault/company-dna.md` — enriched with detailed business model, competitive landscape, technical architecture, budget philosophy, working style.
- Department knowledge seeds:
  - `data/departments/tech/knowledge/` — technical architecture, stack, infrastructure decisions.
  - `data/departments/marketing/knowledge/` — brand direction, audience, content strategy.
  - `data/departments/operations/knowledge/` — business model, compliance, partnerships.

**Completion:** The DNA is comprehensive enough that any Organ reading it can understand the business, make reasonable decisions, and know when to escalate.

---

### Phase 7: Build the Org

> The founder designs the organism's Organs

**Goal:** Define the organizational structure — which Organs exist, what they focus on, who leads them, what the initial priorities are.

**Screen:** Visual org builder. The founder designs their organizational structure with the CoS assisting.

**Conversation:** The CoS presents the standard Organ structure (Technology, Marketing, Operations) and asks the founder what fits. The **founder is the architect** — the CoS assists, but the founder decides.

**For Upload (Mirror Existing):** If the founder has existing structure (marketing freelancer, dev contractor, informal departments), the org should mirror it. Existing roles map to Organs. The Living Company reflects what already exists and grows from there.

**Custom Organs:** Founders can define departments beyond the defaults. A "Sales" department, a "Design" team, a "Product" org — the system creates new agent souls, directory structures, and routing for custom Organs. The founder is not constrained to the default three.

**What gets configured:**
- `src/agents/{dept}/soul.md` — active department head souls generated with company-specific domain expertise, decision philosophy, escalation rules. Each has template layer (functional) + generated layer (personality, domain).
- `employees` table — seeded with the CoS + active department heads.
- `data/vault/company-dna.md` — Departments section finalized with actual organizational structure.
- `data/departments/{dept}/` — directory structure created for each active Organ (knowledge/, skills/, sharedlib/, tools/, tasks/).

**Completion:** The org is defined. Organs have souls. The founder has confirmed the structure.

**Design note:** Human team members (contractors, freelancers, co-founders) are captured as context in the DNA and department knowledge, not as agents. The org is AI agents only. Human team awareness informs how agents operate but humans are not represented as system entities.

---

### Phase 8: System Orientation

> The founder's first experience of The Liberation

**Goal:** Show the founder how the Living Company operates in practice, and execute a first real task.

**Screen:** This phase transitions the founder INTO the Cortex for the first time. The demo task runs in the real system. This is the start of the gradual graduation.

**Conversation:** The CoS gives a guided walkthrough. Then: **a real task.** The CoS suggests something specific and relevant based on everything learned in Phases 1-7 — *"Based on what you told me, I think [specific task] would be valuable. Want to try it?"* The founder can adjust or replace the suggestion.

The task runs through the real pipeline: the CoS routes it, a department head plans it, the founder approves the plan, the agent executes, and a deliverable is produced. The founder experiences the full cycle.

**This is where Instincts are first tested.** The founder's reactions to the output — corrections, approvals, requests for changes — teach the system how they think. This is more effective than any questionnaire.

**What gets configured:**
- A completed deliverable — the first real output of the Living Company.
- The founder's first experience of strategic control.
- Initial corrections captured in Memory.

**Completion:** The founder has sent a real task, approved a real plan, and received a real deliverable.

**Handling failure gracefully:** The demo task is scoped to be small and achievable, but output quality may not match the founder's expectations — especially before Instincts have developed. If the output disappoints, this is not a crisis. It is the first Instinct-building moment. The CoS acknowledges what went wrong, asks the founder what they would have preferred, captures the correction in Memory, and offers to run a second task incorporating the feedback. Failure during onboarding is more valuable than silent success — it teaches the system how the founder thinks. The CoS should frame it that way: *"Good — now I know what you actually want. Let me try again."*

---

### Phase 9: Memory Preservation

> Organizing and absorbing existing knowledge

**Goal:** Ingest the founder's existing documents, files, and knowledge (inventoried in Phase 5) into the Vault, Knowledge, and Asset structures.

**Screen:** File manager interface with drag-and-drop upload and URL input. The CoS triages alongside — classifying, confirming, organizing.

**Sources supported:**
- **Local files:** PDFs, documents, spreadsheets, images, code, plain text. Drag-and-drop.
- **URLs:** Web pages, public documents, articles. The CoS fetches and processes the content.

**Conversation:** The CoS helps organize: *"Let's go through what you have. Some things belong in the Vault as permanent reference, some in department Knowledge as operational context, and some might become Assets we track over time."*

**What gets configured:**
- Files organized into:
  - `data/vault/` — permanent company-level reference (DNA-adjacent material)
  - `data/departments/{dept}/knowledge/` — department-scoped operational reference
  - `data/departments/{dept}/sharedlib/` — shared data with provenance tracking (`.meta.json` sidecars)
  - `data/assets/{assetId}/` — promoted assets with git-based version control
- `documents` table — FTS5-indexed entries for all ingested material
- `data/cos/COMPANY.md` — populated via programmatic refresh after ingestion

**Completion:** All material from Phase 5 has been processed, classified, and confirmed.

#### Solving the Chaos Problem

Uploading existing information can be total chaos — hundreds of files with no organization, contradictory documents, outdated material mixed with current. The process must impose order without losing signal.

**Triage before ingest.** Every uploaded item goes through classification before filing. The CoS reviews each item and proposes: Vault (permanent reference), Knowledge (operational, department-scoped), Asset (tracked over time), or Skip (not useful). The founder confirms or overrides.

**Batch processing with human checkpoints.** Process in batches of 5-10 items. After each batch, the CoS summarizes what was created and where. Get confirmation. Then continue. No silent bulk imports.

**Conflict resolution.** Multiple documents may contain contradictory information (old pitch deck vs. new one). The CoS flags conflicts and asks the founder which is canonical.

**Provenance tracking.** Every ingested file gets a `.meta.json` sidecar: original filename, upload date, source, onboarding phase, CoS-generated description.

**Deferred processing.** Complex documents (long legal docs, massive spreadsheets) are flagged for post-onboarding processing via normal task flow. Not everything must be absorbed immediately.

**Format handling.** For non-text formats, the CoS extracts key information and generates a text summary alongside the original.

---

## System Artifact Map

What onboarding produces, by phase:

| Phase | Artifact | Location |
|-------|----------|----------|
| 1 | CoS personality | `src/agents/{cos}/soul.md` (generated layer) |
| 1 | Communication style | `data/cos/USER.md` |
| 2 | Company DNA (core) | `data/vault/company-dna.md` |
| 3 | Founder profile | `data/cos/USER.md`, `data/vault/founder-profile.md` |
| 3 | Agent context | All `soul.md` files (founder name/background) |
| 4 | Path determination | `data/onboarding/state.json`, `data/cos/MEMORY.md` |
| 5 | Asset inventory | `data/onboarding/state.json` (intake list) |
| 6 | DNA (full resolution) | `data/vault/company-dna.md` (enriched) |
| 6 | Domain knowledge | `data/departments/{dept}/knowledge/` |
| 7 | Organ souls | `src/agents/{dept}/soul.md` (per active department) |
| 7 | Employee records | `employees` table |
| 7 | Department structure | `data/departments/{dept}/` directories |
| 8 | First deliverable | `data/workspaces/{taskId}/` |
| 8 | Initial corrections | `data/cos/MEMORY.md`, `data/cos/USER.md` |
| 9 | Vault documents | `data/vault/` |
| 9 | Dept knowledge | `data/departments/{dept}/knowledge/` |
| 9 | Shared library | `data/departments/{dept}/sharedlib/` |
| 9 | Assets | `data/assets/{assetId}/` |
| 9 | Document index | `documents` table (FTS5) |
| 9 | Company state | `data/cos/COMPANY.md` (via programmatic refresh) |

---

## Architecture

### One Instance, One Company

Each founder gets their own instance. No multi-tenancy, no tenant isolation. The instance **is** the company. Each Living Company is a distinct organism.

### How a Founder Gets Their Instance

The system is a self-hosted open-source project. A founder clones the repository and installs it on their own machine — a Mac Mini, a personal computer, a home server. The first time they run it and open the Cortex, onboarding begins automatically (see Onboarding Detection below). No cloud account, no signup, no provisioning service. Clone, install, run, onboard.

### Onboarding Detection

Onboarding mode activates on fresh instances — detected by absence of `company-dna.md` in vault, or presence of an onboarding sentinel file. In onboarding mode:

- Standard task routing is disabled. The CoS is the sole conversational partner.
- The CoS uses an **onboarding soul extension** — additional system prompt content appended to the base soul with onboarding-specific guidance and phase awareness.
- Onboarding-specific tools are available:
  - `generate_company_dna` — writes DNA from structured conversational input, enforcing minimum required fields
  - `generate_soul` — writes agent soul files (generated layer only)
  - `ingest_document` — classifies and files uploaded documents with provenance
- Phase tracking is internal — the CoS uses structured output to classify which phases have sufficient signal.

### Soul File Architecture

Every soul file has two layers:

| Layer | Content | Per-Company? |
|-------|---------|-------------|
| **Template** | Routing logic, tool usage, decision framework, escalation rules | No — shared across all companies |
| **Generated** | Personality, tone, domain expertise, company context | Yes — unique per company |

Onboarding only writes the generated layer. The template layer preserves functional correctness across all companies.

### DNA Schema

No template file. The DNA is generated from conversation. But it has minimum required fields enforced by schema:

**Required:**
- Company name and identity
- What the company does (product/service/domain)
- Target customer or market
- Stage (idea, pre-revenue, revenue, scaling)

**Optional but encouraged (captured when the founder elaborates):**
- Competitive landscape
- Technical architecture
- Business model and pricing
- Budget philosophy
- Working style and collaboration principles
- Regulatory considerations
- Founder background (also in `founder-profile.md`)

### Custom Organ Support

The default Organ structure (Technology, Marketing, Operations) is a starting point. The onboarding supports creating entirely new departments:

- New department head soul generated (template layer + generated layer)
- New directory structure created (`data/departments/{custom-dept}/`)
- Routing rules updated to include the new Organ
- Agent card and employee record created

This requires the routing system to be dynamic rather than hardcoded — an architectural consideration for implementation.

### Onboarding State

```
data/onboarding/
  state.json          # Phase completion, partial signals, intake list, path
  conversation.jsonl  # Full onboarding conversation history
```

Ensures multi-session support and partial phase recovery.

---

## Upload vs. Creation: How the Paths Differ

All 9 phases happen for both paths. The depth and approach differ:

| Phase | The Upload | Creation |
|-------|-----------|----------|
| 2. DNA | May reference existing artifacts (deck, site) | Pure exploration of something still forming |
| 3. Who Am I | Founder has track record and operational history | May be first-time founder; more advisory |
| 5. Inventory | Extensive — years of material to catalog | Brief — a deck, some notes, maybe nothing |
| 6. Deep-Dive | Extraction: "how does your business actually work?" | Collaborative: "let's figure this out together" |
| 7. Org | Mirror existing structure to Organs | Discover needed Organs through discussion |
| 9. Upload | Heavy — may involve hundreds of documents | Light — little to ingest |

The core difference: Upload is **extraction** (the business exists, we must understand it). Creation is **discovery** (the business is forming, we must help shape it).

---

## Post-Onboarding: The Living DNA

Onboarding is a starting point. The DNA, Memory, and Instincts evolve through operation.

**Continuous refinement (already built into the system):**
- Memory review extracts preferences from every conversation with 3+ CEO turns
- `USER.md` evolves through operational feedback
- `COMPANY.md` refreshes programmatically after every completed task
- Department Knowledge accumulates through task execution

**DNA evolution:**
- As the company evolves — pivots, new products, new markets — the DNA should be updated
- The CoS should periodically suggest review: *"It has been 3 months since the DNA was last updated. Based on recent work, your positioning has shifted. Should we revisit it?"*

**Instinct deepening:**
- Onboarding seeds the first Instincts through early interactions
- The demo task (Phase 8) provides the first corrections
- Daily operation builds implicit Instincts through approvals and feedback
- Over weeks and months, the system's reflexive responses align with the founder's judgment — exactly as the manifesto describes

---

## Open Questions

Design decisions to resolve during implementation:

1. **Custom Organ routing:** Adding new departments requires dynamic routing. How deep should the routing flexibility go? Full dynamic dispatch, or a configurable registry?

2. **Onboarding UI technology:** The phase-based screens need different layouts (chat, org builder, file manager). Should this be a separate Next.js app, a route group within the Cortex, or a mode switch?

3. **Demo task selection:** the CoS suggests a first task based on context. Should there be a library of proven first-task templates by industry/stage, or fully custom every time?

4. **Re-onboarding:** Can a founder re-run onboarding to change fundamental DNA? Or does DNA evolution happen through targeted conversations and normal task flow?

5. **Onboarding duration:** The full immersion could take 30 minutes or 3 hours depending on the founder and whether it's Upload or Creation. Should the CoS set expectations about time investment at the start?

---

## Related Documents

| Document | Relationship |
|----------|-------------|
| [00 — Vision](00_VISION_PRODUCT_BACKGROUND.md) | Onboarding generalizes the hardcoded Myelin context |
| [02 — Agent System](02_AGENT_SYSTEM.md) | Soul files, agent cards, orchestration |
| [06 — CoS Interface](06_TAMIR_INTERFACE.md) | Chat interface used in conversational phases |
| [14 — COMPANY.md System](14_COMPANY_MD_SYSTEM.md) | COMPANY.md populated as final onboarding step |
| [15 — Memory System](15_MEMORY_SYSTEM.md) | All COS files generated during onboarding |
| [17 — Hiring & Delegation](17_HIRING_DELEGATION.md) | Phase 7 uses the hiring system |
| [18 — Strategic Layer](18_STRATEGIC_LAYER.md) | Post-onboarding, founder uses strategic canvas |
