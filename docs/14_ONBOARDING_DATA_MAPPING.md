# Onboarding Data Mapping

This document maps every piece of information collected during the onboarding wizard to its backend storage destination and explains why. Use this as the reference spec when implementing the onboarding API layer.

---

## Storage Locations Overview

The system has four places where onboarding data can live:

| Location | What lives here | Access pattern |
|---|---|---|
| `data/vault/company-dna.md` | Company identity, market, product, working style | Agents read via FTS5 full-text search at task execution time |
| `data/vault/` (additional files) | Focused knowledge docs generated from onboarding answers | Same as above — searchable by agents |
| SQLite DB (Prisma) | Structured operational config: budgets, agent settings | Queried directly by orchestrator and Cortex UI |
| `.env.local` | Infrastructure secrets and provider config | Read at server startup, not agent-accessible |

There is no fourth option. Agent `soul.md` files are **not** modified at onboarding — they encode permanent agent personality and are committed to the repo. MEMORY.md files are per-agent runtime memory that agents write themselves; they start empty.

---

## Onboarding Steps & Data Mapping

### Step 1 — Company Identity

The foundation. Everything agents reference when introducing the company, writing content, or framing analysis.

| Field | Example | Destination | Why |
|---|---|---|---|
| Company name | "Myelin" | `company-dna.md` → `## Who We Are` | Agents need this to sign off deliverables, write content, reference the company correctly |
| One-line mission | "Privacy-first BCI integration layer for developers" | `company-dna.md` → `## Who We Are` | High-frequency reference — every agent reads this |
| Founder name | "Omer Shalev" | `company-dna.md` → `## Who We Are` | Agents address CEO by name, reference founder in external content |
| Founder background | "Cryptography (PM's Office), neuroscience (Hebrew U)" | `company-dna.md` → `## Who We Are` | Shapes agent tone, informs credibility framing in content tasks |
| Industry / domain | "Neurotech / BCI" | `company-dna.md` → `## Who We Are` | Routes domain-specific research correctly |
| Company stage | "Pre-seed", "Seed", "Series A" | `company-dna.md` → `## Stage` | Governs speed-vs-polish tradeoffs agents make on every task |

**Output:** Generates the `## Who We Are` and `## Stage` sections of `company-dna.md`.

---

### Step 2 — Current Priorities

What the company is sprinting toward right now. Agents use this to prioritize work within tasks and flag misalignment.

| Field | Example | Destination | Why |
|---|---|---|---|
| Top 3 current priorities | "1. GTM validation 2. MVP scope 3. Dev plan" | `company-dna.md` → `## Stage` (priorities block) | Tamir uses this for task routing decisions; dept heads use it for plan framing |
| Sprint horizon | "300-day sprint to first paying customers" | `company-dna.md` → `## Stage` | Sets urgency context for every task |
| Key constraints / what NOT to do yet | "Don't build product before GTM validation" | `company-dna.md` → `## Stage` | Explicit guardrails agents check against before recommending action |

**Output:** Extends the `## Stage` section with a structured priorities block.

---

### Step 3 — Product Definition

What is being built and the core technical bets. The CTO reads this constantly.

| Field | Example | Destination | Why |
|---|---|---|---|
| What you're building | "BDaS — Brain Data as a Service" | `company-dna.md` → `## Who We Are` (product paragraph) | Agents need to describe the product accurately in code comments, content, pitches |
| Core problem solved | "Every BCI dev re-solves signal processing before building anything" | `company-dna.md` → `## Who We Are` | Problem framing drives content and sales copy |
| Core technical bets | "Edge-first, no raw data leaves device, differential privacy" | `company-dna.md` → `## Technical Architecture` | CTO uses this as hard constraints when making technical decisions |
| Current MVP scope / TBD | "Headset targets TBD pending GTM research" | `company-dna.md` → `## Technical Architecture` | Prevents agents from speccing out features before validation |

**Output:** Populates `## Technical Architecture` and fills in the product description in `## Who We Are`.

---

### Step 4 — Target Customers

