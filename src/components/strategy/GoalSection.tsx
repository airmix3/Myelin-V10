'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import SeedCard from './SeedCard';
import type { SeedData } from './SeedCard';

const GOAL_STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  planned: { bg: 'rgba(100,116,139,0.20)', text: '#94a3b8', label: 'Planned' },
  active: { bg: 'rgba(59,130,246,0.20)', text: '#93c5fd', label: 'Active' },
  'at-risk': { bg: 'rgba(245,158,11,0.20)', text: '#fcd34d', label: 'At Risk' },
  completed: { bg: 'rgba(34,197,94,0.20)', text: '#86efac', label: 'Completed' },
  abandoned: { bg: 'rgba(244,63,94,0.15)', text: '#fda4af', label: 'Abandoned' },
};

export interface GoalSectionProps {
  goal: {
    id: string;
    title: string;
    definitionOfDone: string | null;
    status: string;
    seeds: SeedData[];
    assets: Array<{ id: string; title: string; category: string }>;
  };
  allSeeds: Array<{ id: string; title: string; status: string }>;
  directionId: string;
  onSeedActivate: (seedId: string) => void;
  onSeedDiscard: (seedId: string) => void;
  onAddSeed: (goalId: string) => void;
}

interface SeedFormData {
  title: string;
  description: string;
  suggestedDepartment: string;
  roughScope: string;
}

