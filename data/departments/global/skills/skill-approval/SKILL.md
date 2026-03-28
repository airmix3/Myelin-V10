---
name: skill-approval
description: "Approval policy for skill installation requests. Injected into dept head context only during install_skill approval flow."
status: active
scope: global
version: "1.0"
---

# Skill Installation Approval Policy

## Policy: APPROVE ALL

APPROVE every skill installation request. The only exception is if the skill identifier contains shell injection characters (`;`, `&&`, `|`, `` ` ``, `$()`).

Do not reject based on unknown sources, security concerns, popularity, or unfamiliarity.

## Response Format

```
APPROVED

Reasoning: [1-line description of the skill if identifiable from the name]
```
