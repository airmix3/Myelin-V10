'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, ChevronDown } from 'lucide-react';
import type { DirectionWithRelations } from './page';

const STATUS_COLORS: Record<string, string> = {
  active: '#8b5cf6',
  paused: '#6b7280',
  completed: '#22c55e',
  abandoned: '#ef4444',
};

const GOAL_STATUS_COLORS: Record<string, string> = {
  planned: '#6b7280',
  active: '#3b82f6',
  'at-risk': '#f59e0b',
  completed: '#22c55e',
  abandoned: '#ef4444',
};

const PRIORITY_TIERS = {
  focus: {
    label: 'Focus',
    color: '#f59e0b',
    bgAlpha: '15',
    description: 'Top priorities. Agent capacity allocated here first.',
  },
  active: {
    label: 'Active',
    color: '#8b5cf6',
    bgAlpha: '10',
    description: 'Being worked on, but not top priority.',
  },
  background: {
    label: 'Background',
    color: '#6b7280',
    bgAlpha: '08',
    description: 'Deliberately paused or slow burn.',
  },
} as const;

type PriorityKey = keyof typeof PRIORITY_TIERS;

const TIER_ORDER: PriorityKey[] = ['focus', 'active', 'background'];

interface PrioritiesClientProps {
  directions: DirectionWithRelations[];
}

