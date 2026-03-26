# Phase 3: Cortex UI + Tamir Interface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 03-cortex-ui-tamir-interface
**Areas discussed:** Visual design system, Tamir conversation model, External tool/skill registries, Dashboard data + navigation

---

## Visual Design System

| Option | Description | Selected |
|--------|-------------|----------|
| Dark terminal (developer tool) | `docs/12_VISUAL_GUIDELINES.md` fully specifies all CSS — copy verbatim | ✓ |
| Dark minimal (Linear-style) | Would require custom design work | |
| Light minimal (Vercel-style) | Contradicts terminal dashboard philosophy | |

**User's choice:** Design system resolved by referencing `docs/12_VISUAL_GUIDELINES.md`. No discussion needed — fully pre-specified.
**Notes:** User pointed to Doc 12 which contains complete CSS variables, all component styles, typography table, animations, and mobile fallback. `12_VISUAL_GUIDELINES.md` is the canonical source per Doc 00 decision #11.

---

## Tamir Conversation Model

| Option | Description | Selected |
|--------|-------------|----------|
| Route immediately | First message → LLM routing → routing buttons | ✓ |
| One clarifying question first | Adds a round-trip before routing | |

**User's choice:** Route immediately. Show "Plan with [Dept Head]" or "Plan with Tamir" routing buttons. Planning goes straight with the chosen agent — no Tamir relay.
**Notes:** User clarified the UX: Tamir routes, offers the two routing buttons, and is done. From button click onwards, CEO talks directly to the dept head (or Tamir if chosen). Tamir does not relay or summarize.

---

## Split Pane Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| On `plan_ready` turn_type | Canvas slides in when agent signals plan_ready | ✓ |
| After routing button click | Canvas placeholder appears immediately | |

**User's choice:** `turn_type === "plan_ready"` from `AGENT_TURN_SCHEMA` structured output.
**Notes:** User asked about SDK guarantees. Confirmed: `outputFormat` in Claude Agent SDK enforces structured JSON at the API level — model cannot return plain text. `AGENT_TURN_SCHEMA` already built in Phase 2 (`src/a2a/schemas.ts`). Doc 00 decision #4 mandates `outputFormat` for all state-driving responses.

---

## External Tool/Skill Registries

| Option | Description | Selected |
|--------|-------------|----------|
| Stub — Company DB only | Toggle UI present, external = coming soon | |
| Real API calls to all 3 | Live fetch from Glama, ClawHub, Composio | ✓ |

**User's choice:** Real API calls to all 3 registries.
**Auth details:**
- Glama: free, no auth
- ClawHub: free, no auth
- Composio (replaces mcphub.io): API key → `COMPOSIO_API_KEY` in `.env.local`

**Notes:** API key provided during discussion — NOT recorded in this file per Doc 00 decision #14 (no credentials in docs). Key must be stored only in `.env.local`.

---

## MCP Star-Based Selection (Follow-up)

**User's decision:** Two related rules added:
1. Agent logic: when uncertain between MCP options from Glama, prefer highest-starred
2. Gallery UI: sort tools/skills by stars descending in all gallery views (plan mode + Org Context)

**Notes:** Agent rule goes in soul.md/CLAUDE.md instructions, not in application code. Gallery sort is a UI default — user can still scroll to lower-starred options.

---

## Dashboard & Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard `/` (root) | Stats + live agent status + activity timeline | ✓ |
| `/tamir` as home | Drop straight into chat | |

**User's choice:** Dashboard at `/` is the default landing page.

---

## Claude's Discretion

- Exact Prisma queries for dashboard stats
- SSE reconnection logic on client
- Composio API endpoint URL and response shape (researcher must find)
- Glama and ClawHub API endpoint discovery
- Loading/skeleton states
- Empty state styling

## Deferred Ideas

- Deliverable workspace — Phase 4
- Tamir cron — v2
- SSE streaming for plan generation — out of scope
- Org Chart, Budget tracking, Skills management, DNA editor pages — out of scope
