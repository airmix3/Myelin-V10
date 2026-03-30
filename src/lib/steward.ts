/**
 * Steward invocation module -- invokes existing agents with asset-specific context.
 * Per D-29, D-30: stewards assess, maintain, and advise on company assets.
 */
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { invokeAgent } from './invoke-agent';
import { orchestrator } from './orchestrator';
import { prisma } from './db';
import { generateId } from './id';
import { logger } from './logger';

const log = logger.child({ module: 'steward' });

/**
 * Steward system prompt appended to the agent's existing soul.
 * Gives the agent its steward context for asset work.
 */
function buildStewardPrompt(asset: {
  id: string;
  title: string;
  category: string;
  maturity: string;
  healthStatus: string;
  description: string | null;
}): string {
  return `
## Steward Mode

You are now operating as a STEWARD for a company asset. Your role is to assess, maintain, and advise on this asset.

### Asset Context
- **Asset:** ${asset.title}
- **ID:** ${asset.id}
- **Category:** ${asset.category}
- **Maturity:** ${asset.maturity}
- **Health:** ${asset.healthStatus}
- **Description:** ${asset.description || 'No description'}

### Steward Responsibilities
1. Assess the current state of this asset
2. Provide honest, nuanced narratives about health and trajectory
3. Suggest maturity transitions when appropriate
4. Identify maintenance needs and recommend follow-up tasks
5. Answer the CEO's questions about this asset with deep context

### Available Tools
- update_asset_health: Update the asset's health status with a narrative assessment
- add_asset_event: Record significant events or observations
- link_asset_dependency: Connect this asset to assets it depends on or that depend on it

Respond as a steward -- thoughtful, specific, and focused on this asset's wellbeing.
`.trim();
}

export interface StewardInvokeResult {
  response: string;
  taskId: string;
  runId: string;
}

/**
 * Invoke an agent in steward mode for a specific asset.
 * Creates a lightweight task record for cost tracking and session management.
 */
export async function invokeSteward(opts: {
  assetId: string;
  agentId: string; // cto, cmo, or coo
  prompt: string;
  department?: string;
}): Promise<StewardInvokeResult> {
  const asset = await prisma.asset.findUnique({ where: { id: opts.assetId } });
  if (!asset) throw new Error(`Asset not found: ${opts.assetId}`);

  // Look up agent config from orchestrator for soulMd
  const agentConfig = orchestrator.getAgent(opts.agentId);
  if (!agentConfig) throw new Error(`Agent not found in orchestrator: ${opts.agentId}`);

  // Determine department from agent config or agentId fallback
  const deptMap: Record<string, string> = { cto: 'tech', cmo: 'marketing', coo: 'operations' };
  const department = opts.department || agentConfig.department || deptMap[opts.agentId] || 'tech';

  // Create steward desk directory within asset directory
  const assetDir = asset.directoryPath || resolve(process.cwd(), 'data', 'assets', opts.assetId);
  const deskDir = join(assetDir, 'steward-desk');
  const delivDir = assetDir;
  mkdirSync(deskDir, { recursive: true });

  // Write a minimal CLAUDE.md for the steward desk
  const claudeMdPath = join(deskDir, 'CLAUDE.md');
  if (!existsSync(claudeMdPath)) {
    writeFileSync(
      claudeMdPath,
      `# Steward Workspace\n\nAsset: ${asset.title} (${opts.assetId})\nCategory: ${asset.category}\nMaturity: ${asset.maturity}\n\nUse MCP tools to interact with the asset system.\n`,
      'utf-8',
    );
  }

  // Create a lightweight steward task (marked in metadata to filter from main UI)
  const taskId = generateId('task');
  const runId = generateId('trun');

  await prisma.task.create({
    data: {
      id: taskId,
      title: `Steward: ${asset.title}`,
      description: opts.prompt,
      department,
      state: 'working',
      metadata: JSON.stringify({ stewardOperation: true, assetId: opts.assetId }),
      executorAgentId: opts.agentId,
      currentActorId: opts.agentId,
    },
  });

  // Look up the employee record for the agent
  const employee = await prisma.employee.findFirst({ where: { agentId: opts.agentId } });
  if (!employee) throw new Error(`Employee not found for agent: ${opts.agentId}`);

  await prisma.taskRun.create({
    data: {
      id: runId,
      taskId,
      employeeId: employee.id,
      status: 'executing',
      claimedAt: new Date(),
      workspaceCwd: deskDir,
    },
  });

  const manifestPath = join(assetDir, 'asset_manifest.json');

  try {
    const stewardPrompt = buildStewardPrompt(asset);
    const fullPrompt = `${opts.prompt}\n\n---\n${stewardPrompt}`;

    const result = await invokeAgent({
      taskId,
      runId,
      agentId: opts.agentId,
      prompt: fullPrompt,
      soulMd: agentConfig.soulMd,
      deskDir,
      delivDir,
      manifestPath,
      department,
    });

    // Mark task as completed
    await prisma.task.update({ where: { id: taskId }, data: { state: 'completed', completedAt: new Date() } });
    await prisma.taskRun.update({ where: { id: runId }, data: { status: 'completed', completedAt: new Date() } });

    // Extract text response from result
    const responseText = result.result || 'Steward assessment complete.';

    return { response: responseText, taskId, runId };
  } catch (err) {
    log.error({ err, assetId: opts.assetId, agentId: opts.agentId }, 'Steward invocation failed');
    await prisma.task.update({ where: { id: taskId }, data: { state: 'failed' } });
    await prisma.taskRun.update({ where: { id: runId }, data: { status: 'failed', failedAt: new Date(), failureReason: String(err) } });
    throw err;
  }
}
