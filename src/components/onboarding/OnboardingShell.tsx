'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import StepIndicator from './StepIndicator';

interface OnboardingShellProps {
  children: React.ReactNode;
  currentPhase: number;
  completedPhases: number[];
}

export default function OnboardingShell({
  children,
  currentPhase,
  completedPhases,
}: OnboardingShellProps) {
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Auto-dismiss save confirmation after 2.5 seconds
  useEffect(() => {
    if (showSaveConfirm) {
      const timer = setTimeout(() => setShowSaveConfirm(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showSaveConfirm]);

  return (
    <div className="flex flex-col min-h-screen relative" style={{ paddingTop: 64, paddingBottom: 64 }}>
      {/* Save & Continue Later indicator -- visible only during active onboarding */}
      {currentPhase > 0 && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={() => setShowSaveConfirm(true)}
            className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            Progress saved
          </button>
          <AnimatePresence>
            {showSaveConfirm && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass-card mt-2 px-3 py-2 text-xs text-slate-300 max-w-[220px]"
              >
                Your progress is saved. You can close this tab and return anytime.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPhase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Step indicator fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 flex justify-center" style={{ paddingBottom: 24 }}>
        <StepIndicator currentPhase={currentPhase} completedPhases={completedPhases} />
      </div>
    </div>
  );
}
