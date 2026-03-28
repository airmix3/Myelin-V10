/**
 * MCP tools: install_tool & install_skill
 * Allows agents to request npm tool or skills.sh skill installation mid-session.
 * Installation triggers dept head approval via a separate query() call,
 * then installs to department directory and hot-reloads via setMcpServers().
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { ToolContext } from '../tool-context';
import { getQueryRef } from '../query-registry';
import { generateId } from '@/lib/id';
import { insertActivityLog } from '@/lib/activity-log';
import { logger } from '@/lib/logger';

const DATA_DIR = resolve(process.cwd(), 'data');

/**
 * Map department to its department head agent ID.
 */
function getDeptHeadId(department: string): string {
  switch (department) {
    case 'tech': return 'cto';
    case 'marketing': return 'cmo';
    case 'operations': return 'coo';
    case 'cos': return 'tamir';
    default: return 'cto'; // fallback
  }
}

/**
 * Run dept head approval flow: invoke the dept head agent to approve/reject.
 * Returns { approved: boolean; reasoning: string }.
 */
async function runApproval(
  ctx: ToolContext,
  requestType: 'tool' | 'skill',
  itemName: string,
  justification: string,
): Promise<{ approved: boolean; reasoning: string }> {
  const log = logger.child({ module: 'install-approval', taskId: ctx.taskId });
  const deptHeadId = getDeptHeadId(ctx.department);

  // Get dept head's soul.md from orchestrator
  const { orchestrator } = await import('@/lib/orchestrator');
  const agent = orchestrator.getAgent(deptHeadId);
  if (!agent) {
    log.error({ deptHeadId }, 'Dept head agent not found in orchestrator');
    return { approved: false, reasoning: `Department head '${deptHeadId}' not found in agent registry` };
  }

  // Manager desk path (Tamir lives flat in cos/ -- no manager-desk subdir)
  const managerDesk = deptHeadId === 'tamir'
    ? resolve(DATA_DIR, 'departments', 'cos')
    : resolve(DATA_DIR, 'departments', ctx.department, 'manager-desk');
  const delivDir = resolve(managerDesk, 'deliverables');
  mkdirSync(delivDir, { recursive: true });
  const manifestPath = resolve(delivDir, 'deliverable_manifest.json');
  if (!existsSync(manifestPath)) {
    writeFileSync(manifestPath, JSON.stringify({
      taskId: ctx.taskId, files: [], primaryFile: null, createdAt: new Date().toISOString(),
    }, null, 2), 'utf-8');
  }

  const prompt = `An agent (${ctx.agentId}) working on task ${ctx.taskId} is requesting to install ${requestType === 'tool' ? 'an MCP tool server' : 'a skill'}.

${requestType === 'tool' ? 'Package' : 'Skill'}: ${itemName}
Justification: ${justification}

IMPORTANT: Follow the skill-approval policy in data/departments/global/skills/skill-approval/SKILL.md.
Current policy is PERMISSIVE — APPROVE all requests unless the package name contains shell injection characters.
Do NOT reject based on unknown sources, security concerns, or unfamiliarity.

Respond with APPROVED or REJECTED and brief reasoning.`;

  // Log agent switch boundary
  insertActivityLog({
    taskId: ctx.taskId,
    agentId: ctx.agentId,
    actionType: 'AGENT_SWITCH_START',
    description: `Switching to ${deptHeadId} for ${requestType} install approval`,
    metadata: { fromAgent: ctx.agentId, toAgent: deptHeadId, reason: `${requestType}_install_approval` },
  });

  try {
    const { invokeAgent } = await import('@/lib/invoke-agent');
    const runId = generateId('run');
    const result = await invokeAgent({
      taskId: ctx.taskId,
      runId,
      agentId: deptHeadId,
      department: ctx.department,
      prompt,
      soulMd: agent.soulMd,
      deskDir: managerDesk,
      delivDir,
      manifestPath,
      maxBudgetUsd: 2,
      tools: { type: 'preset', preset: 'claude_code' },
    });

    // Log agent switch end
    insertActivityLog({
      taskId: ctx.taskId,
      agentId: ctx.agentId,
      actionType: 'AGENT_SWITCH_END',
      description: `Switched back from ${deptHeadId}`,
      metadata: { fromAgent: deptHeadId, toAgent: ctx.agentId },
    });

    const resultText = result.result ?? '';
    const approved = /approved/i.test(resultText);
    return { approved, reasoning: resultText };
  } catch (err) {
    // Log agent switch end even on error
    insertActivityLog({
      taskId: ctx.taskId,
      agentId: ctx.agentId,
      actionType: 'AGENT_SWITCH_END',
      description: `Switched back from ${deptHeadId} (error)`,
      metadata: { fromAgent: deptHeadId, toAgent: ctx.agentId, error: String(err) },
    });

    log.error({ err, deptHeadId }, 'Dept head approval invocation failed');
    return { approved: false, reasoning: `Approval call failed: ${String(err)}` };
  }
}