export default function GoalSection({
  goal,
  allSeeds,
  directionId,
  onSeedActivate,
  onSeedDiscard,
}: GoalSectionProps) {
  const [showAddSeed, setShowAddSeed] = useState(false);
  const [seedForm, setSeedForm] = useState<SeedFormData>({
    title: '',
    description: '',
    suggestedDepartment: 'tech',
    roughScope: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);
  const seedsContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const badge = GOAL_STATUS_BADGES[goal.status] || GOAL_STATUS_BADGES.planned;

  // Calculate progress: completed + activated seeds / total
  const totalSeeds = goal.seeds.length;
  const completedSeeds = goal.seeds.filter(
    (s) => s.status === 'completed' || s.status === 'activated',
  ).length;
  const progressPercent = totalSeeds > 0 ? (completedSeeds / totalSeeds) * 100 : 0;

  // Draw dependency arrows between seeds
  const drawDependencyArrows = useCallback(() => {
    const container = seedsContainerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    // Clear previous arrows
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const containerRect = container.getBoundingClientRect();
    svg.setAttribute('width', String(containerRect.width));
    svg.setAttribute('height', String(containerRect.height));

    for (const seed of goal.seeds) {
      if (!seed.dependencies) continue;
      let depIds: string[];
      try {
        depIds = JSON.parse(seed.dependencies);
      } catch {
        continue;
      }

      const targetEl = container.querySelector(`[data-seed-id="${seed.id}"]`);
      if (!targetEl) continue;
      const targetRect = targetEl.getBoundingClientRect();

      for (const depId of depIds) {
        const sourceEl = container.querySelector(`[data-seed-id="${depId}"]`);
        if (!sourceEl) continue;
        const sourceRect = sourceEl.getBoundingClientRect();

        // Arrow from source bottom to target top
        const x1 = sourceRect.left - containerRect.left + sourceRect.width / 2;
        const y1 = sourceRect.top - containerRect.top + sourceRect.height;
        const x2 = targetRect.left - containerRect.left + targetRect.width / 2;
        const y2 = targetRect.top - containerRect.top;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        line.setAttribute('stroke', 'rgba(255,255,255,0.15)');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '4,3');
        svg.appendChild(line);

        // Arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 6;
        const p1x = x2 - headLen * Math.cos(angle - Math.PI / 6);
        const p1y = y2 - headLen * Math.sin(angle - Math.PI / 6);
        const p2x = x2 - headLen * Math.cos(angle + Math.PI / 6);
        const p2y = y2 - headLen * Math.sin(angle + Math.PI / 6);
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', `${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`);
        polygon.setAttribute('fill', 'rgba(255,255,255,0.15)');
        svg.appendChild(polygon);
      }
    }
  }, [goal.seeds]);

  useEffect(() => {
    // Redraw arrows on mount and when seeds change
    const timer = setTimeout(drawDependencyArrows, 100);
    return () => clearTimeout(timer);
  }, [drawDependencyArrows]);

  const handleSubmitSeed = async () => {
    if (!seedForm.title.trim()) return;
    setSubmitting(true);
    try {
      await fetch(
        `/api/strategy/directions/${directionId}/goals/${goal.id}/seeds`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: seedForm.title.trim(),
            description: seedForm.description.trim() || undefined,
            suggestedDepartment: seedForm.suggestedDepartment,
            roughScope: seedForm.roughScope,
          }),
        },
      );
      setSeedForm({ title: '', description: '', suggestedDepartment: 'tech', roughScope: 'medium' });
      setShowAddSeed(false);
      // Parent should refresh data
      window.location.reload();
    } catch {
      // Error is acceptable; user can retry
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id={`goal-${goal.id}`} className="mb-6">
      {/* Goal Header */}
      <div className="flex items-center gap-3 mb-3">
        <h3
          className="text-base font-medium"
          style={{ color: 'rgba(255,255,255,0.85)' }}
        >
          {goal.title}
        </h3>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
          style={{ background: badge.bg, color: badge.text }}
        >
          {badge.label}
        </span>
      </div>

      {/* Definition of done */}
      {goal.definitionOfDone && (
        <p
          className="text-xs italic mb-3 leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          {goal.definitionOfDone}
        </p>
      )}

      {/* Progress Bar (D-10) */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="glass-deep rounded-full overflow-hidden"
          style={{ width: 200, height: 6 }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, rgba(34,197,94,0.7), rgba(34,197,94,0.9))',
              boxShadow: progressPercent > 0 ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
            }}
          />
        </div>
        <span className="text-[11px] font-medium tabular-nums" style={{ color: 'rgba(255,255,255,0.50)' }}>
          {completedSeeds}/{totalSeeds} seeds
        </span>
      </div>

      {/* Seeds List with dependency arrows overlay */}
      <div className="relative" ref={seedsContainerRef}>
        <svg
          ref={svgRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1 }}
        />
        <div className="space-y-2 relative" style={{ zIndex: 2 }}>
          {goal.seeds.map((seed) => (
            <SeedCard
              key={seed.id}
              seed={seed}
              allSeeds={allSeeds}
              onActivate={onSeedActivate}
              onDiscard={onSeedDiscard}
            />
          ))}
        </div>
      </div>

      {/* Linked assets */}
      {goal.assets.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Assets:
          </span>
          {goal.assets.map((asset) => (
            <span
              key={asset.id}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(139,92,246,0.12)',
                color: '#c4b5fd',
                border: '1px solid rgba(139,92,246,0.20)',
              }}
            >
              {asset.title}
            </span>
          ))}
        </div>
      )}

      {/* Add Seed */}
      <div className="mt-3">
        <button
          onClick={() => setShowAddSeed(!showAddSeed)}
          className="glass-pill flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          {showAddSeed ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          Add Seed
        </button>

        {showAddSeed && (
          <div
            className="glass-card rounded-lg p-3 mt-2 space-y-2"
            style={{ border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <input
              type="text"
              placeholder="Seed title (required)"
              value={seedForm.title}
              onChange={(e) => setSeedForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full bg-transparent text-sm px-2 py-1.5 rounded border outline-none"
              style={{
                borderColor: 'rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.85)',
              }}
            />
            <textarea
              placeholder="Description (optional)"
              value={seedForm.description}
              onChange={(e) => setSeedForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full bg-transparent text-xs px-2 py-1.5 rounded border outline-none resize-none"
              style={{
                borderColor: 'rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.70)',
              }}
            />
            <div className="flex items-center gap-2">
              <select
                value={seedForm.suggestedDepartment}
                onChange={(e) => setSeedForm((p) => ({ ...p, suggestedDepartment: e.target.value }))}
                className="bg-transparent text-xs px-2 py-1 rounded border outline-none cursor-pointer"
                style={{
                  borderColor: 'rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.70)',
                }}
              >
                <option value="tech">Tech</option>
                <option value="marketing">Marketing</option>
                <option value="operations">Operations</option>
              </select>
              <select
                value={seedForm.roughScope}
                onChange={(e) => setSeedForm((p) => ({ ...p, roughScope: e.target.value }))}
                className="bg-transparent text-xs px-2 py-1 rounded border outline-none cursor-pointer"
                style={{
                  borderColor: 'rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.70)',
                }}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
              <button
                onClick={handleSubmitSeed}
                disabled={submitting || !seedForm.title.trim()}
                className="glass-pill text-xs px-3 py-1 rounded-lg font-medium cursor-pointer ml-auto disabled:opacity-40"
                style={{ color: '#86efac' }}
              >
                {submitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