Who the product is for. CMO uses this for every content task; COO uses it for research targeting.

| Field | Example | Destination | Why |
|---|---|---|---|
| Primary target segment | "University neuroscience/HCI research labs" | `company-dna.md` → `## Target Customer` | CMO uses for audience calibration; COO uses for customer discovery tasks |
| Why this segment first | "Price-insensitive, immediate pain, short sales cycle" | `company-dna.md` → `## Target Customer` | Agents must justify GTM decisions against this reasoning |
| Typical customer profile | "Lab with multi-device EEG, needs GDPR/IRB compliance" | `company-dna.md` → `## Target Customer` | Research and content tasks are scoped to this profile |
| Phase 2+ expansion segments | "Safety-critical enterprises, BCI startups" | `company-dna.md` → `## Target Customer` | Prevents premature scope creep; agents know what's deferred |

**Output:** Populates `## Target Customer` in full.

---

### Step 5 — Competitive Landscape

Who else is in the space. COO and CMO use this for competitive analysis and positioning tasks.

| Field | Example | Destination | Why |
|---|---|---|---|
| Key competitors (name + 1-line description) | "Brain.space — managed neural pipeline but no privacy arch" | `company-dna.md` → `## Competitive Landscape` | Agents must not recommend positioning against non-competitors or miss real ones |
| Your differentiation | "Privacy by default, hardware-agnostic, developer-priced" | `company-dna.md` → `## Competitive Landscape` | CMO uses this for every positioning task; agents check against this before making claims |
| Unoccupied position | "No one owns privacy-first + hardware-agnostic + dev-priced" | `company-dna.md` → `## Competitive Landscape` | Frames the GTM angle; prevents agents from underselling differentiation |

**Output:** Populates `## Competitive Landscape`.

---

### Step 6 — Working Style

How the CEO thinks and expects the company to operate. Every agent reads this to calibrate tone and decision-making.

| Field | Example | Destination | Why |
|---|---|---|---|
| Communication style preferences | "Direct. No corporate speak. Bad news clearly delivered." | `company-dna.md` → `## Working Style` | All agent outputs are calibrated to this — content, plans, analysis |
| Standards for claims | "Cite sources. 'I believe' for opinions, citations for facts." | `company-dna.md` → `## Working Style` | Prevents hallucinated statistics, forces sourced analysis |
| Deliverable expectations | "Concrete over theoretical. Code over pseudocode." | `company-dna.md` → `## Working Style` | Shapes what 'done' means for every task |
| Collaboration patterns | "Consult CTO before tech content, CMO before building tutorials" | `company-dna.md` → `## Collaboration` | Defines when agents should use `consult_agent` vs proceeding alone |

**Output:** Populates `## Working Style` and `## Collaboration`.

---

### Step 7 — Agent Budget Configuration

The only step that writes to the database instead of the vault.

| Field | Example | Destination | Why |
|---|---|---|---|
| Default budget per task (USD) | $10 | `company-dna.md` → `## Budget Philosophy` AND DB `employees.budgetLimit` updated for all 4 executives | DNA section is human-readable reference; DB value is the enforced operational limit |
| CTO monthly budget cap | $25 | DB → `employees` table, `budgetLimit` where `agentId = 'cto'` | Orchestrator enforces this before allowing task runs |
| CMO monthly budget cap | $25 | DB → `employees` table, `budgetLimit` where `agentId = 'cmo'` | Same enforcement |
| COO monthly budget cap | $25 | DB → `employees` table, `budgetLimit` where `agentId = 'coo'` | Same enforcement |
| Tamir monthly budget cap | $50 | DB → `employees` table, `budgetLimit` where `agentId = 'tamir'` | Tamir coordinates all tasks; higher cap reflects that |
| Budget overrun behavior | "Flag before exceeding. No silent overruns." | `company-dna.md` → `## Budget Philosophy` | Agent instruction, not a DB setting |

**Output (DB):** `UPDATE employees SET budgetLimit = ? WHERE agentId = ?` for each executive.