export function createInstallTools(ctx: ToolContext) {
  const log = logger.child({ module: 'install-tools', taskId: ctx.taskId });

  const installTool = tool(
    'install_tool',
    'Request installation of an MCP tool server via Smithery. Triggers department head approval, installs on approval, and hot-reloads into your current session.',
    {
      package_name: z.string().describe('Smithery qualified name (e.g., "github", "exa") or npm package name of the MCP server to install'),
      justification: z.string().describe('Why you need this tool — what task requirement it fulfills'),
    },
    async (args) => {
      const { package_name, justification } = args;

      // Log request
      insertActivityLog({
        taskId: ctx.taskId,
        agentId: ctx.agentId,
        actionType: 'INSTALL_TOOL_REQUESTED',
        description: `Requesting install of tool: ${package_name}`,
        metadata: { package_name, justification },
      });

      // Run approval flow
      const approval = await runApproval(ctx, 'tool', package_name, justification);

      if (!approval.approved) {
        return {
          content: [{
            type: 'text' as const,
            text: `Tool installation REJECTED by department head.\n\nReasoning: ${approval.reasoning}`,
          }],
        };
      }

      // Invoke Tamir to perform the actual installation
      const deptToolsDir = resolve(DATA_DIR, 'departments', ctx.department, 'tools');
      mkdirSync(deptToolsDir, { recursive: true });

      const tamirDeskDir = resolve(DATA_DIR, 'departments', 'cos');
      const tamirDelivDir = resolve(tamirDeskDir, 'deliverables');
      mkdirSync(tamirDelivDir, { recursive: true });
      const tamirManifestPath = resolve(tamirDelivDir, 'deliverable_manifest.json');
      if (!existsSync(tamirManifestPath)) {
        writeFileSync(tamirManifestPath, JSON.stringify({
          taskId: ctx.taskId, files: [], primaryFile: null, createdAt: new Date().toISOString(),
        }, null, 2), 'utf-8');
      }

      // Get Tamir's soul.md
      const { orchestrator: orch } = await import('@/lib/orchestrator');
      const tamirAgent = orch.getAgent('tamir');
      const tamirSoulMd = tamirAgent?.soulMd ?? '';

      const installPrompt = `You are performing a TOOL INSTALLATION. Follow your installer skill procedure.

## Context
- Requesting agent: ${ctx.agentId} (department: ${ctx.department})
- Task: ${ctx.taskId}
- Justification: ${justification}
- Approved by: ${getDeptHeadId(ctx.department)} (department head)
- Approval reasoning: ${approval.reasoning}

## Installation Details
- Package: ${package_name}
- Type: MCP tool server (Smithery)
- Target directory: ${deptToolsDir}
- Command: npx @smithery/cli mcp add ${package_name} --client claude-code

## Instructions
1. cd to the target directory
2. Ensure package.json exists (run npm init -y if not)
3. Run the install command
4. Verify success: exit code 0, package appears in package.json or node_modules
5. Report result clearly — success with what was installed, or failure with exact error`;

      insertActivityLog({
        taskId: ctx.taskId,
        agentId: ctx.agentId,
        actionType: 'AGENT_SWITCH_START',
        description: `Switching to tamir for tool installation: ${package_name}`,
        metadata: { fromAgent: ctx.agentId, toAgent: 'tamir', reason: 'tool_installation' },
      });

      try {
        const { invokeAgent } = await import('@/lib/invoke-agent');
        const installRunId = generateId('run');
        await invokeAgent({
          taskId: ctx.taskId,
          runId: installRunId,
          agentId: 'tamir',
          department: 'cos',
          prompt: installPrompt,
          soulMd: tamirSoulMd,
          deskDir: tamirDeskDir,
          delivDir: tamirDelivDir,
          manifestPath: tamirManifestPath,
          maxBudgetUsd: 2,
          tools: { type: 'preset', preset: 'claude_code' },
        });

        insertActivityLog({
          taskId: ctx.taskId,
          agentId: ctx.agentId,
          actionType: 'AGENT_SWITCH_END',
          description: `Switched back from tamir (tool install complete)`,
          metadata: { fromAgent: 'tamir', toAgent: ctx.agentId },
        });
      } catch (installErr) {
        insertActivityLog({
          taskId: ctx.taskId,
          agentId: ctx.agentId,
          actionType: 'AGENT_SWITCH_END',
          description: `Switched back from tamir (tool install error)`,
          metadata: { fromAgent: 'tamir', toAgent: ctx.agentId, error: String(installErr) },
        });

        log.error({ err: installErr, package_name }, 'Tamir tool installation failed');
        return {
          content: [{
            type: 'text' as const,
            text: `Tool installation APPROVED but Tamir install failed: ${String(installErr)}`,
          }],
        };
      }

      // Hot-reload MCP servers via query ref
      const q = getQueryRef(ctx.runId);
      let hotReloadMsg = '';
      if (q && typeof q.setMcpServers === 'function') {
        try {
          const result = await q.setMcpServers({
            [package_name]: {
              type: 'url',
              url: `https://server.smithery.ai/${package_name}`,
            },
          });
          hotReloadMsg = `\nHot-reloaded: added ${result.added?.length ?? 0} server(s).`;
          if (result.errors?.length > 0) {
            hotReloadMsg += `\nErrors: ${result.errors.map((e: { name: string; error: string }) => `${e.name}: ${e.error}`).join(', ')}`;
          }
        } catch (reloadErr) {
          log.warn({ err: reloadErr, package_name }, 'setMcpServers hot-reload failed');
          hotReloadMsg = '\nWarning: Hot-reload failed. Tool installed but not available in current session.';
        }
      } else {
        hotReloadMsg = '\nWarning: Could not hot-reload (query ref not found). Tool installed for future sessions.';
      }

      return {
        content: [{
          type: 'text' as const,
          text: `Tool '${package_name}' APPROVED and installed successfully.${hotReloadMsg}\n\nDept head reasoning: ${approval.reasoning}`,
        }],
      };
    },
  );

  const installSkill = tool(
    'install_skill',
    'Request installation of a skill from skills.sh. Pass the full skill identifier in owner/repo@skill-name format. Triggers department head approval, then installs on approval.',
    {
      skill_id: z.string().describe('Full skill identifier from skills.sh in owner/repo@skill-name format (e.g., "rknall/claude-skills@svg-logo-designer")'),
      justification: z.string().describe('Why you need this skill — what task requirement it fulfills'),
    },
    async (args) => {
      const { skill_id, justification } = args;

      // Parse owner/repo@skill-name format
      const atIndex = skill_id.indexOf('@');
      if (atIndex === -1) {
        return {
          content: [{
            type: 'text' as const,
            text: `Invalid skill_id format: "${skill_id}". Expected owner/repo@skill-name (e.g., "rknall/claude-skills@svg-logo-designer").`,
          }],
        };
      }
      const ownerRepo = skill_id.substring(0, atIndex);  // e.g., "rknall/claude-skills"
      const skillName = skill_id.substring(atIndex + 1);  // e.g., "svg-logo-designer"

      // Log request
      insertActivityLog({
        taskId: ctx.taskId,
        agentId: ctx.agentId,
        actionType: 'INSTALL_SKILL_REQUESTED',
        description: `Requesting install of skill: ${skill_id}`,
        metadata: { skill_id, ownerRepo, skillName, justification },
      });

      // Run approval flow
      const approval = await runApproval(ctx, 'skill', skill_id, justification);

      if (!approval.approved) {
        return {
          content: [{
            type: 'text' as const,
            text: `Skill installation REJECTED by department head.\n\nReasoning: ${approval.reasoning}`,
          }],
        };
      }

      // Invoke Tamir to install the skill
      // skills.sh CLI: npx skills add <owner/repo> --skill '<Display Name>' --yes
      // The --skill flag matches against SKILL.md frontmatter name (e.g., "SVG Logo Designer")
      // not the directory name (e.g., "svg-logo-designer"). Convert kebab to title case.
      const displayName = skillName
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const deptSkillsDir = resolve(DATA_DIR, 'departments', ctx.department, 'skills');
      mkdirSync(deptSkillsDir, { recursive: true });

      const tamirDeskDir = resolve(DATA_DIR, 'departments', 'cos');
      const tamirDelivDir = resolve(tamirDeskDir, 'deliverables');
      mkdirSync(tamirDelivDir, { recursive: true });
      const tamirManifestPath = resolve(tamirDelivDir, 'deliverable_manifest.json');
      if (!existsSync(tamirManifestPath)) {
        writeFileSync(tamirManifestPath, JSON.stringify({
          taskId: ctx.taskId, files: [], primaryFile: null, createdAt: new Date().toISOString(),
        }, null, 2), 'utf-8');
      }

      const { orchestrator: orch } = await import('@/lib/orchestrator');
      const tamirAgent = orch.getAgent('tamir');
      const tamirSoulMd = tamirAgent?.soulMd ?? '';

      const installPrompt = `You are performing a SKILL INSTALLATION. Follow your installer skill procedure.

## Context
- Requesting agent: ${ctx.agentId} (department: ${ctx.department})
- Task: ${ctx.taskId}
- Justification: ${justification}
- Approved by: ${getDeptHeadId(ctx.department)} (department head)
- Approval reasoning: ${approval.reasoning}

## Installation Details
- Skill: ${skill_id} (display name: "${displayName}")
- Owner/Repo: ${ownerRepo}
- Target directory: ${deptSkillsDir}
- Command: npx skills add ${ownerRepo} --skill '${displayName}' --yes

## Instructions
1. cd to the target directory
2. Run the install command
3. Verify success: exit code 0, new directory with SKILL.md exists
4. Report result clearly — success with skill path, or failure with exact error`;

      insertActivityLog({
        taskId: ctx.taskId,
        agentId: ctx.agentId,
        actionType: 'AGENT_SWITCH_START',
        description: `Switching to tamir for skill installation: ${skill_id}`,
        metadata: { fromAgent: ctx.agentId, toAgent: 'tamir', reason: 'skill_installation' },
      });

      try {
        const { invokeAgent } = await import('@/lib/invoke-agent');
        const installRunId = generateId('run');
        await invokeAgent({
          taskId: ctx.taskId,
          runId: installRunId,
          agentId: 'tamir',
          department: 'cos',
          prompt: installPrompt,
          soulMd: tamirSoulMd,
          deskDir: tamirDeskDir,
          delivDir: tamirDelivDir,
          manifestPath: tamirManifestPath,
          maxBudgetUsd: 2,
          tools: { type: 'preset', preset: 'claude_code' },
        });

        insertActivityLog({
          taskId: ctx.taskId,
          agentId: ctx.agentId,
          actionType: 'AGENT_SWITCH_END',
          description: `Switched back from tamir (skill install complete)`,
          metadata: { fromAgent: 'tamir', toAgent: ctx.agentId },
        });
      } catch (installErr) {
        insertActivityLog({
          taskId: ctx.taskId,
          agentId: ctx.agentId,
          actionType: 'AGENT_SWITCH_END',
          description: `Switched back from tamir (skill install error)`,
          metadata: { fromAgent: 'tamir', toAgent: ctx.agentId, error: String(installErr) },
        });

        log.error({ err: installErr, skill_id, ownerRepo, skillName }, 'Tamir skill install failed');
        return {
          content: [{
            type: 'text' as const,
            text: `Skill installation APPROVED but Tamir install failed: ${String(installErr)}`,
          }],
        };
      }

      // Return the symlinked path so the agent knows where to find the skill
      const skillPath = resolve(ctx.deskDir, '.claude', 'skills', ctx.department, skillName);

      return {
        content: [{
          type: 'text' as const,
          text: `Skill '${skill_id}' APPROVED and installed.\nAvailable at: ${skillPath}\n\nDept head reasoning: ${approval.reasoning}`,
        }],
      };
    },
  );

  return [installTool, installSkill];
}
