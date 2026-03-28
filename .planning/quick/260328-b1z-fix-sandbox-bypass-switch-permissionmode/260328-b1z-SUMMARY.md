---
plan: 260328-b1z
status: complete
started: 2026-03-28T04:10:00Z
completed: 2026-03-28T04:15:00Z
duration: 5min
---

## One-liner

Fixed sandbox bypass — permissionMode: bypassPermissions skipped canUseTool, agents could access files outside workspace

## Root Cause

`invoke-agent.ts` used `permissionMode: 'bypassPermissions'` which tells the SDK to skip ALL permission checks, including the `canUseTool` callback. This meant the Phase 06 filesystem sandbox (isPathAllowed, workspace boundary enforcement) was never actually called.

Agents could Read, Glob, Grep anywhere on the filesystem despite the sandbox code being in place.

## Fix

Changed `permissionMode` from `'bypassPermissions'` to `'acceptEdits'`:
- `acceptEdits` auto-approves tool executions without interactive prompts (headless-friendly)
- But still calls `canUseTool` before each tool execution — our sandbox callback runs
- No latency impact — callback is in-process path comparison

Also removed `allowDangerouslySkipPermissions: true` (only needed for bypassPermissions).
Added deny logging to access-control.ts for observability.

## Key Files

- `src/lib/invoke-agent.ts` — permissionMode: 'acceptEdits' (was 'bypassPermissions')
- `src/lib/mcp/access-control.ts` — added logger + deny logging
