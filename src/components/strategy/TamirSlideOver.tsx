'use client';

/**
 * TamirSlideOver — right-side slide-over panel that embeds the Tamir routing
 * interface on top of the canvas page. Opens with a slide-in animation from
 * the right, with a semi-transparent backdrop overlay.
 */

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TamirSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TamirSlideOver({ isOpen, onClose }: TamirSlideOverProps) {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.30)' }}
            onClick={onClose}
          />

          {/* Slide-over panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full z-50 flex flex-col"
            style={{
              width: '480px',
              background: 'var(--glass-surface)',
              backdropFilter: 'blur(18px) saturate(150%) brightness(1.08)',
              WebkitBackdropFilter: 'blur(18px) saturate(150%) brightness(1.08)',
              borderLeft: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: '#ef4444',
                    boxShadow: '0 0 8px rgba(239,68,68,0.4)',
                  }}
                />
                <span className="text-sm font-semibold text-white/85">
                  Tamir
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Chief of Staff
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{
                  color: 'rgba(255,255,255,0.40)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tamir page embed via iframe */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src="/tamir"
                className="w-full h-full border-0"
                title="Tamir - Chief of Staff"
                style={{
                  background: 'transparent',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
