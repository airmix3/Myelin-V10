/**
 * MCP tools: install_tool & install_skill
 * Allows agents to request npm tool or skills.sh skill installation mid-session.
 * Installation triggers dept head approval via a separate query() call,
 * then installs to department directory and hot-reloads via setMcpServers().
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { execSync } from 'child_process';
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
    case 'global': return 'tamir';
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

  // Manager desk path
  const managerDesk = resolve(DATA_DIR, 'departments', ctx.department, 'manager-desk');
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

Review this request. You may use web search to verify the ${requestType === 'tool' ? 'package' : 'skill'} exists and is safe. Respond with APPROVED or REJECTED and your reasoning.`;

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
    'Request installation of an npm MCP tool server package. Triggers department head approval, installs on approval, and hot-reloads into your current session.',
    {
      package_name: z.string().describe('npm package name of the MCP server to install (e.g., "@anthropic/mcp-server-fetch")'),
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

      // Install npm package to dept tools directory
      const deptToolsDir = resolve(DATA_DIR, 'departments', ctx.department, 'tools');
      mkdirSync(deptToolsDir, { recursive: true });

      // Initialize package.json if not exists
      const pkgJsonPath = resolve(deptToolsDir, 'package.json');
      if (!existsSync(pkgJsonPath)) {
        writeFileSync(pkgJsonPath, JSON.stringify({
          name: `${ctx.department}-tools`,
          version: '1.0.0',
          private: true,
          dependencies: {},
        }, null, 2), 'utf-8');
      }

      try {
        execSync(`npm install ${package_name}`, {
          cwd: deptToolsDir,
          timeout: 60000,
          stdio: 'pipe',
        });
      } catch (installErr) {
        log.error({ err: installErr, package_name }, 'npm install failed');
        return {
          content: [{
            type: 'text' as const,
            text: `Tool installation APPROVED but npm install failed: ${String(installErr)}`,
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
              type: 'stdio',
              command: 'npx',
              args: [package_name],
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
    'Request installation of a skill from skills.sh. Triggers department head approval and installs on approval.',
    {
      skill_name: z.string().describe('Skill name from skills.sh (e.g., "nextjs-app-router")'),
      justification: z.string().describe('Why you need this skill — what task requirement it fulfills'),
    },
    async (args) => {
      const { skill_name, justification } = args;

      // Log request
      insertActivityLog({
        taskId: ctx.taskId,
        agentId: ctx.agentId,
        actionType: 'INSTALL_SKILL_REQUESTED',
        description: `Requesting install of skill: ${skill_name}`,
        metadata: { skill_name, justification },
      });

      // Run approval flow
      const approval = await runApproval(ctx, 'skill', skill_name, justification);

      if (!approval.approved) {
        return {
          content: [{
            type: 'text' as const,
            text: `Skill installation REJECTED by department head.\n\nReasoning: ${approval.reasoning}`,
          }],
        };
      }

      // Install skill to dept skills directory
      const deptSkillsDir = resolve(DATA_DIR, 'departments', ctx.department, 'skills');
      mkdirSync(deptSkillsDir, { recursive: true });

      try {
        execSync(`npx skills install ${skill_name}`, {
          cwd: deptSkillsDir,
          timeout: 30000,
          stdio: 'pipe',
        });
      } catch (installErr) {
        log.error({ err: installErr, skill_name }, 'skills install failed');
        return {
          content: [{
            type: 'text' as const,
            text: `Skill installation APPROVED but install failed: ${String(installErr)}`,
          }],
        };
      }

      // Return the symlinked path so the agent knows where to find the skill
      const skillPath = resolve(ctx.deskDir, '.claude', 'skills', ctx.department, skill_name);

      return {
        content: [{
          type: 'text' as const,
          text: `Skill '${skill_name}' APPROVED and installed.\nAvailable at: ${skillPath}\n\nDept head reasoning: ${approval.reasoning}`,
        }],
      };
    },
  );

  return [installTool, installSkill];
}
