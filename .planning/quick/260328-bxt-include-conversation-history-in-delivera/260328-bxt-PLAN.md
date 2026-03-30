---
phase: quick-260328-bxt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/api/deliverables/[id]/chat/route.ts
autonomous: true
must_haves:
  truths:
    - "Deliverable chat agent receives full conversation history and task context"
    - "Follow-up questions after execution get contextual responses"
  artifacts:
    - path: "src/app/api/deliverables/[id]/chat/route.ts"
      provides: "Context-enriched deliverable chat invocation"
  key_links:
    - from: "src/app/api/deliverables/[id]/chat/route.ts"
      to: "task.chatFilePath"
      via: "readFileSync to load JSONL history"
      pattern: "readFileSync.*chatFilePath"
---

<objective>
Enrich deliverable chat agent invocations with conversation history, task context, and plan markdown so agents can give meaningful follow-up responses after task execution.

Purpose: Currently the deliverable chat passes only the raw user message to the agent, giving it zero context about what was planned, discussed, or executed. This makes post-execution follow-up useless.

Output: Updated route handler that builds a context-rich prompt mirroring the planning flow pattern.
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/api/deliverables/[id]/chat/route.ts
@src/app/api/tasks/[taskId]/message/route.ts (reference pattern for building context-rich prompts)
</context>

<interfaces>
<!-- From src/app/api/tasks/[taskId]/message/route.ts — the pattern to replicate -->
<!-- Lines 69-83: Follow-up turn builds chatHistory from JSONL, wraps in sections -->

From the existing chat route, the task object includes:
```typescript
task.chatFilePath   // path to JSONL chat history
task.title          // task title
task.description    // task description
task.planMarkdown   // approved plan (may be null)
task.currentActorId // agent to route to
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Build context-rich prompt for deliverable chat</name>
  <files>src/app/api/deliverables/[id]/chat/route.ts</files>
  <action>
Modify the POST handler to build a context-rich prompt instead of passing bare `message` to `orchestrator.invoke()`. Follow the pattern established in `src/app/api/tasks/[taskId]/message/route.ts` lines 69-83.

1. Add `readFileSync, existsSync` to the `fs` import (already has `appendFileSync`).

2. After the user message is appended to the JSONL file (line 45) and before the orchestrator.invoke call (line 60), build the enriched prompt:

```typescript
// Build context-rich prompt for follow-up chat
const chatHistory = task.chatFilePath && existsSync(task.chatFilePath)
  ? readFileSync(task.chatFilePath, 'utf-8').trim().split('\n').filter(Boolean).slice(-20).map(l => {
      try {
        const e = JSON.parse(l) as { role: string; content?: string; planMarkdown?: string; turnType?: string };
        if (e.planMarkdown) return `${e.role === 'user' ? 'CEO' : 'Agent'}: [plan attached]`;
        return `${e.role === 'user' ? 'CEO' : 'Agent'}: ${(e.content || '').substring(0, 500)}`;
      } catch { return ''; }
    }).filter(Boolean).join('\n')
  : '';

const enrichedPrompt = [
  `## Task Context\n**Title:** ${task.title}\n**Description:** ${task.description || task.title}`,
  task.planMarkdown ? `## Approved Plan\n${task.planMarkdown.substring(0, 2000)}` : '',
  chatHistory ? `## Conversation History\n${chatHistory}` : '',
  `## CEO's Latest Message\n${message}`,
  `\n## Instructions\nYou are in FOLLOW-UP MODE. The task has been planned and executed. The CEO is asking a follow-up question about the deliverable or requesting changes. Answer based on the task context, plan, and conversation history above. Be specific and actionable.`,
].filter(Boolean).join('\n\n');
```

3. Replace `prompt: message` on line 64 with `prompt: enrichedPrompt`.

4. Include the task with its full fields by updating the prisma query on line 30 — no change needed since `task` already comes from `deliverable.task` which is included. But verify that `task.planMarkdown` and `task.description` are available (they are standard Task model fields).

Key details:
- Use last 20 messages (not 10 like planning) since deliverable chat includes both planning AND execution history
- Truncate plan markdown to 2000 chars to avoid blowing context budget
- Truncate individual message content to 500 chars (slightly more than planning's 400 since these are more detailed)
- Keep the same JSONL parsing pattern as the planning route for consistency
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit src/app/api/deliverables/[id]/chat/route.ts 2>&1 | head -20</automated>
  </verify>
  <done>
    - Deliverable chat route builds enriched prompt with task title, description, plan markdown, and last 20 conversation messages
    - Raw `message` is no longer passed directly to orchestrator.invoke
    - TypeScript compiles without errors
    - Pattern matches the established planning route convention
  </done>
</task>

</tasks>

<verification>
1. TypeScript compilation passes for the modified file
2. The enriched prompt includes all four sections: Task Context, Approved Plan, Conversation History, CEO's Latest Message
3. The Instructions section clearly states FOLLOW-UP MODE context
</verification>

<success_criteria>
Agent invocations from the deliverable chat route include full conversation history and task context, enabling meaningful follow-up responses after task execution.
</success_criteria>

<output>
After completion, create `.planning/quick/260328-bxt-include-conversation-history-in-delivera/260328-bxt-SUMMARY.md`
</output>
