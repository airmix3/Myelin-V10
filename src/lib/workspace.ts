import { mkdirSync, writeFileSync, symlinkSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { logger } from '@/lib/logger';

const DATA_DIR = resolve(process.cwd(), 'data');
const DEPARTMENTS = ['tech', 'marketing', 'operations', 'global'] as const;
export type Department = typeof DEPARTMENTS[number];

export { DEPARTMENTS };

export interface WorkspaceResult {
  baseDir: string;
  deskDir: string;
  delivDir: string;
  manifestPath: string;
}

export interface CeoHints {
  selectedTools?: string[];
  selectedSkills?: string[];
  toolHints?: Record<string, string>;
}

export function createTaskWorkspace(
  taskId: string,
  department: Department,
  plan?: string,
  constraints?: string,
  ceoHints?: CeoHints,
): WorkspaceResult {
  const log = logger.child({ module: 'workspace', taskId });
  const baseDir = join(DATA_DIR, 'workspaces', taskId);
  const deskDir = join(baseDir, 'desk');
  const delivDir = join(baseDir, 'deliverables');
  const skillsDir = join(deskDir, '.claude', 'skills');

  mkdirSync(skillsDir, { recursive: true });
  mkdirSync(delivDir, { recursive: true });

  // Write desk-level settings.json to anchor project boundary at desk/
  // This prevents the agent subprocess from walking up to data/ or repo root
  const settingsPath = join(deskDir, '.claude', 'settings.json');
  writeFileSync(settingsPath, JSON.stringify({
    permissions: {
      allow: ['Bash(*)', 'Read(*)', 'Write(*)', 'Edit(*)', 'mcp__myelin__*'],
      deny: [],
    },
  }, null, 2), 'utf-8');

  // Symlink active department skills into desk/.claude/skills/
  const deptSkillsSource = join(DATA_DIR, 'departments', department, 'skills');
  const globalSkillsSource = join(DATA_DIR, 'departments', 'global', 'skills');
  const deptSkillsTarget = join(skillsDir, department);
  const globalSkillsTarget = join(skillsDir, 'global');

  if (existsSync(deptSkillsSource) && !existsSync(deptSkillsTarget)) {
    try { symlinkSync(deptSkillsSource, deptSkillsTarget, 'junction'); }
    catch (err) { log.warn({ err, source: deptSkillsSource }, 'Failed to symlink dept skills'); }
  }
  if (existsSync(globalSkillsSource) && !existsSync(globalSkillsTarget)) {
    try { symlinkSync(globalSkillsSource, globalSkillsTarget, 'junction'); }
    catch (err) { log.warn({ err, source: globalSkillsSource }, 'Failed to symlink global skills'); }
  }

  // Write plan to separate PLAN.md (per D-06)
  if (plan) {
    writeFileSync(join(deskDir, 'PLAN.md'), plan, 'utf-8');
  }

  // Build CEO hints section for CLAUDE.md (when CEO selected tools/skills during planning)
  let hintsSection = '';
  if (ceoHints?.selectedTools?.length || ceoHints?.selectedSkills?.length) {
    hintsSection += '\n## CEO-Selected Tools & Skills\n\n';
    hintsSection += 'The CEO has selected these for this task. Install them FIRST before reading PLAN.md.\n\n';

    if (ceoHints.selectedTools?.length) {
      hintsSection += '### Tools to Install\n';
      for (const tool of ceoHints.selectedTools) {
        const hint = ceoHints.toolHints?.[tool] || '';
        hintsSection += `- \`${tool}\`${hint ? ` — ${hint}` : ''}\n`;
        hintsSection += `  -> Run: \`install_tool\` MCP tool with package="${tool}"\n`;
      }
      hintsSection += '\n';
    }

    if (ceoHints.selectedSkills?.length) {
      hintsSection += '### Skills to Install\n';
      for (const skill of ceoHints.selectedSkills) {
        hintsSection += `- \`${skill}\`\n`;
        hintsSection += `  -> Run: \`install_skill\` MCP tool with skill_id="${skill}"\n`;
      }
      hintsSection += '\n';
    }
  }

  // Write minimal CLAUDE.md as pointer file
  const constraintsSection = constraints ? `\n## Constraints\n\n${constraints}\n` : '';
  const hasHints = hintsSection.length > 0;
  const planInstruction = hasHints
    ? 'After installing CEO-selected tools/skills above, read `PLAN.md` in this directory for your full task plan.'
    : 'Your complete task plan is in `PLAN.md` in this directory. Read it first before doing anything else.';
  const claudeMd = `# Task: ${taskId}

## Department: ${department}
${hintsSection}
## Instructions

${planInstruction}

You have access to MCP tools for shared resources:
- \`read_memory\` / \`write_memory\` — Your personal memory
- \`read_knowledge\` / \`search_knowledge\` — Department knowledge base
- \`promote_to_deliverable\` — Move files to deliverables
- \`file_to_vault\` — Save important files to vault
- \`submit_for_review\` — Submit work for supervisor review

All your work must stay within this directory. Do not try to access files outside your workspace.
${constraintsSection}`;
  writeFileSync(join(deskDir, 'CLAUDE.md'), claudeMd, 'utf-8');

  // Stub deliverable_manifest.json
  const manifestPath = join(delivDir, 'deliverable_manifest.json');
  writeFileSync(manifestPath, JSON.stringify({
    taskId, files: [], primaryFile: null, createdAt: new Date().toISOString(),
  }, null, 2), 'utf-8');

  log.info({ baseDir, department }, 'Task workspace created');
  return { baseDir, deskDir, delivDir, manifestPath };
}

export function ensureManagerDesks(): void {
  const log = logger.child({ module: 'workspace' });
  for (const dept of DEPARTMENTS) {
    // Manager desk directory
    const managerDesk = join(DATA_DIR, 'departments', dept, 'manager-desk');
    const settingsDir = join(managerDesk, '.claude');
    mkdirSync(settingsDir, { recursive: true });

    // Write settings.json for project boundary
    const settingsPath = join(settingsDir, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({
      permissions: {
        allow: ['Bash(*)', 'Read(*)', 'Write(*)', 'Edit(*)', 'mcp__myelin__*'],
        deny: [],
      },
    }, null, 2), 'utf-8');

    // Write CLAUDE.md for manager desk
    writeFileSync(join(managerDesk, 'CLAUDE.md'), `# Manager Desk: ${dept}

## Role

You are a department head running an approval review. You have been asked to evaluate
a tool or skill installation request from one of your agents.

## Instructions

- Review the installation request carefully
- Verify the package/skill is safe and appropriate
- Use web search to check the package if needed
- Respond with APPROVED or REJECTED and your reasoning
`, 'utf-8');

    // Department tools directory
    const toolsDir = join(DATA_DIR, 'departments', dept, 'tools');
    mkdirSync(toolsDir, { recursive: true });

    // Department skills directory
    const skillsDir = join(DATA_DIR, 'departments', dept, 'skills');
    mkdirSync(skillsDir, { recursive: true });
  }
  log.info('Manager desks and dept tool/skill directories ensured for all departments');
}

export function ensurePlanningDesks(): void {
  const log = logger.child({ module: 'workspace' });
  for (const dept of DEPARTMENTS) {
    const planningDesk = join(DATA_DIR, 'departments', dept, 'planning-desk');
    const skillsDir = join(planningDesk, '.claude', 'skills');
    const chatDir = join(planningDesk, 'chat');
    mkdirSync(skillsDir, { recursive: true });
    mkdirSync(chatDir, { recursive: true });

    // Write desk-level settings.json to anchor project boundary at planning desk
    const settingsPath = join(planningDesk, '.claude', 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({
      permissions: {
        allow: ['Bash(*)', 'Read(*)', 'Write(*)', 'Edit(*)', 'mcp__myelin__*'],
        deny: [],
      },
    }, null, 2), 'utf-8');

    const globalSkillsSource = join(DATA_DIR, 'departments', 'global', 'skills');
    const globalSkillsTarget = join(skillsDir, 'global');
    if (existsSync(globalSkillsSource) && !existsSync(globalSkillsTarget)) {
      try { symlinkSync(globalSkillsSource, globalSkillsTarget, 'junction'); }
      catch (err) { log.warn({ err, dept }, 'Failed to symlink global skills to planning desk'); }
    }

    const deptSkillsSource = join(DATA_DIR, 'departments', dept, 'skills');
    const deptSkillsTarget = join(skillsDir, dept);
    if (dept !== 'global' && existsSync(deptSkillsSource) && !existsSync(deptSkillsTarget)) {
      try { symlinkSync(deptSkillsSource, deptSkillsTarget, 'junction'); }
      catch (err) { log.warn({ err, dept }, 'Failed to symlink dept skills to planning desk'); }
    }

    // Write comprehensive CLAUDE.md for planning desk (always overwrite to keep current)
    const planningClaudeMd = join(planningDesk, 'CLAUDE.md');
    writeFileSync(planningClaudeMd, `# Planning Desk: ${dept}

## Mode

You are in PLANNING MODE. Help the CEO plan a task. Do NOT execute anything.
Ask clarifying questions, gather information using your tools, then produce a detailed plan when ready.

## Available Tools

You have MCP tools available during planning. USE THEM to research and inform your plans:

### Research & Memory
- \`read_memory\` — Read your persistent memory (past projects, conventions, notes)
- \`write_memory\` — Save important context to your memory for future reference
- \`read_knowledge\` — Read department knowledge base files
- \`write_knowledge\` — Add to department knowledge base
- \`search_knowledge\` — Full-text search across department knowledge

### Organization
- \`get_dept_status\` — Check active tasks and employee counts across departments
- \`read_inbox\` — Check your notification inbox

### Other (available but typically used during execution)
- \`promote_to_deliverable\` — Move files to deliverables (execution phase)
- \`file_to_vault\` — Save files to company vault (execution phase)
- \`submit_for_review\` — Submit work for review (execution phase)
- \`propose_skill\` — Propose a reusable skill (execution phase)
- \`hire_employee\` — Request a temp hire (execution phase)

## Built-in Tools

You have full access to Claude's built-in tools (Read, Write, Bash, Edit, Glob, Grep, WebSearch, etc.).
Your filesystem access is sandboxed to this planning desk directory. Use these tools to:
- Read source files to understand the codebase before planning
- Search for patterns with Glob/Grep to inform your recommendations
- Check existing implementations to avoid redundant work

Do NOT use built-in tools to modify production code during planning. Planning mode is for research and plan creation only.

## Planning Guidelines

- Use built-in tools (Read, Glob, Grep) and \`read_memory\` to research the codebase before planning
- Use \`search_knowledge\` to find relevant department knowledge
- Use \`get_dept_status\` to understand current workload before scoping
- Ask the CEO clarifying questions when requirements are ambiguous
- Produce a detailed plan with clear steps when you have enough information
`, 'utf-8');
  }
  log.info('Planning desks ensured for all departments');
}
