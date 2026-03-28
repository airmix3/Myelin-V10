---
phase: quick-260328-ofg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/api/org-context/[dept]/route.ts
  - src/app/api/org-context/[dept]/skills/[skillId]/refresh/route.ts
  - src/app/api/org-context/[dept]/skills/[skillId]/remove/route.ts
  - src/app/api/org-context/[dept]/tools/[toolName]/refresh/route.ts
  - src/app/api/org-context/[dept]/tools/[toolName]/remove/route.ts
  - src/app/org-context/page.tsx
  - data/departments/cos/skills/skill-tool-manager/SKILL.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Department page shows installed skills and tools in separate tabs"
    - "Each gallery card has refresh and remove icon buttons in top-right corner"
    - "Clicking refresh invokes CoS (Tamir) in background to update the item"
    - "Clicking remove invokes CoS (Tamir) to uninstall and stop running instances (tools)"
    - "Tamir has a skill explaining how to manage (update/remove) skills and tools"
  artifacts:
    - path: "src/app/org-context/page.tsx"
      provides: "Tabbed gallery UI for department skills and tools"
    - path: "src/app/api/org-context/[dept]/skills/[skillId]/refresh/route.ts"
      provides: "Skill refresh API endpoint"
    - path: "src/app/api/org-context/[dept]/tools/[toolName]/remove/route.ts"
      provides: "Tool remove API endpoint"
    - path: "data/departments/cos/skills/skill-tool-manager/SKILL.md"
      provides: "CoS skill for managing installed skills/tools"
  key_links:
    - from: "src/app/org-context/page.tsx"
      to: "/api/org-context/{dept}/skills/{id}/refresh"
      via: "fetch POST on refresh button click"
    - from: "refresh/remove API routes"
      to: "src/lib/invoke-agent.ts"
      via: "invokeAgent() with Tamir + skill-tool-manager skill"
---

<objective>
Add a department-level skills and tools gallery to the Org Context page with refresh/remove actions that delegate to Tamir (Chief of Staff).

Purpose: Give the CEO visibility and control over installed skills and tools per department. Prevent orphaned MCP server processes by providing managed removal. Delegation to Tamir keeps management logic in a skill (not hardcoded in API routes).

