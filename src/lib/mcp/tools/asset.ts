/**
 * MCP tools for asset management — Per D-17.
 * Four tools: suggest_asset_promotion, update_asset_health, add_asset_event, link_asset_dependency.
 * Role-gated: dept heads + Tamir for health/event/dependency; all agents for promotion suggestions.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import type { ToolContext } from '../tool-context';

export function createAssetTools(ctx: ToolContext) {
  /**
   * suggest_asset_promotion — Per D-02, D-07.
   * Any agent can recommend a deliverable be promoted to a company asset.
   * Stores recommendation in the deliverable's task metadata for CEO review.
   */
  const suggestAssetPromotion = tool(
    'suggest_asset_promotion',
    'Recommend that a deliverable should be promoted to a company asset. The recommendation will appear as a banner on the deliverable page for the CEO to review.',
    {
      deliverable_id: z.string().describe('ID of the deliverable to recommend for promotion'),
      asset_name: z.string().describe('Suggested name for the asset'),
      rationale: z.string().describe('Why this deliverable should become a company asset'),
      category: z.enum(['code', 'brand', 'IP', 'digital-product', 'knowledge']).describe('Asset category'),
      suggested_return_factors: z.array(
        z.enum(['revenue', 'moat', 'core_tech', 'brand_equity'])
      ).optional().describe('Return factors this asset could provide'),
    },
    async (args) => {
      // Look up deliverable with its task
      const deliverable = await prisma.deliverable.findUnique({
        where: { id: args.deliverable_id },
        include: { task: true },
      });

      if (!deliverable) {
        return {
          content: [{ type: 'text' as const, text: `Deliverable not found: ${args.deliverable_id}` }],
          isError: true,
        };
      }

      // Parse existing task metadata
      let metadata: Record<string, unknown> = {};
      try {
        if (deliverable.task.metadata) {
          metadata = JSON.parse(deliverable.task.metadata as string) as Record<string, unknown>;
        }
      } catch {
        // Start fresh if metadata is corrupt
      }

      // Add promotion recommendation
      metadata.promotionRecommendation = {
        assetName: args.asset_name,
        rationale: args.rationale,
        category: args.category,
        suggestedBy: ctx.agentId,
        suggestedAt: new Date().toISOString(),
        returnFactors: args.suggested_return_factors || [],
      };

      // Update task metadata
      await prisma.task.update({
        where: { id: deliverable.taskId },
        data: { metadata: JSON.stringify(metadata) },
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Promotion recommendation created for "${args.asset_name}" (${args.category}). The CEO will see this on the deliverable page.`,
        }],
      };
    },
  );

  /**
   * update_asset_health — Per D-31.
   * Update health status after a steward assessment. Creates a steward_assessment event.
   */
  const updateAssetHealth = tool(
    'update_asset_health',
    'Update the health status of a company asset after a steward assessment.',
    {
      asset_id: z.string().describe('ID of the asset to update'),
      health_status: z.enum(['healthy', 'stale', 'degraded', 'critical']).describe('New health status'),
      narrative: z.string().describe('Steward assessment narrative explaining the health status'),
    },
    async (args) => {
      // Fetch asset
      const asset = await prisma.asset.findUnique({ where: { id: args.asset_id } });

      if (!asset) {
        return {
          content: [{ type: 'text' as const, text: `Asset not found: ${args.asset_id}` }],
          isError: true,
        };
      }

      const previousStatus = asset.healthStatus;

      // Update health status
      await prisma.asset.update({
        where: { id: args.asset_id },
        data: { healthStatus: args.health_status },
      });

      // Create steward_assessment event
      await prisma.assetEvent.create({
        data: {
          id: generateId('aevt'),
          assetId: args.asset_id,
          type: 'steward_assessment',
          summary: args.narrative,
          agentId: ctx.agentId,
          metadata: JSON.stringify({
            healthStatus: args.health_status,
            previousStatus,
          }),
        },
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Asset "${asset.title}" health updated to ${args.health_status}. Assessment recorded.`,
        }],
      };
    },
  );

  /**
   * add_asset_event — Per D-14.
   * Add a timestamped event to an asset's history.
   */
  const addAssetEvent = tool(
    'add_asset_event',
    'Add a timestamped event to an asset\'s history. Use this to record significant changes, observations, or milestones.',
    {
      asset_id: z.string().describe('ID of the asset'),
      event_type: z.string().describe('Event type: steward_assessment|deliverable_absorbed|health_change|custom'),
      summary: z.string().describe('Description of the event'),
      metadata: z.string().optional().describe('JSON string with additional event data'),
    },
    async (args) => {
      // Fetch asset
      const asset = await prisma.asset.findUnique({ where: { id: args.asset_id } });

      if (!asset) {
        return {
          content: [{ type: 'text' as const, text: `Asset not found: ${args.asset_id}` }],
          isError: true,
        };
      }

      // Validate metadata JSON if provided
      if (args.metadata) {
        try {
          JSON.parse(args.metadata);
        } catch {
          return {
            content: [{ type: 'text' as const, text: 'Invalid metadata: must be a valid JSON string' }],
            isError: true,
          };
        }
      }

      // Create event
      await prisma.assetEvent.create({
        data: {
          id: generateId('aevt'),
          assetId: args.asset_id,
          type: args.event_type,
          summary: args.summary,
          agentId: ctx.agentId,
          metadata: args.metadata || null,
        },
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Event recorded for "${asset.title}": ${args.summary}`,
        }],
      };
    },
  );

  /**
   * link_asset_dependency — Per D-11.
   * Create a dependency link between two assets with duplicate detection.
   */
  const linkAssetDependency = tool(
    'link_asset_dependency',
    'Create a dependency link between two assets. The source asset depends on the target asset. Used to track ripple effects when assets change.',
    {
      source_asset_id: z.string().describe('ID of the asset that depends on another'),
      target_asset_id: z.string().describe('ID of the asset being depended upon'),
      label: z.string().optional().describe('Description of the dependency relationship'),
    },
    async (args) => {
      // Verify both assets exist
      const [sourceAsset, targetAsset] = await Promise.all([
        prisma.asset.findUnique({ where: { id: args.source_asset_id } }),
        prisma.asset.findUnique({ where: { id: args.target_asset_id } }),
      ]);

      if (!sourceAsset) {
        return {
          content: [{ type: 'text' as const, text: `Source asset not found: ${args.source_asset_id}` }],
          isError: true,
        };
      }

      if (!targetAsset) {
        return {
          content: [{ type: 'text' as const, text: `Target asset not found: ${args.target_asset_id}` }],
          isError: true,
        };
      }

      // Self-dependency check
      if (args.source_asset_id === args.target_asset_id) {
        return {
          content: [{ type: 'text' as const, text: 'Cannot create self-dependency: source and target are the same asset.' }],
          isError: true,
        };
      }

      // Check for existing dependency (prevent duplicates) via raw sqlite
      const existing = sqlite.prepare(
        'SELECT id FROM asset_dependencies WHERE sourceId = ? AND targetId = ?'
      ).get(args.source_asset_id, args.target_asset_id) as { id: string } | undefined;

      if (existing) {
        return {
          content: [{ type: 'text' as const, text: `Dependency already exists between "${sourceAsset.title}" and "${targetAsset.title}".` }],
          isError: true,
        };
      }

      // Create dependency via raw sqlite (consistent with 07-01 pattern)
      const depId = generateId('adep');
      sqlite.prepare(
        'INSERT INTO asset_dependencies (id, sourceId, targetId, label, createdAt) VALUES (?, ?, ?, ?, ?)'
      ).run(depId, args.source_asset_id, args.target_asset_id, args.label || null, new Date().toISOString());

      // Create event on source asset
      await prisma.assetEvent.create({
        data: {
          id: generateId('aevt'),
          assetId: args.source_asset_id,
          type: 'dependency_added',
          summary: `Dependency added: depends on "${targetAsset.title}"`,
          agentId: ctx.agentId,
          metadata: JSON.stringify({ targetId: args.target_asset_id, label: args.label || null }),
        },
      });

      // Calculate ripple count via recursive CTE
      const rippleResult = sqlite.prepare(`
        WITH RECURSIVE ripple(id) AS (
          SELECT sourceId FROM asset_dependencies WHERE targetId = ?
          UNION
          SELECT ad.sourceId FROM asset_dependencies ad
          JOIN ripple r ON ad.targetId = r.id
        )
        SELECT COUNT(*) as cnt FROM ripple
      `).get(args.target_asset_id) as { cnt: number };

      return {
        content: [{
          type: 'text' as const,
          text: `Dependency created: "${sourceAsset.title}" depends on "${targetAsset.title}". ${rippleResult.cnt} asset(s) in ripple chain.`,
        }],
      };
    },
  );

  return [suggestAssetPromotion, updateAssetHealth, addAssetEvent, linkAssetDependency];
}
