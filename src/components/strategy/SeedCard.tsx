'use client';

import { useState, useMemo } from 'react';
import { X, Check, ExternalLink, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export interface SeedData {
  id: string;
  title: string;
  description: string | null;
  suggestedDepartment: string | null;
  roughScope: string | null;
  dependencies: string | null; // JSON array of seed IDs
  strategicContext: string | null;
  status: string; // planned|activated|discarded
  taskId: string | null;
}

export interface SeedCardProps {
  seed: SeedData;
  allSeeds: Array<{ id: string; title: string; status: string }>;
  onActivate: (seedId: string) => void;
  onDiscard: (seedId: string) => void;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  planned: {
    bg: 'rgba(100,116,139,0.20)',
    text: '#94a3b8',
    label: 'Planned',
  },
  activated: {
    bg: 'rgba(59,130,246,0.20)',
    text: '#93c5fd',
    label: 'Activated',
  },
  completed: {
    bg: 'rgba(34,197,94,0.20)',
    text: '#86efac',
    label: 'Completed',
  },
  discarded: {
    bg: 'rgba(100,116,139,0.15)',
    text: '#64748b',
    label: 'Discarded',
  },
};

const DEPT_COLORS: Record<string, { bg: string; text: string }> = {
  tech: { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd' },
  marketing: { bg: 'rgba(236,72,153,0.15)', text: '#f9a8d4' },
  operations: { bg: 'rgba(34,197,94,0.15)', text: '#86efac' },
};

const SCOPE_LABELS: Record<string, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
};

export default function SeedCard({ seed, allSeeds, onActivate, onDiscard }: SeedCardProps) {
  const [showDepWarning, setShowDepWarning] = useState(false);

  const badge = STATUS_BADGES[seed.status] || STATUS_BADGES.planned;
  const deptStyle = DEPT_COLORS[seed.suggestedDepartment || ''] || DEPT_COLORS.tech;

  // Parse dependencies
  const depIds = useMemo(() => {
    if (!seed.dependencies) return [];
    try {
      return JSON.parse(seed.dependencies) as string[];
    } catch {
      return [];
    }
  }, [seed.dependencies]);

  // Check if any dependency is not completed/activated
  const unmetDeps = useMemo(() => {
    return depIds
      .map((id) => allSeeds.find((s) => s.id === id))
      .filter((s) => s && s.status !== 'completed' && s.status !== 'activated');
  }, [depIds, allSeeds]);

  const handleActivate = () => {
    if (unmetDeps.length > 0) {
      setShowDepWarning(true);
      // Still allow activation after showing warning
      setTimeout(() => setShowDepWarning(false), 4000);
    }
    onActivate(seed.id);
  };

  const isDiscarded = seed.status === 'discarded';

  return (
    <div
      className="glass-card rounded-lg p-3 relative"
      data-seed-id={seed.id}
      style={{ opacity: isDiscarded ? 0.5 : 1 }}
    >
      {/* Row 1: Title + Status Badge */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h5
          className="text-sm font-medium leading-tight"
          style={{
            color: isDiscarded ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.90)',
            textDecoration: isDiscarded ? 'line-through' : 'none',
          }}
        >
          {seed.title}
        </h5>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: badge.bg, color: badge.text }}
          >
            {seed.status === 'completed' && (
              <Check className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
            )}
            {badge.label}
          </span>
        </div>
      </div>

      {/* Row 2: Description */}
      {seed.description && (
        <p
          className="text-xs leading-relaxed mb-2"
          style={{ color: isDiscarded ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.50)' }}
        >
          {seed.description}
        </p>
      )}

      {/* Row 3: Metadata pills */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {seed.suggestedDepartment && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
            style={{ background: deptStyle.bg, color: deptStyle.text }}
          >
            {seed.suggestedDepartment}
          </span>
        )}
        {seed.roughScope && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}
          >
            {SCOPE_LABELS[seed.roughScope] || seed.roughScope}
          </span>
        )}
      </div>

      {/* Row 4: Dependencies */}
      {depIds.length > 0 && (
        <div className="text-[11px] mb-2" style={{ color: 'rgba(255,255,255,0.40)' }}>
          Depends on:{' '}
          {depIds.map((depId, i) => {
            const depSeed = allSeeds.find((s) => s.id === depId);
            return (
              <span key={depId}>
                {i > 0 && ', '}
                <span style={{ color: 'rgba(255,255,255,0.60)' }}>
                  {depSeed?.title || depId}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Dependency warning tooltip */}
      {showDepWarning && unmetDeps.length > 0 && (
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md mb-2 text-[11px]"
          style={{
            background: 'rgba(245,158,11,0.10)',
            border: '1px solid rgba(245,158,11,0.25)',
            color: '#fcd34d',
          }}
        >
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>
            Depends on{' '}
            {unmetDeps.map((s) => s!.title).join(', ')}{' '}
            which {unmetDeps.length === 1 ? "isn't" : "aren't"} done yet
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {seed.status === 'planned' && (
          <>
            <button
              onClick={handleActivate}
              className="glass-pill text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors hover:brightness-110"
              style={{ color: '#93c5fd' }}
            >
              Activate
            </button>
            <button
              onClick={() => onDiscard(seed.id)}
              className="p-1 rounded transition-colors cursor-pointer"
              style={{ color: 'rgba(255,255,255,0.30)' }}
              title="Discard seed"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {seed.status === 'activated' && seed.taskId && (
          <Link
            href={`/tamir?taskId=${seed.taskId}`}
            className="flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: '#93c5fd' }}
          >
            <ExternalLink className="w-3 h-3" />
            View Task
          </Link>
        )}
      </div>
    </div>
  );
}
