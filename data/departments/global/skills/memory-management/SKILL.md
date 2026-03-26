---
name: memory-management
status: active
scope: global
version: "1.0"
---

# Memory Management

## Goal

Maintain a useful personal memory that helps you pick up context between tasks. Your MEMORY.md is your employee journal -- it bridges the gap between task invocations so you don't start every task from scratch.

## When to Trigger

- **Read MEMORY.md** at the **START** of every task. This is non-negotiable -- always load your context first.
- **Write MEMORY.md** at the **END** of a task, but **only when something genuinely new was learned or changed**. Not every task produces new knowledge. Use your discretion -- if nothing meaningful happened, skip the write.

## MEMORY.md Format

Your MEMORY.md is a structured employee journal with 4 sections. Keep it readable -- these are your personal notes, not a database dump.

### Section 1: Recent Projects

```markdown
## Recent Projects

### [Task description] (task_xxxx, 2026-03-25)
- **Deliverable:** data/workspaces/task_xxxx/deliverables/report.md
- **Knowledge written:** data/departments/tech/knowledge/eeg-preprocessing-notes.md
- **Key outcome:** Built SVM classifier with 87% accuracy on motor imagery dataset
```

Each entry should have: task description, deliverable path, knowledge files written, and a brief outcome. A future you should be able to pick up context from this section alone.

### Section 2: Company Conventions

```markdown
## Company Conventions

- CEO prefers all research deliverables to cite sources with links
- CTO favors async patterns over sync where possible
- Marketing content should reference BDaS value proposition in first paragraph
- Code deliverables must include inline comments explaining non-obvious decisions
```

Patterns and decisions discovered during work. Things that aren't written down anywhere else but affect how you should operate.

### Section 3: Goals

```markdown
## Goals

- Complete 300-day sprint deliverables on schedule
- BDaS demo ready for investor meetings by Q2
- Build EEG data pipeline for real-time classification
```

Active company objectives relevant to your department. Updated when priorities shift.

### Section 4: Notes

```markdown
## Notes

- The AWS Bedrock endpoint occasionally returns 503 during peak hours -- retry logic handles it
- Dataset at s3://myelin-data/eeg-motor-imagery/ has 12 subjects, 3 sessions each
- Tamir prefers concise status updates over detailed reports
```

Anything else worth remembering that doesn't fit the other sections.

## Reading Procedure

1. Call the `read_memory` tool to load your current MEMORY.md
2. If the result is empty, this is your first task -- no context to load, proceed fresh
3. Scan Recent Projects for relevant prior work on similar topics
4. Check Company Conventions for any patterns that apply to this task
5. Note any active Goals that this task contributes to
6. Proceed with the task, keeping loaded context in mind

## Writing Procedure

1. At the end of your task, evaluate: did I learn something new? Did something change?
2. If yes: call `read_memory` to get the current state (it may have been updated by another invocation)
3. Update only the relevant section(s):
   - New task completed? Add to Recent Projects (keep last 10-15 entries, archive older ones)
   - Discovered a convention? Add to Company Conventions
   - Goals shifted? Update Goals section
   - Random useful fact? Add to Notes
4. Call `write_memory` with the full updated content
5. Do NOT rewrite the entire file -- preserve existing entries and append or update

## Edge Cases

- **MEMORY.md is empty:** Normal for first task. Proceed without context, write your first entry at the end.
- **MEMORY.md is corrupted or nonsensical:** Start fresh. Write a clean MEMORY.md with whatever you know from the current task.
- **Unsure whether something is worth remembering:** Err on the side of recording it. You can always clean up later. A slightly verbose memory is better than a gap in context.
- **Multiple tasks completed rapidly:** Each task reads the latest state. If entries overlap, consolidate during your write step.
- **MEMORY.md is very long:** Keep Recent Projects to the last 10-15 entries. Move older entries to a brief "Archive" line at the bottom (e.g., "12 earlier projects archived"). Conventions and Goals should stay concise.
