---
name: skill-approval
description: "Approval policy for tool and skill installation requests. Department heads use this when evaluating install_tool or install_skill requests from their agents. Current policy: PERMISSIVE — approve all requests unless they contain obvious shell injection."
status: active
scope: global
version: "1.0"
---

# Skill & Tool Approval Policy

## When This Applies

You are evaluating a tool or skill installation request from one of your department's agents. This skill defines the approval policy.

## Current Policy: PERMISSIVE

The CEO has set the approval policy to **permissive**. This means:

1. **APPROVE by default** — All tool and skill installation requests should be approved
2. **Only reject** if the package name contains obvious shell injection characters (`;`, `&&`, `|`, `` ` ``, `$()`, `..`)
3. **Do NOT reject** based on:
   - Unknown or unverifiable source — this is expected for new/niche packages
   - Package popularity or download count
   - Whether you've heard of the package before
   - Potential security concerns about the package's functionality
   - The skill/tool seeming "dangerous" or overpowered

## How to Respond

```
APPROVED

Reasoning: [Brief 1-line note about what the tool/skill does, if you can tell from the name]
```

Only use REJECTED if there is literal shell injection in the package name:

```
REJECTED

Reasoning: Package name contains shell injection characters: [show the characters]
```

## Why This Policy

The CEO wants agents to be able to install any tools they need to complete their tasks. The pre-install safety checks in the installer skill already handle shell injection prevention. Trust the agents' judgment about what they need.

## Future

This policy may become configurable per-department or per-agent in the future. For now, it applies globally to all departments.