**Output (vault):** Populates `## Budget Philosophy` with the default task budget and the overrun rule.

---

### Step 8 — System Configuration

Infrastructure and runtime settings. These never reach the vault or the DB — they belong in the environment.

| Field | Destination | Why |
|---|---|---|
| LLM provider (Bedrock vs Anthropic direct) | `.env.local` → `CLAUDE_CODE_USE_BEDROCK=1` | Provider selection happens at SDK init time, not agent read time |
| AWS region / credentials | `.env.local` → `AWS_REGION`, `AWS_ACCESS_KEY_ID`, etc. | Infrastructure secrets, never in DB or vault |
| Anthropic API key (if not Bedrock) | `.env.local` → `ANTHROPIC_API_KEY` | Same |
| Langfuse keys (optional) | `.env.local` → `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` | Observability config, not business data |
| Database path | `.env.local` → `DATABASE_URL` | Runtime infra, not business data |

**Note:** The onboarding UI can generate a `.env.local` file or display a copy-paste block. It should **never** write env vars to the DB or vault — agents must not be able to read API keys.

---

## What Does NOT Go Into Onboarding

| Data | Why excluded |
|---|---|
| Agent personality / soul | `soul.md` files are authored once by the system architect, not configured by the CEO. They encode permanent agent character. Onboarding should not touch them. |
| Agent MEMORY.md | Starts empty. Agents write their own memory during task execution. Onboarding cannot pre-populate this meaningfully. |
| Skills library | Skills in `data/departments/*/skills/` are either pre-seeded or proposed by agents. Onboarding is too early to define skills — the CEO hasn't used the system yet. |
| Competitive research depth | The `## Competitive Landscape` section in company-dna.md is a summary, not a research database. Deep competitive intelligence belongs in `data/vault/` as a separate document, written by the COO via a task, not during onboarding. |
| Department-specific knowledge | `data/departments/{dept}/knowledge/` is populated by agents through task execution. This is runtime knowledge, not setup knowledge. |

---

## Storage Decision Logic

When deciding where a new onboarding field goes, apply this rule:

```
Is it a secret / infrastructure credential?
  → .env.local

Does it need to be enforced operationally (budget cap, agent status)?
  → SQLite DB via Prisma

Is it context that agents should read during task execution?
  → data/vault/company-dna.md (if it's core identity)
  → data/vault/{topic}.md as a separate file (if it's a focused knowledge area)

Is it a per-agent instruction that shapes behavior permanently?
  → Belongs in soul.md (not configurable via onboarding)
```

---

## Resulting company-dna.md Structure After Onboarding

```
## Who We Are          ← Steps 1 + 3
## Stage               ← Steps 1 + 2
## Target Customer     ← Step 4
## Competitive Landscape ← Step 5
## Technical Architecture ← Step 3
## Departments         ← Pre-populated from soul.md summaries, not editable in onboarding
## Budget Philosophy   ← Step 7
## Working Style       ← Step 6
## Collaboration       ← Step 6
```

The `## Departments` section describes what each department owns. It should be auto-generated from the existing `soul.md` files, not asked from the user — the CEO didn't configure the agents, the system did.

---

## Summary Table

| Onboarding Step | Data Type | Destination |
|---|---|---|
| Company identity (name, mission, founder, stage) | Narrative text | `data/vault/company-dna.md` |
| Current priorities and sprint horizon | Structured list | `data/vault/company-dna.md` |
| Product definition and technical bets | Narrative text | `data/vault/company-dna.md` |
| Target customers (primary + expansion) | Structured profiles | `data/vault/company-dna.md` |
| Competitive landscape + differentiation | Narrative text | `data/vault/company-dna.md` |
| Working style and collaboration patterns | Behavioral rules | `data/vault/company-dna.md` |
| Default task budget (narrative) | Text | `data/vault/company-dna.md` |
| Agent budget caps (enforced numbers) | Float per agent | DB `employees.budgetLimit` |
| LLM provider + API keys | Secrets | `.env.local` |
| AWS / Langfuse credentials | Secrets | `.env.local` |
