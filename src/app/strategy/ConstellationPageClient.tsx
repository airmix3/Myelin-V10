'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ConstellationView from '@/components/strategy/ConstellationView';
import PrioritySetTabs from '@/components/strategy/PrioritySetTabs';
import type { OrbitNode } from '@/lib/strategy/constellation-layout';
import Link from 'next/link';

interface PrioritySetData {
  id: string;
  name: string;
  color: string | null;
  directionIds: string[];
}

interface ConstellationPageClientProps {
  directionNodes: OrbitNode[];
  goalNodes: OrbitNode[];
  prioritySets: PrioritySetData[];
}

export default function ConstellationPageClient({
  directionNodes,
  goalNodes,
  prioritySets,
}: ConstellationPageClientProps) {
  const router = useRouter();
  const [activeSetId, setActiveSetId] = useState<string | null>(null);

  // Derive highlighted direction IDs from the active priority set
  const highlightedDirectionIds = useMemo(() => {
    if (!activeSetId) return [];
    const set = prioritySets.find((s) => s.id === activeSetId);
    return set?.directionIds || [];
  }, [activeSetId, prioritySets]);

  const handleDirectionClick = useCallback(
    (directionId: string) => {
      router.push(`/strategy/directions/${directionId}`);
    },
    [router],
  );

  const handleGoalClick = useCallback(
    (goalId: string, parentDirectionId: string) => {
      router.push(`/strategy/directions/${parentDirectionId}#goal-${goalId}`);
    },
    [router],
  );

  // Empty state
  if (directionNodes.length === 0) {
    return (
      <div className="flex flex-col h-full p-6 gap-4">
        <h1 className="text-xl font-medium text-white/90">Strategic Constellation</h1>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full glass-card flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white/30"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </div>
            <p className="text-white/60 text-sm mb-4">
              No strategic directions yet. Start a canvas conversation to explore
              your first direction.
            </p>
            <Link
              href="/strategy/canvas"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg glass-card text-sm text-white/80 hover:text-white transition-colors"
            >
              Open Canvas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-white/90">Strategic Constellation</h1>
      </div>

      <PrioritySetTabs
        sets={prioritySets}
        activeSetId={activeSetId}
        onSetSelect={setActiveSetId}
      />

      <div className="flex-1 min-h-0">
        <ConstellationView
          directions={directionNodes}
          goals={goalNodes}
          activeSetId={activeSetId}
          highlightedDirectionIds={highlightedDirectionIds}
          onDirectionClick={handleDirectionClick}
          onGoalClick={handleGoalClick}
        />
      </div>
    </div>
  );
}
