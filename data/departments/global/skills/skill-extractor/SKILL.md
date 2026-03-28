---
name: skill-extractor
description: "Extract reusable patterns from completed work into shareable skills. Use when you discover a novel tool combination, reusable workflow, domain insight, API integration pattern, or content template during task execution or supervisor review that would save time on similar future tasks."
status: active
scope: global
version: "1.0"
---

# Skill Extractor

## Goal

Capture reusable patterns from completed work so future agents can benefit. Every task is an opportunity to build institutional knowledge. When you discover something that would save time on similar future tasks, extract it into a skill that other agents can learn from.

## When to Trigger

### Executor Trigger

During task execution, when you notice a reusable pattern mid-work. Don't wait until the end -- capture while the context is fresh. If you think "a future agent doing something similar would benefit from knowing this," that's your trigger.

### Supervisor Trigger

After approving a deliverable, do a dedicated extraction pass. Review the executor's work with fresh eyes and look for patterns the executor might have missed. This is your second chance to capture institutional knowledge -- the executor was focused on completing the task, you can see the bigger picture.

## What Counts as Worth Extracting

Ask yourself: "Would I teach a new hire about this?" If yes, extract it.

**Extract these:**

- **Novel tool combination** that solved a problem elegantly (e.g., "use search_knowledge to find prior art before writing new knowledge files")
- **Reusable workflow** that would save time on similar future tasks (e.g., "EEG preprocessing pipeline: bandpass filter -> ICA -> epoch extraction -> feature matrix")
- **Domain insight** that would help future agents in this department (e.g., "BDaS customers care most about data privacy guarantees -- lead with that in all content")
- **API integration pattern** with specific endpoints, authentication method, error handling, and rate limits
- **Content template** that produced good results (e.g., "investor update format: metrics first, narrative second, ask last")

**Do NOT extract these:**

- **One-off task-specific logic** that won't recur (e.g., "for task_a1b2, the CEO wanted blue instead of green")
- **Standard library usage** documented elsewhere (e.g., "how to use fs.readFile")
- **Personal preferences or style choices** that aren't company conventions

## Extraction Procedure

### Step 1: Identify the Pattern

What would you teach a new hire about this? Articulate the insight in one sentence. If you can't summarize it concisely, it might not be a distinct skill -- it might be general knowledge.

### Step 2: Name It Descriptively

Use lowercase-kebab-case names that describe the capability:
- Good: `eeg-data-preprocessing`, `social-media-thread-format`, `investor-deck-structure`
- Bad: `useful-pattern`, `task-helper`, `misc-tips`

The name should tell an agent what the skill does without reading the content.

### Step 3: Write the SKILL.md Content

Follow the standard skill format:

```markdown
---
name: [skill-name]
status: pending
scope: [department or global]
version: "1.0"
---

# [Skill Name]

## Goal
[One sentence: what capability does this skill provide?]

## When to Trigger
[When should an agent apply this skill?]

## Procedure
1. [Step-by-step instructions]
2. [Be specific -- include tool names, file paths, API endpoints]
3. [Include expected outputs at each step]

## Edge Cases
- [What could go wrong and how to handle it]
```

### Step 4: Propose the Skill

Call `propose_skill` with:
- **name:** The kebab-case skill name
- **description:** One sentence describing what it does
- **content:** The full SKILL.md content from Step 3

The skill will be created with `status: pending` and enter the approval chain.

## Approval Chain

1. **Proposed** (status: pending) -- skill created by executor or supervisor
2. **Department head review** -- dept head evaluates relevance and quality
3. **CEO approval** -- CEO decides whether to activate for the department or globally
4. **Active** (status: active) -- skill is symlinked into agent workspaces

## Guidelines for Quality Skills

- **Be specific over general.** "How to query the BDaS API for real-time EEG streams" beats "How to use APIs."
- **Include real examples.** Show actual tool calls, file paths, or command patterns from the task where you discovered this.
- **State the why, not just the what.** "Use BM25 search before writing new knowledge to avoid duplicates" is better than "Search before writing."
- **Keep it actionable.** An agent should be able to follow the procedure without additional context.
- **One skill per pattern.** Don't bundle unrelated insights into a single skill.

## Edge Cases

- **Pattern seems too obvious:** If it took you non-trivial effort to figure out, it's worth capturing. "Obvious" to you now is not obvious to a fresh agent.
- **Pattern is department-specific vs. global:** Default to department scope. Propose as global only if agents across all departments would benefit.
- **Similar skill already exists:** Check existing skills in the department and global directories before proposing. If a similar skill exists, consider updating it instead of creating a duplicate.
- **Skill is rejected:** Not every proposal gets approved. Don't take it personally -- the CEO or dept head may have context you don't. Move on and keep extracting.
