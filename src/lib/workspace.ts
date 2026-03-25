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

export function createTaskWorkspace(
  taskId: string,
  department: Department,
  plan?: string,
  constraints?: string
): WorkspaceResult {
  const log = logger.child({ module: 'workspace', taskId });
  const baseDir = join(DATA_DIR, 'workspaces', taskId);
  const deskDir = join(baseDir, 'desk');
  const delivDir = join(baseDir, 'deliverables');
  const skillsDir = join(deskDir, '.claude', 'skills');

  mkdirSync(skillsDir, { recursive: true });
  mkdirSync(delivDir, { recursive: true });

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

  // Write desk/CLAUDE.md with plan and constraints
  const claudeMd = [
    `# Task: ${taskId}`,
    `## Department: ${department}`,
    '',
    plan ? `## Plan\n\n${plan}` : '## Plan\n\n(No plan provided)',
    '',
    constraints ? `## Constraints\n\n${constraints}` : '',
  ].filter(Boolean).join('\n');
  writeFileSync(join(deskDir, 'CLAUDE.md'), claudeMd, 'utf-8');

  // Stub deliverable_manifest.json
  const manifestPath = join(delivDir, 'deliverable_manifest.json');
  writeFileSync(manifestPath, JSON.stringify({
    taskId, files: [], primaryFile: null, createdAt: new Date().toISOString(),
  }, null, 2), 'utf-8');

  log.info({ baseDir, department }, 'Task workspace created');
  return { baseDir, deskDir, delivDir, manifestPath };
}

export function ensurePlanningDesks(): void {
  const log = logger.child({ module: 'workspace' });
  for (const dept of DEPARTMENTS) {
    const planningDesk = join(DATA_DIR, 'departments', dept, 'planning-desk');
    const skillsDir = join(planningDesk, '.claude', 'skills');
    const chatDir = join(planningDesk, 'chat');
    mkdirSync(skillsDir, { recursive: true });
    mkdirSync(chatDir, { recursive: true });

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
  }
  log.info('Planning desks ensured for all departments');
}
