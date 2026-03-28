---
phase: quick-260328-oqj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - data/departments/global/skills/memory-management/SKILL.md
  - data/departments/global/skills/skill-extractor/SKILL.md
  - data/departments/global/skills/system-reset/SKILL.md
  - data/departments/cos/skills/installer/SKILL.md
  - data/departments/cos/skills/skill-tool-manager/SKILL.md
autonomous: true
requirements: [QUICK-OQJ]
must_haves:
  truths:
    - "All 5 SKILL.md files have a description field in YAML frontmatter"
    - "Descriptions are rich and actionable — explain what the skill does AND when to use it"
    - "seed-gallery.ts reads non-empty description for each skill"
  artifacts:
    - path: "data/departments/global/skills/memory-management/SKILL.md"
      contains: "description:"
    - path: "data/departments/global/skills/skill-extractor/SKILL.md"
      contains: "description:"
    - path: "data/departments/global/skills/system-reset/SKILL.md"
      contains: "description:"
    - path: "data/departments/cos/skills/installer/SKILL.md"
      contains: "description:"
    - path: "data/departments/cos/skills/skill-tool-manager/SKILL.md"
      contains: "description:"
  key_links:
    - from: "SKILL.md frontmatter"
      to: "src/lib/seed-gallery.ts"
      via: "gray-matter parsed.data.description"
      pattern: "description:"
---

<objective>
Add a `description` field to the YAML frontmatter of all 5 global and cos SKILL.md files so the gallery UI displays meaningful skill descriptions instead of empty strings.

Purpose: seed-gallery.ts reads `parsed.data.description` from frontmatter and stores it in the DB `skills.description` column, which is displayed on gallery cards in org-context. Currently all 5 skills return empty string because the field is missing.

Output: 5 updated SKILL.md files with rich description fields matching Anthropic skill format conventions.
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@data/departments/global/skills/memory-management/SKILL.md
@data/departments/global/skills/skill-extractor/SKILL.md
@data/departments/global/skills/system-reset/SKILL.md
@data/departments/cos/skills/installer/SKILL.md
@data/departments/cos/skills/skill-tool-manager/SKILL.md
@src/lib/seed-gallery.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add description field to all 5 SKILL.md frontmatter blocks</name>
  <files>
    data/departments/global/skills/memory-management/SKILL.md
    data/departments/global/skills/skill-extractor/SKILL.md
    data/departments/global/skills/system-reset/SKILL.md
    data/departments/cos/skills/installer/SKILL.md
    data/departments/cos/skills/skill-tool-manager/SKILL.md
  </files>
  <action>
    Add a `description` field to the YAML frontmatter of each SKILL.md file, placed after the `name` field. The description should be a single rich sentence that explains what the skill does AND when/why to use it (trigger scenarios), following the Anthropic skill format convention.

    Use these exact descriptions:

    1. **memory-management/SKILL.md**: Add after `name: memory-management`:
       `description: "Persistent agent memory journal using MEMORY.md. Use at the start of every task to load prior context (recent projects, conventions, goals) and at the end to record new knowledge, patterns, or outcomes worth remembering across invocations."`

    2. **skill-extractor/SKILL.md**: Add after `name: skill-extractor`:
       `description: "Extract reusable patterns from completed work into shareable skills. Use when you discover a novel tool combination, reusable workflow, domain insight, API integration pattern, or content template during task execution or supervisor review that would save time on similar future tasks."`

    3. **system-reset/SKILL.md**: Add after `name: system-reset`:
       `description: "Safely reset the system to a clean state while preserving vault documents, approved skills, and permanent employees. Use only when the CEO explicitly requests a system reset, clean slate, or fresh start through Tamir — this is a destructive admin operation, not a business task."`

    4. **installer/SKILL.md**: Add after `name: installer`:
       `description: "Install MCP tool servers via Smithery CLI and skill packages via skills.sh CLI into department directories. Use when agents request new tools or skills mid-task and their department head has approved the installation — handles pre-install checks, execution, and post-install verification."`

    5. **skill-tool-manager/SKILL.md**: Add after `name: skill-tool-manager`:
       `description: "Manage installed skills and tools across departments — refresh (re-install/update to latest) or remove (uninstall and clean up). Use when the gallery UI triggers a refresh or remove action on a department's installed skill or tool."`

    Do NOT change any other content in these files. Only insert the `description:` line into the existing frontmatter block.
  </action>
  <verify>
    <automated>grep -c "^description:" data/departments/global/skills/memory-management/SKILL.md data/departments/global/skills/skill-extractor/SKILL.md data/departments/global/skills/system-reset/SKILL.md data/departments/cos/skills/installer/SKILL.md data/departments/cos/skills/skill-tool-manager/SKILL.md | grep -v ":0$" | wc -l</automated>
    All 5 files should show count of 1 (output: 5)
  </verify>
  <done>All 5 SKILL.md files have a description field in YAML frontmatter with rich, actionable descriptions that explain what the skill does and when to trigger it. seed-gallery.ts will read non-empty strings for all skills.</done>
</task>

</tasks>

<verification>
- `grep "^description:" data/departments/global/skills/*/SKILL.md data/departments/cos/skills/*/SKILL.md` returns 5 matches
- Each description is a non-empty string in quotes
- No other content in the files was modified (frontmatter structure preserved)
</verification>

<success_criteria>
All 5 SKILL.md files contain a `description` field in their YAML frontmatter. Running seed-gallery.ts would populate non-empty descriptions in the skills DB table and gallery UI cards.
</success_criteria>

<output>
After completion, create `.planning/quick/260328-oqj-add-description-field-to-all-global-and-/260328-oqj-SUMMARY.md`
</output>