Output: Updated org-context page with tabbed gallery, 4 new API routes, 1 new CoS skill.
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/org-context/page.tsx
@src/app/api/org-context/[dept]/route.ts
@src/lib/mcp/tools/install.ts
@src/lib/invoke-agent.ts
@data/departments/cos/skills/installer/SKILL.md
@prisma/schema.prisma
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create CoS skill-tool-manager skill + API routes for refresh/remove</name>
  <files>
    data/departments/cos/skills/skill-tool-manager/SKILL.md
    src/app/api/org-context/[dept]/route.ts
    src/app/api/org-context/[dept]/skills/[skillId]/refresh/route.ts
    src/app/api/org-context/[dept]/skills/[skillId]/remove/route.ts
    src/app/api/org-context/[dept]/tools/[toolName]/refresh/route.ts
    src/app/api/org-context/[dept]/tools/[toolName]/remove/route.ts
  </files>
  <action>
    1. Create `data/departments/cos/skills/skill-tool-manager/SKILL.md`:
       - YAML frontmatter: name: skill-tool-manager, status: active, scope: global, version: "1.0"
       - Goal: You manage installed skills and tools across departments. You handle refresh (re-install/update to latest version) and removal (uninstall and clean up).
       - When to Trigger: You receive a management prompt from the system (via the department gallery API). Never self-trigger.
       - Context You Receive section: department, item type (skill/tool), item name/id, action (refresh/remove), file path or directory
       - Refresh Procedure:
         - For skills: cd to the skill's parent directory, run `npx skills add <owner/repo> --skill '<Display Name>' --yes` (overwrites existing)
         - For tools: cd to the department tools directory, run `npx @smithery/cli mcp add <package_name> --client claude-code` (overwrites existing)
       - Remove Procedure:
         - For tools: Check if any MCP server process is running for this tool (`ps aux | grep <tool_name>`), kill if found. Then `rm -rf` the tool directory in `data/departments/{dept}/tools/{tool_name}`. Also remove from package.json dependencies if present.
         - For skills: `rm -rf` the skill directory in `data/departments/{dept}/skills/{skill_name}`. Remove the skill record from the database is handled by the API.
       - Failure Handling: same pattern as installer skill (report exact error, no auto-retry)

    2. Update `src/app/api/org-context/[dept]/route.ts`:
       - Add scanning of `data/departments/{dept}/tools/` directory to find installed tool directories
       - For each tool dir, read package.json if present to get name/description, or just return directory name
       - Return tools in the response alongside existing skills data: `{ employees, agentMemories, agentCards, knowledgeFiles, skills, tools }` where tools is `Array<{ name: string; directory: string; description?: string }>`

    3. Create 4 API route files (all POST, same pattern):
       - Each validates `dept` param (tech/marketing/operations), returns 400 if invalid
       - Each invokes Tamir via `invokeAgent()` with:
         - agentId: 'tamir', department: 'cos'
         - deskDir: `data/departments/cos`
         - prompt referencing the skill-tool-manager skill procedure
         - maxBudgetUsd: 1
         - tools: { type: 'preset', preset: 'claude_code' }
         - Generate a task-less runId via `generateId('run')`
       - For Tamir invocation without a real taskId: use a synthetic taskId like `sys-manage-${Date.now()}` (the invoke-agent cost tracking try/catch handles missing tasks gracefully per bug fix #4 in MEMORY.md)
       - Return 200 with `{ success: true, message }` or 500 with error

       Specific prompts for each:
       - **skills/[skillId]/refresh**: "Follow your skill-tool-manager skill. Refresh skill: {skill.name} at path {skill.filePath}. Department: {dept}."
       - **skills/[skillId]/remove**: "Follow your skill-tool-manager skill. Remove skill: {skill.name} at path {skill.filePath}. Department: {dept}." After Tamir completes, delete the skill record from DB via `prisma.skill.delete({ where: { id: skillId } })`.
       - **tools/[toolName]/refresh**: "Follow your skill-tool-manager skill. Refresh tool: {toolName} in directory data/departments/{dept}/tools/. Department: {dept}."
       - **tools/[toolName]/remove**: "Follow your skill-tool-manager skill. Remove tool: {toolName} from directory data/departments/{dept}/tools/{toolName}/. Stop any running MCP server processes for this tool. Department: {dept}."

       Import pattern (match existing install.ts):
       ```typescript
       import { invokeAgent } from '@/lib/invoke-agent';
       import { generateId } from '@/lib/id';
       import { prisma } from '@/lib/db';
       import { resolve } from 'path';
       ```
       Get Tamir soul.md via orchestrator: `const { orchestrator } = await import('@/lib/orchestrator'); const tamirAgent = orchestrator.getAgent('tamir');`
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - skill-tool-manager SKILL.md exists at data/departments/cos/skills/skill-tool-manager/SKILL.md
    - org-context API returns tools array from disk scan
    - 4 API routes exist and compile: refresh/remove for both skills and tools
    - All routes invoke Tamir via invokeAgent with skill-tool-manager prompt
  </done>
</task>

<task type="auto">
  <name>Task 2: Update org-context gallery UI with tabs and refresh/remove actions</name>
  <files>
    src/app/org-context/page.tsx
  </files>
  <action>
    Replace the existing "Tools + Skills Gallery" section in `src/app/org-context/page.tsx` with a proper tabbed gallery:

    1. Add to interfaces at top of file:
       ```typescript
       interface DeptTool {
         name: string;
         directory: string;
         description?: string;
       }
       ```
       Update DeptData interface to add `tools: DeptTool[]`.

    2. Add state for the gallery sub-tabs:
       ```typescript
       const [galleryTab, setGalleryTab] = useState<'skills' | 'tools'>('skills');
       const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks which item has action in progress
       ```

    3. Add handler functions:
       ```typescript
       async function handleSkillRefresh(skillId: string) {
         setActionLoading(`skill-refresh-${skillId}`);
         try {
           await fetch(`/api/org-context/${activeDept}/skills/${skillId}/refresh`, { method: 'POST' });
           // Refresh data
           const res = await fetch(`/api/org-context/${activeDept}`);
           if (res.ok) setData(await res.json());
         } finally {
           setActionLoading(null);
         }
       }

       async function handleSkillRemove(skillId: string) {
         if (!confirm('Remove this skill from the department?')) return;
         setActionLoading(`skill-remove-${skillId}`);
         try {
           await fetch(`/api/org-context/${activeDept}/skills/${skillId}/remove`, { method: 'POST' });
           const res = await fetch(`/api/org-context/${activeDept}`);
           if (res.ok) setData(await res.json());
         } finally {
           setActionLoading(null);
         }
       }
       ```
       Same pattern for `handleToolRefresh(toolName)` and `handleToolRemove(toolName)`.

    4. Replace the "Tools + Skills Gallery" card content with:
       - A tab bar (same style as the existing tools/skills tabs in GalleryPanel.tsx: two buttons, left="Skills" right="Tools", active gets bg-tertiary)
       - Below the tabs, render a grid of gallery cards based on active tab

    5. Each gallery card (VSCode extension-like):
       - Container: `padding: 16px`, `background: var(--bg-secondary)`, `border: 1px solid var(--border)`, `borderRadius: 8px`, `position: relative`
       - Top-right action icons container: `position: absolute`, `top: 8px`, `right: 8px`, `display: flex`, `gap: 4px`
         - Refresh button: circular 24x24px, `background: var(--bg-tertiary)`, `border: 1px solid var(--border)`, `borderRadius: 50%`, `cursor: pointer`, content: Unicode refresh arrow (↻ or ⟳), `fontSize: 12px`
         - Remove button: same style but with Unicode X (×), `color: var(--text-dim)` normally, `color: var(--red, #e55)` on hover
         - When actionLoading matches this item, show a small "..." or dim the button
       - Card body:
         - Icon area: first letter uppercase in a colored circle (same pattern as GalleryPanel.tsx)
         - Name: `fontSize: 13px`, `fontWeight: 700`, `color: var(--text-primary)`
         - Description: `fontSize: 11px`, `color: var(--text-dim)`, clamp to 2 lines
         - Status badge: for skills show status (active/pending), for tools show "installed"
         - Source badge: `fontSize: 9px`, show department name

    6. Skills tab renders `data.skills` array (already in API response), tools tab renders `data.tools` array (new from Task 1).

    7. Grid layout: `display: grid`, `gridTemplateColumns: repeat(auto-fill, minmax(200px, 1fr))`, `gap: 12px`

    8. Empty state per tab: "No skills installed" / "No tools installed" with a dim hint text.

    CSS notes: Use inline styles (matching existing page patterns - no Tailwind per project constraint). Use CSS variables from the existing design system (var(--bg-secondary), var(--border), var(--text-primary), var(--text-dim), etc.).
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Org Context page shows "Skills" and "Tools" sub-tabs inside the gallery section
    - Each installed skill/tool renders as a VSCode-extension-like card
    - Each card has refresh (↻) and remove (×) icon buttons in top-right corner
    - Clicking refresh calls POST /api/org-context/{dept}/skills/{id}/refresh (or tools equivalent)
    - Clicking remove shows confirm dialog then calls POST /api/org-context/{dept}/skills/{id}/remove
    - Loading state shown on buttons during action
    - Page compiles without TypeScript errors
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. Visit http://localhost:3011/org-context, click Tech tab
3. Gallery section shows Skills/Tools sub-tabs
4. If any skills are installed for the department, they appear as cards with refresh/remove icons
5. Clicking refresh triggers Tamir invocation (visible in server logs)
6. Clicking remove shows confirm, then triggers Tamir invocation and removes card from UI
</verification>

<success_criteria>
- Department gallery UI has tabbed view for skills and tools
- Each card has refresh and remove action buttons
- Actions delegate to Tamir via invokeAgent (not direct file manipulation in API routes)
- Tamir has a skill-tool-manager skill explaining refresh and remove procedures
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/260328-ofg-department-skills-and-tools-gallery-ui-w/260328-ofg-SUMMARY.md`
</output>
