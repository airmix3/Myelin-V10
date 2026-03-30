'use client';

import { useState } from 'react';

interface PromotionRecommendation {
  suggestedBy: string;
  rationale: string;
  assetName?: string;
  category?: string;
  returnFactors?: string[];
}

interface PromotionBannerProps {
  taskMetadata: string | null;
  taskId?: string;
  deliverableId: string;
  deliverableTitle?: string;
  onPromoted: () => void;
}

export default function PromotionBanner({ taskMetadata, taskId, deliverableId, deliverableTitle, onPromoted }: PromotionBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse metadata to find promotionRecommendation
  let recommendation: PromotionRecommendation | null = null;
  if (taskMetadata) {
    try {
      const parsed = JSON.parse(taskMetadata);
      if (parsed.promotionRecommendation) {
        recommendation = parsed.promotionRecommendation;
      }
    } catch {
      // invalid metadata JSON
    }
  }

  if (!recommendation || dismissed) return null;

  const stewardName = recommendation.suggestedBy?.toUpperCase() || 'Steward';

  const handleAcceptPromotion = async () => {
    setPromoting(true);
    setError(null);
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: recommendation!.assetName || deliverableTitle || 'Untitled Asset',
          category: recommendation!.category || 'knowledge',
          stewardId: recommendation!.suggestedBy || 'cto',
          returnFactors: recommendation!.returnFactors || [],
        }),
      });
      if (res.ok) {
        onPromoted();
      } else {
        setError('Failed to promote deliverable. Please try again.');
      }
    } catch {
      setError('Failed to promote deliverable. Please try again.');
    } finally {
      setPromoting(false);
    }
  };

  const handleDismiss = async () => {
    // Remove promotionRecommendation from task metadata
    if (taskId && taskMetadata) {
      try {
        const parsed = JSON.parse(taskMetadata);
        delete parsed.promotionRecommendation;
        await fetch(`/api/tasks/${taskId}/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata: JSON.stringify(parsed) }),
        });
      } catch {
        // silently fail metadata update
      }
    }
    setDismissed(true);
  };

  return (
    <div style={{
      width: '100%',
      padding: '12px 16px',
      background: 'var(--bg-2)',
      borderLeft: '3px solid var(--accent)',
      borderRadius: 4,
      marginBottom: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            {stewardName} recommends promoting this deliverable to a company asset
          </p>
          {recommendation.rationale && (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0 0 0' }}>
              {recommendation.rationale}
            </p>
          )}
          {error && (
            <p style={{ fontSize: 13, color: 'var(--red)', margin: '4px 0 0 0' }}>{error}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleAcceptPromotion}
            disabled={promoting}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              fontFamily: 'var(--font)',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: promoting ? 'not-allowed' : 'pointer',
              opacity: promoting ? 0.6 : 1,
            }}
          >
            {promoting ? 'Promoting...' : 'Accept Promotion'}
          </button>
          <button
            onClick={handleDismiss}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              fontFamily: 'var(--font)',
              background: 'transparent',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Dismiss Recommendation
          </button>
        </div>
      </div>
    </div>
  );
}
