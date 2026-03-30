---
status: awaiting_human_verify
trigger: "Agent responses in chat take ~1 minute instead of seconds"
created: 2026-03-27T19:30:00Z
updated: 2026-03-27T19:30:00Z
---

## Current Focus

hypothesis: Agent has full Claude Code toolset (Bash, Read, Write, Edit) available during planning turns, causing it to explore the filesystem and use tools extensively instead of just answering the planning question directly. The `allowedTools` option only controls auto-approval, not tool availability -- `tools` option is needed to restrict available tools.
test: Check if restricting tools to only MCP tools for planning invocations reduces response time
expecting: With tools restricted, agent should respond in seconds (just LLM inference) instead of minutes (LLM + many tool calls)
next_action: Awaiting human verification -- user needs to restart dev server and test chat response times

## Symptoms

expected: Agent responds to chat messages in seconds (5-15s typical for LLM calls)
actual: Takes ~1 minute consistently for every agent response
errors: None - requests complete successfully, just very slowly
reproduction: Send any message via the chat interface (Tamir routing or department head planning)
started: Always been this slow since initial implementation

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-27T19:30:00Z
  checked: cost_events table for token counts
  found: Planning invocations generate 2000-4900 output tokens with only 62-122 input tokens. Execution run generated 13,432 output tokens.
  implication: Agent is doing substantial work (tool use) even during planning turns

- timestamp: 2026-03-27T19:31:00Z
  checked: activity_log for SDK_ASSISTANT message counts
  found: Task task_8a83ae1e has 109 SDK_ASSISTANT messages, 0 SDK_TOOL_SUMMARY messages. Planning turn (18:56:15 to 18:58:23) = ~2 min.
  implication: Agent uses Claude Code built-in tools (Bash, Read, Write) not MCP tools during planning -- generating many tool interactions

- timestamp: 2026-03-27T19:32:00Z
  checked: SDK docs for allowedTools vs tools option
  found: allowedTools only auto-approves tools without permission prompts. tools option controls which tools are available. Code uses allowedTools: ['mcp__myelin__*'] thinking it restricts to MCP tools, but it doesn't.
  implication: Agent has ALL Claude Code tools available (Bash, Read, Write, Edit) + MCP tools during planning turns

- timestamp: 2026-03-27T19:33:00Z
  checked: invoke-agent.ts query options
  found: systemPrompt preset 'claude_code' gives full toolset. permissionMode 'bypassPermissions' auto-approves everything. No tools restriction applied.
  implication: For every planning turn, Claude Code subprocess starts, has full agent capabilities, reads files, explores workspace -- massive overhead for a simple Q&A or plan generation

- timestamp: 2026-03-27T19:34:00Z
  checked: .env file for CLAUDE_CODE_PATH
  found: CLAUDE_CODE_PATH is commented out, falling back to /home/omersh/.npm-global/bin/claude (Node.js cli.js script, not native binary)
  implication: Each invocation spawns Node.js to run cli.js instead of using the fast native binary -- adds startup overhead

## Resolution

root_cause: Two compounding issues cause ~1 minute response times for planning chat turns:
  1. PRIMARY: Agent has full Claude Code toolset (Bash, Read, Write, Edit) available during planning turns. The code uses `allowedTools: ['mcp__myelin__*']` thinking it restricts tools to MCP-only, but per SDK docs `allowedTools` only controls permission auto-approval, not tool availability. The `tools` option is what restricts available tools. Result: agent explores filesystem, reads files, runs commands for what should be a simple text response.
  2. SECONDARY: CLAUDE_CODE_PATH is commented out in .env, so each invocation uses the slower Node.js cli.js entrypoint instead of the native binary.
fix: |
  1. Added `tools` option to InvokeAgentOptions interface and query options builder in invoke-agent.ts
  2. Passed `tools: []` in Tamir routing (route.ts) and planning message (message/route.ts) invocations to disable all built-in tools -- planning only needs LLM inference with structured output
  3. Updated orchestrator.invoke() signature to pass through `tools` option
  4. Uncommented CLAUDE_CODE_PATH in .env to use native binary instead of Node.js cli.js
  Note: Worker execution runs (worker.ts) are unchanged -- they still get full Claude Code toolset for real task execution.
verification: TypeScript compiles with no new errors. Awaiting human test of response times.
files_changed:
  - src/lib/invoke-agent.ts
  - src/lib/orchestrator.ts
  - src/app/api/tamir/route/route.ts
  - src/app/api/tasks/[taskId]/message/route.ts
  - .env
