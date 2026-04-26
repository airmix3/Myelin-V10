'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraduationScreenProps {
  companyName: string;
  departmentCount: number;
  departmentNames?: string[];
  filesIngested: number;
  cosName: string;
  onEnterCortex: () => void;
}

// ---------------------------------------------------------------------------
// GraduationScreen Component
// ---------------------------------------------------------------------------

export default function GraduationScreen({
  companyName,
  departmentCount,
  departmentNames,
  filesIngested,
  cosName,
  onEnterCortex,
}: GraduationScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnterCortex = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/onboarding/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || 'Completion failed');
      }

      // Force full navigation so middleware cookie takes effect
      window.location.href = '/';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center flex-1"
      style={{ maxWidth: '520px', margin: '0 auto', padding: '0 16px' }}
    >
      {/* Heading */}
      <h1
        className="text-white text-center mb-4"
        style={{ fontSize: '28px', fontWeight: 600, lineHeight: 1.15 }}
      >
        Your Company Is Alive
      </h1>

      {/* Body paragraph */}
      <p
        className="text-center mb-6"
        style={{
          fontSize: '14px',
          fontWeight: 400,
          lineHeight: 1.5,
          color: '#94a3b8',
          maxWidth: '440px',
        }}
      >
        {companyName || 'Your company'} is ready to operate. {cosName} has set
        up {departmentCount} department{departmentCount !== 1 ? 's' : ''} and
        ingested {filesIngested} file{filesIngested !== 1 ? 's' : ''} into the
        system.
      </p>
      <p
        className="text-center mb-8"
        style={{
          fontSize: '14px',
          fontWeight: 400,
          lineHeight: 1.5,
          color: '#94a3b8',
          maxWidth: '440px',
        }}
      >
        Your Living Company is waiting for its first strategic direction.
      </p>

      {/* Summary card */}
      <div
        className="glass-card w-full mb-8 p-6 rounded-xl"
        style={{
          background: 'rgba(10,18,40,0.52)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Departments */}
        <div className="mb-4">
          <div
            className="flex items-center gap-2 mb-2"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            Departments: {departmentCount}
          </div>
          {departmentNames && departmentNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {departmentNames.map((name) => (
                <span
                  key={name}
                  className="px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(56,189,248,0.1)',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Files Ingested */}
        <div className="mb-4">
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            Files Ingested: {filesIngested}
          </div>
        </div>

        {/* DNA Status */}
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            DNA Status: Complete
          </span>
          <Check
            className="w-4 h-4"
            style={{ color: '#10b981' }}
          />
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={handleEnterCortex}
        disabled={isLoading}
        className="px-8 py-4 rounded-xl cursor-pointer transition-all hover:brightness-110 disabled:opacity-60"
        style={{
          background: '#38bdf8',
          color: '#0a0f1a',
          fontSize: '18px',
          fontWeight: 600,
          border: 'none',
        }}
      >
        {isLoading ? 'Entering...' : 'Enter The Cortex'}
      </button>

      {/* Error */}
      {error && (
        <p
          className="mt-3 text-center"
          style={{
            fontSize: '11px',
            fontWeight: 400,
            color: '#f43f5e',
          }}
        >
          {error}
        </p>
      )}
    </motion.div>
  );
}
