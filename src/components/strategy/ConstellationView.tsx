'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import {
  calculateOrbitalPositions,
  OrbitNode,
  STATUS_COLORS,
  GOAL_STATUS_COLORS,
} from '@/lib/strategy/constellation-layout';

interface ConstellationViewProps {
  directions: OrbitNode[];
  goals: OrbitNode[];
  activeSetId: string | null;
  highlightedDirectionIds: string[];
  onDirectionClick: (directionId: string) => void;
  onGoalClick: (goalId: string, directionId: string) => void;
}

interface TooltipState {
  x: number;
  y: number;
  node: OrbitNode;
}

export default function ConstellationView({
  directions,
  goals,
  activeSetId,
  highlightedDirectionIds,
  onDirectionClick,
  onGoalClick,
}: ConstellationViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Build a set for fast lookup of goals belonging to highlighted directions
  const highlightedGoalIds = useCallback(() => {
    if (!activeSetId) return new Set<string>();
    const dirSet = new Set(highlightedDirectionIds);
    return new Set(
      goals.filter((g) => g.parentId && dirSet.has(g.parentId)).map((g) => g.id),
    );
  }, [activeSetId, highlightedDirectionIds, goals]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current || !containerRef.current) return;

    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    // Clear previous render
    svg.selectAll('*').remove();

    svg.attr('width', width).attr('height', height);

    // SVG defs -- glow filter
    const defs = svg.append('defs');
    const glowFilter = defs.append('filter').attr('id', 'glow');
    glowFilter
      .append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Zoom (D-06)
    const g = svg.append('g');
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setTooltip(null); // Hide tooltip during pan/zoom
      });
    svg.call(zoom);

    // Calculate positions
    const positions = calculateOrbitalPositions(directions, goals, width, height);

    const dirSet = new Set(highlightedDirectionIds);
    const goalHighlight = highlightedGoalIds();

    // Determine opacity for a node based on priority set filter
    function getOpacity(nodeId: string, nodeType: 'direction' | 'goal'): number {
      if (!activeSetId) return 1.0;
      if (nodeType === 'direction') return dirSet.has(nodeId) ? 1.0 : 0.15;
      return goalHighlight.has(nodeId) ? 1.0 : 0.15;
    }

    // -- Draw orbit paths (dashed circles around directions) --
    for (const dir of directions) {
      const pos = positions.get(dir.id);
      if (!pos) continue;
      const dirGoals = goals.filter((gl) => gl.parentId === dir.id);
      if (dirGoals.length === 0) continue;

      const orbitRadius = 60 + dirGoals.length * 12;
      g.append('circle')
        .attr('cx', pos.x)
        .attr('cy', pos.y)
        .attr('r', orbitRadius)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.06)')
        .attr('stroke-dasharray', '4 6')
        .attr('opacity', getOpacity(dir.id, 'direction'));
    }

    // -- Draw connecting lines from goals to parent directions --
    for (const goal of goals) {
      if (!goal.parentId) continue;
      const goalPos = positions.get(goal.id);
      const dirPos = positions.get(goal.parentId);
      if (!goalPos || !dirPos) continue;

      g.append('line')
        .attr('x1', dirPos.x)
        .attr('y1', dirPos.y)
        .attr('x2', goalPos.x)
        .attr('y2', goalPos.y)
        .attr('stroke', 'rgba(255,255,255,0.08)')
        .attr('stroke-width', 1)
        .attr('opacity', getOpacity(goal.id, 'goal'));
    }

    // -- Draw direction nodes --
    for (const dir of directions) {
      const pos = positions.get(dir.id);
      if (!pos) continue;
      const color = STATUS_COLORS[dir.status] || STATUS_COLORS.active;
      const opacity = getOpacity(dir.id, 'direction');

      const group = g
        .append('g')
        .attr('class', 'direction-node')
        .attr('transform', `translate(${pos.x},${pos.y})`)
        .attr('opacity', opacity)
        .style('cursor', 'pointer');

      // Outer glow
      group
        .append('circle')
        .attr('r', pos.r + 4)
        .attr('fill', color)
        .attr('opacity', 0.2)
        .attr('filter', 'url(#glow)');

      // Main circle
      group
        .append('circle')
        .attr('r', pos.r)
        .attr('fill', color)
        .attr('opacity', 0.85)
        .attr('stroke', 'rgba(255,255,255,0.2)')
        .attr('stroke-width', 1.5);

      // Label
      group
        .append('text')
        .attr('y', pos.r + 18)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '12px')
        .attr('opacity', 0.9)
        .text(dir.label.length > 24 ? dir.label.slice(0, 22) + '...' : dir.label);

      // Hover effects (D-07: hover only, no ambient animation)
      group
        .on('mouseenter', (event) => {
          if (opacity < 0.5) return; // Don't interact with dimmed nodes
          group
            .select('circle:nth-child(2)')
            .transition()
            .duration(150)
            .attr('r', pos.r * 1.2);
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltip({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              node: dir,
            });
          }
        })
        .on('mouseleave', () => {
          group
            .select('circle:nth-child(2)')
            .transition()
            .duration(150)
            .attr('r', pos.r);
          setTooltip(null);
        })
        .on('click', () => {
          onDirectionClick(dir.id);
        });
    }

    // -- Draw goal nodes --
    for (const goal of goals) {
      const pos = positions.get(goal.id);
      if (!pos) continue;
      const color = GOAL_STATUS_COLORS[goal.status] || GOAL_STATUS_COLORS.planned;
      const opacity = getOpacity(goal.id, 'goal');

      const group = g
        .append('g')
        .attr('class', 'goal-node')
        .attr('transform', `translate(${pos.x},${pos.y})`)
        .attr('opacity', opacity)
        .style('cursor', 'pointer');

      // Main circle
      group
        .append('circle')
        .attr('r', pos.r)
        .attr('fill', color)
        .attr('opacity', 0.75)
        .attr('stroke', 'rgba(255,255,255,0.15)')
        .attr('stroke-width', 1);

      // Label
      group
        .append('text')
        .attr('y', pos.r + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.6)')
        .attr('font-size', '10px')
        .text(goal.label.length > 20 ? goal.label.slice(0, 18) + '...' : goal.label);

      // Hover effects
      group
        .on('mouseenter', (event) => {
          if (opacity < 0.5) return;
          group
            .select('circle')
            .transition()
            .duration(150)
            .attr('r', pos.r * 1.2);
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltip({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              node: goal,
            });
          }
        })
        .on('mouseleave', () => {
          group
            .select('circle')
            .transition()
            .duration(150)
            .attr('r', pos.r);
          setTooltip(null);
        })
        .on('click', () => {
          if (goal.parentId) onGoalClick(goal.id, goal.parentId);
        });
    }

    // Apply filter transitions when activeSetId changes (D-05/D-07)
    if (activeSetId) {
      g.selectAll('.direction-node, .goal-node')
        .transition()
        .duration(400)
        .attr('opacity', function () {
          return parseFloat(d3.select(this).attr('opacity'));
        });
    }
  }, [
    directions,
    goals,
    activeSetId,
    highlightedDirectionIds,
    highlightedGoalIds,
    onDirectionClick,
    onGoalClick,
  ]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
      {tooltip && (
        <div
          className="glass-deep absolute pointer-events-none rounded-lg px-3 py-2 z-50"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            maxWidth: 240,
          }}
        >
          <p className="text-sm font-medium text-white/90">{tooltip.node.label}</p>
          <p className="text-xs text-white/50 capitalize mt-0.5">
            {tooltip.node.type} &middot; {tooltip.node.status}
          </p>
          {tooltip.node.type === 'direction' && tooltip.node.goalCount != null && (
            <p className="text-xs text-white/40 mt-0.5">
              {tooltip.node.goalCount} goal{tooltip.node.goalCount !== 1 ? 's' : ''}
            </p>
          )}
          {tooltip.node.type === 'goal' && tooltip.node.seedProgress != null && (
            <p className="text-xs text-white/40 mt-0.5">
              Seed progress: {Math.round(tooltip.node.seedProgress * 100)}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}