function PriorityDropdown({
  current,
  onChangePriority,
}: {
  current: string;
  onChangePriority: (p: PriorityKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const tier = PRIORITY_TIERS[current as PriorityKey] || PRIORITY_TIERS.active;

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider cursor-pointer transition-colors"
        style={{
          color: tier.color,
          background: `${tier.color}15`,
          border: `1px solid ${tier.color}25`,
        }}
      >
        {tier.label}
        <ChevronDown size={10} style={{ color: tier.color }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 rounded-lg overflow-hidden min-w-[140px]"
            style={{
              background: 'rgba(10,16,36,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            }}
          >
            {TIER_ORDER.map((key) => {
              const t = PRIORITY_TIERS[key];
              const isActive = key === current;
              return (
                <button
                  key={key}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangePriority(key);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] font-medium transition-colors cursor-pointer"
                  style={{
                    color: isActive ? t.color : '#94a3b8',
                    background: isActive ? `${t.color}10` : 'transparent',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: t.color }}
                  />
                  {t.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DirectionCard({
  direction,
  onChangePriority,
}: {
  direction: DirectionWithRelations;
  onChangePriority: (id: string, p: PriorityKey) => void;
}) {
  const statusColor = STATUS_COLORS[direction.status] || STATUS_COLORS.active;
  const maxDecisions = 2;
  const visibleDecisions = direction.decisions.slice(0, maxDecisions);
  const extraDecisions = direction.decisions.length - maxDecisions;

  return (
    <motion.div
      layout
      layoutId={direction.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="glass-card rounded-xl p-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[14px] font-semibold text-white/90 truncate">
              {direction.title}
            </h3>
            <span
              className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider"
              style={{
                color: statusColor,
                background: `${statusColor}15`,
              }}
            >
              {direction.status}
            </span>
          </div>
          {direction.rationale && (
            <p className="text-[12px] text-slate-400 leading-relaxed line-clamp-2">
              {direction.rationale}
            </p>
          )}
        </div>

        <PriorityDropdown
          current={direction.priority}
          onChangePriority={(p) => onChangePriority(direction.id, p)}
        />
      </div>

      {/* Decisions */}
      {direction.decisions.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
            Decisions
          </h4>
          <div className="space-y-1">
            {visibleDecisions.map((d) => (
              <div key={d.id} className="flex items-start gap-1.5">
                <span className="shrink-0 mt-[5px] w-1 h-1 rounded-full bg-slate-600" />
                <p className="text-[11px] text-slate-500 leading-snug truncate">
                  {d.summary}
                </p>
              </div>
            ))}
            {extraDecisions > 0 && (
              <p className="text-[10px] text-slate-600 pl-2.5">
                +{extraDecisions} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Goals */}
      {direction.goals.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
            Goals
          </h4>
          <div className="space-y-1">
            {direction.goals.map((g) => {
              const goalColor = GOAL_STATUS_COLORS[g.status] || GOAL_STATUS_COLORS.planned;
              return (
                <div key={g.id} className="flex items-center gap-2">
                  <span
                    className="shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{ background: goalColor }}
                  />
                  <span className="text-[11px] text-slate-400 truncate flex-1">
                    {g.title}
                  </span>
                  <span
                    className="text-[9px] font-medium uppercase tracking-wider shrink-0"
                    style={{ color: goalColor }}
                  >
                    {g.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No connections */}
      {direction.decisions.length === 0 && direction.goals.length === 0 && (
        <p className="mt-3 pt-3 text-[11px] text-slate-600 italic" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          No connected decisions or goals yet
        </p>
      )}
    </motion.div>
  );
}

export default function PrioritiesClient({ directions: initialDirections }: PrioritiesClientProps) {
  const [directions, setDirections] = useState(initialDirections);

  const handlePriorityChange = useCallback(async (id: string, newPriority: PriorityKey) => {
    // Optimistic update
    setDirections((prev) =>
      prev.map((d) => (d.id === id ? { ...d, priority: newPriority } : d)),
    );

    try {
      const res = await fetch(`/api/strategy/directions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });

      if (!res.ok) {
        // Revert on failure
        setDirections((prev) =>
          prev.map((d) => {
            const original = initialDirections.find((o) => o.id === d.id);
            return d.id === id && original ? { ...d, priority: original.priority } : d;
          }),
        );
      }
    } catch {
      // Revert on network error
      setDirections((prev) =>
        prev.map((d) => {
          const original = initialDirections.find((o) => o.id === d.id);
          return d.id === id && original ? { ...d, priority: original.priority } : d;
        }),
      );
    }
  }, [initialDirections]);

  return (
    <div className="flex flex-col h-full p-6 gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <Target size={20} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-medium text-white/90">Strategic Priorities</h1>
          <p className="text-[12px] text-slate-500">
            Focus on what matters. Dim the noise.
          </p>
        </div>
      </div>

      {/* Tier sections */}
      {TIER_ORDER.map((tierKey) => {
        const tier = PRIORITY_TIERS[tierKey];
        const tierDirections = directions.filter((d) => d.priority === tierKey);
        const isFaded = tierKey === 'background';

        return (
          <section
            key={tierKey}
            className="transition-opacity"
            style={{ opacity: isFaded ? 0.6 : 1 }}
          >
            {/* Tier header */}
            <div
              className="flex items-center gap-3 mb-3 pb-2"
              style={{ borderBottom: `1px solid ${tier.color}20` }}
            >
              <div
                className="w-1 h-6 rounded-full"
                style={{
                  background: tier.color,
                  boxShadow: tierKey === 'focus' ? `0 0 12px ${tier.color}40` : undefined,
                }}
              />
              <div className="flex items-center gap-2">
                <h2
                  className="text-[13px] font-bold uppercase tracking-widest"
                  style={{ color: tier.color }}
                >
                  {tier.label}
                </h2>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  style={{
                    color: tier.color,
                    background: `${tier.color}12`,
                  }}
                >
                  {tierDirections.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 ml-1">{tier.description}</p>
            </div>

            {/* Direction cards */}
            {tierDirections.length > 0 ? (
              <div className="grid gap-3">
                <AnimatePresence mode="popLayout">
                  {tierDirections.map((d) => (
                    <DirectionCard
                      key={d.id}
                      direction={d}
                      onChangePriority={handlePriorityChange}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div
                className="rounded-xl py-6 text-center text-[12px] text-slate-600 italic"
                style={{
                  border: `1px dashed ${tier.color}20`,
                  background: `${tier.color}05`,
                }}
              >
                No {tier.label.toLowerCase()} directions
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
