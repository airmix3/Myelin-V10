# Phase 2: Agent Execution Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 02-agent-execution-layer
**Areas discussed:** Validation spike, Agent soul.md design, Global skills, Hire approval API ownership

---

## Validation Spike

| Option | Description | Selected |
|--------|-------------|----------|
| Spike first, then full build | Plan 1 is throwaway spike code (~50 lines), validates model, then Plans 2-3 build real system | |
| Build confidently, no spike | Requirements detailed enough, build directly | |
| Spike embedded in Plan 1 | Plan 1 produces real production code for invokeAgent() + MCP + 3-4 tools, validates while shipping | ✓ |

**User's choice:** Spike embedded in Plan 1
**Notes:** User initially leaned toward "build directly" before understanding what a spike is. After explanation, chose spike-embedded approach.

---

## Agent soul.md Design

### Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Comprehensive guides (2-4 pages) | Persona, tone, decision philosophy, cross-dept behavior, tool patterns | ✓ |
| Tight personas (~1 page) | Name, role, core directives, key behaviors | |
| Minimal — role + constraints only | Just enough to prevent misuse | |

**User's choice:** Comprehensive guides

### Tamir's voice

| Option | Description | Selected |
|--------|-------------|----------|
| Sharp operator, no fluff | Gets to the point, respects time, minimal | |
| Sharp operator but elaborative (customized) | Direct + substantive — gives the answer AND reasoning, no padding | ✓ |
| Trusted advisor, collaborative | Thinks out loud, more like a thought partner | |
| Formal chief of staff | Professional, structured, briefing-style | |

**User's choice:** "Answer 1 but more elaborative" — sharp and direct, but when Tamir speaks it's substantive, not curt.

### CTO/CMO/COO voice

| Option | Description | Selected |
|--------|-------------|----------|
| Domain experts, opinionated | Strong opinions, push back, think in domain tradeoffs | ✓ |
| Efficient executors | Focused on delivery, less strategic commentary | |

**User's choice:** Domain experts, opinionated

### Agent names

| Option | Description | Selected |
|--------|-------------|----------|
| Role titles only for now | CTO, CMO, COO | ✓ |
| Real names, user chooses | Named executives | |
| Claude decides names | Claude picks fitting names | |

**User's choice:** Role titles only for now

---

## Global Skills

### Skill depth

| Option | Description | Selected |
|--------|-------------|----------|
| Step-by-step with why/goal | Procedures + clear reasoning | ✓ |
| High-level framing | Why and goal, agent figures out how | |
| Minimal — trigger + one-liner | Just when to use, rest from soul.md | |

**User's choice:** "Step-by-step but also with clear why and goal"

### memory-management — when to write

| Option | Description | Selected |
|--------|-------------|----------|
| Start + end every task | Consistent, always on | |
| Agent's discretion | Agent decides when meaningful | ✓ |
| Only on significant events | Read on start, write only with criteria | |

**User's choice:** Agent's discretion. Added specific MEMORY.md structure: recent projects (with paths), company conventions, goals.

### skill-extractor — who triggers

| Option | Description | Selected |
|--------|-------------|----------|
| After every task (supervisor) | Supervisor always runs extraction pass | |
| Executor decides, not supervisor | Executor calls propose_skill during task | |
| Both executor + supervisor | Executor mid-task + supervisor after approval | ✓ |

**User's choice:** Initially said "executor only" but then confirmed "both" when the DELIV-08 conflict was flagged.

### system-reset — who and how

| Option | Description | Selected |
|--------|-------------|----------|
| CEO via Tamir, vault+DNA+skills survive | Standard preservation, no configurable | |
| Direct API call only | /api/system/reset, no agent | |
| CEO via Tamir, ask what to preserve | Tamir asks what to preserve per reset | ✓ |

**User's choice:** CEO via Tamir, ask what to preserve

### system-reset safety gates

| Option | Description | Selected |
|--------|-------------|----------|
| Show summary + require explicit confirm | Summary of what will be deleted, CEO confirms | ✓ |
| Ask what to preserve, execute immediately | No summary, just preservation question | |
| Just execute, no gates | Trust the CEO, instant reset | |

**User's choice:** Show summary, require explicit confirm

---

## Hire Approval API Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 2 builds API, Phase 3 adds button | Business logic with agent layer | ✓ |
| Phase 3 builds both API and button | All UI-adjacent routes in Phase 3 | |
| Phase 4 builds both | Ships with deliverable workspace | |

**User's choice:** Phase 2 builds the API, Phase 3 adds the button

---

## Claude's Discretion

- Exact MCP server wiring pattern inside invokeAgent()
- CTO/CMO/COO soul.md content beyond persona direction
- Cost event schema details
- skill-extractor criteria specifics

## Deferred Ideas

- consult_agent tool — v2 (COORD-01)
- Tamir 15-minute cron — v2 (COORD-02)
- Named personas for CTO/CMO/COO — user will add later
