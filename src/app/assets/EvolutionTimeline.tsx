'use client';

import { useEffect, useRef } from 'react';

/* ── Types ── */

interface AssetEvent {
  id: string;
  assetId: string;
  type: string;
  summary: string;
  metadata: string | null;
  agentId: string | null;
  createdAt: string;
}

interface EvolutionTimelineProps {
  selectedAssetId: string | null;
  events: AssetEvent[] | null;
}

/* ── Constants ── */

const EVENT_TYPE_COLORS: Record<string, string> = {
  creation: '#00d68f',
  promotion: '#e94560',
  steward_assessment: '#6496ff',
  maturity_change: '#ffb347',
  annotation: '#a855f6',
  location_added: '#e0e0e0',
  dependency_added: '#e0e0e0',
};

const MILESTONE_SPACING = 120;

/* ── Component ── */

export default function EvolutionTimeline({ selectedAssetId, events }: EvolutionTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayEvents = events && events.length > 0 ? events : null;

  // Sort chronologically (oldest first)
  const sorted = displayEvents
    ? [...displayEvents].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];

  // Auto-scroll to rightmost (newest) event
  useEffect(() => {
    if (scrollRef.current && sorted.length > 0) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [sorted.length, selectedAssetId]);

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    background: 'var(--bg-2)',
    borderTop: '1px solid var(--border)',
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: '8px 16px',
    zIndex: 40,
  };

  if (sorted.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-dim)',
          fontSize: 13,
        }}>
          Asset history will appear here
        </div>
      </div>
    );
  }

  const totalWidth = Math.max(sorted.length * MILESTONE_SPACING + 40, 400);

  return (
    <div style={containerStyle} ref={scrollRef}>
      <div style={{ position: 'relative', width: totalWidth, height: '100%' }}>
        {/* Horizontal center line */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 1,
          background: 'var(--border)',
        }} />

        {/* Milestone markers */}
        {sorted.map((ev, i) => {
          const x = 20 + i * MILESTONE_SPACING;
          const color = EVENT_TYPE_COLORS[ev.type] || 'var(--text-dim)';
          const truncatedSummary = ev.summary.length > 30
            ? ev.summary.slice(0, 27) + '...'
            : ev.summary;

          return (
            <div key={ev.id} style={{ position: 'absolute', left: x, top: 0, height: '100%', width: MILESTONE_SPACING - 8 }}>
              {/* Summary text (above line) */}
              <div style={{
                position: 'absolute',
                top: 4,
                left: 0,
                fontSize: 11,
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: MILESTONE_SPACING - 16,
              }}>
                {truncatedSummary}
              </div>

              {/* Circle marker (on the line) */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 6px ${color}`,
              }} />

              {/* Date text (below line) */}
              <div style={{
                position: 'absolute',
                bottom: 4,
                left: 0,
                fontSize: 11,
                color: 'var(--text-dim)',
                whiteSpace: 'nowrap',
              }}>
                {new Date(ev.createdAt).toLocaleDateString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
