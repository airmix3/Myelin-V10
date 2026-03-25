# Phase 1: Foundation Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 01-foundation-infrastructure
**Areas discussed:** Company DNA template, Worker loop polling

---

## Company DNA Template

| Option | Description | Selected |
|--------|-------------|----------|
| Full brief | Mission, product, stage, team, departments, working style | ✓ |
| Minimal starter | Just name, mission, departments — placeholders for user to fill | |
| User dictates content | Describe each section interactively | |

**User's choice:** Full brief

---

### DNA: Mission
| Option | Description | Selected |
|--------|-------------|----------|
| BDaS privacy-first layer | "Myelin builds BDaS — privacy-first BCI integration layer..." | ✓ |
| Broader neurotech mission | Include democratizing BCIs, EEG accessibility | |
| User provides exact text | Free-text input | |

### DNA: Working Style
| Option | Description | Selected |
|--------|-------------|----------|
| Technical precision | Rigorous, cite sources, prefer concrete deliverables | ✓ |
| Startup hustle | Move fast, ship early, validate quickly | |
| Balanced | Context-dependent per task type | |

### DNA: Stage Context
| Option | Description | Selected |
|--------|-------------|----------|
| Pre-seed sprint context | 300-day sprint, sole founder, AWS Bedrock, first customer validation | ✓ |
| Just the facts | Minimal: pre-seed, sole founder, neurotech | |
| Add more context | Include founder background details | |

### DNA: Department Scope
| Option | Description | Selected |
|--------|-------------|----------|
| Standard scope | Tech/CTO, Marketing/CMO, Operations/COO, Global | ✓ |
| Myelin-specific scope | Add BDaS-specific tasks per department | |
| Minimal | Just department names | |

### DNA: Budget Philosophy
| Option | Description | Selected |
|--------|-------------|----------|
| Default $10 per task | Agents flag if more needed before proceeding | ✓ |
| No mention of budget | Budget is CEO concern only | |
| Conservative $5 | Pre-seed consciousness, minimize token usage | |

### DNA: Privacy Principles
| Option | Description | Selected |
|--------|-------------|----------|
| Privacy-first mandate | Privacy baked into every agent decision | |
| Leave to task context | Per-task constraints handle privacy | ✓ |
| Product-level only | Only for CTO/BDaS work | |

### DNA: Collaboration Norms
| Option | Description | Selected |
|--------|-------------|----------|
| Consult before blocking | Use consult_agent rather than guessing | |
| Autonomous by default | Escalate only when required | |
| Collaborative first | Proactively consult relevant departments even when not required | ✓ |

---

## Worker Loop Polling

### Poll Interval
| Option | Description | Selected |
|--------|-------------|----------|
| 2 seconds | ~2s task pickup latency, low SQLite overhead | ✓ |
| 1 second | Near-instant pickup | |
| 5 seconds | Conservative | |

### Backoff Behavior
| Option | Description | Selected |
|--------|-------------|----------|
| No backoff | Fixed interval always | ✓ |
| Exponential backoff | Back off up to 30s on empty queue | |
| Wake on insert | Trigger-based wake | |

### Stale Run Threshold
| Option | Description | Selected |
|--------|-------------|----------|
| 2 minutes | ~8 missed heartbeats | ✓ |
| 1 minute | ~4 missed heartbeats | |
| 5 minutes | ~20 missed heartbeats | |

### Shutdown Behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Mark as failed on startup | Any executing runs become failed immediately | ✓ |
| Allow resume | Try to resume with stored session_id + cwd | |
| Re-queue | Mark as queued to retry from scratch | |

---

## Claude's Discretion

- Full Prisma schema column definitions (user explicitly skipped this area)
- Worker concurrency claim SQL implementation
- FTS5 trigger SQL details

## Deferred Ideas

None
