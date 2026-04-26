'use client';

import { motion } from 'motion/react';

interface StepIndicatorProps {
  currentPhase: number;
  completedPhases: number[];
}

export default function StepIndicator({ currentPhase, completedPhases }: StepIndicatorProps) {
  const totalPhases = 9;

  function getStatus(phase: number): 'active' | 'completed' | 'inactive' {
    if (completedPhases.includes(phase)) return 'completed';
    if (phase === currentPhase) return 'active';
    return 'inactive';
  }

  function getColor(status: 'active' | 'completed' | 'inactive'): string {
    switch (status) {
      case 'active':
        return '#38bdf8'; // sky-400
      case 'completed':
        return '#10b981'; // emerald-400
      case 'inactive':
        return 'rgba(255,255,255,0.15)';
    }
  }

  function getLabel(phase: number, status: string): string {
    return `Phase ${phase} of ${totalPhases}, ${status}`;
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={currentPhase}
      aria-valuemin={1}
      aria-valuemax={totalPhases}
      className="flex items-center justify-center gap-2"
    >
      {Array.from({ length: totalPhases }, (_, i) => {
        const phase = i + 1;
        const status = getStatus(phase);
        return (
          <motion.div
            key={phase}
            aria-label={getLabel(phase, status)}
            className="rounded-full"
            style={{
              width: 8,
              height: 8,
            }}
            animate={{ backgroundColor: getColor(status) }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          />
        );
      })}
    </div>
  );
}
