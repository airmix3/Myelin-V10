'use client';

import { useCallback, useEffect, useState } from 'react';

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

interface AssetLocation {
  id: string;
  assetId: string;
  type: string;
  value: string;
  label: string | null;
  isCanonical: boolean;
  createdAt: string;
}

interface AssetDetail {
  id: string;
  title: string;
  description: string | null;
  category: string;
  maturity: string;
  stewardId: string | null;
  returnFactors: string | null;
  annotations: string | null;
  healthStatus: string;
  directoryPath: string | null;
  createdAt: string;
  updatedAt: string;
  events: AssetEvent[];
  locations: AssetLocation[];
  dependsOn: { id: string; targetId: string; targetTitle: string; label: string | null }[];
  dependedBy: { id: string; sourceId: string; sourceTitle: string; label: string | null }[];
  rippleCount: number;
}

interface AssetDetailPanelProps {
  assetId: string;
  onClose: () => void;
  onAssetUpdated: () => void;
}

/* ── Constants ── */

const MATURITY_LEVELS = ['nascent', 'developing', 'established', 'foundational', 'legacy', 'heritage'] as const;

const EVENT_TYPE_COLORS: Record<string, string> = {
  creation: '#00d68f',
  promotion: 'var(--accent)',
  steward_assessment: '#6496ff',
  maturity_change: '#ffb347',
  annotation: '#a855f6',
  location_added: '#e0e0e0',
  dependency_added: '#e0e0e0',
};

const RETURN_FACTOR_COLORS: Record<string, { color: string; label: string }> = {
  revenue: { color: '#ffb347', label: 'Revenue generation' },
  moat: { color: '#6496ff', label: 'Competitive moat' },
  core_tech: { color: '#00d68f', label: 'Core technology' },
  brand_equity: { color: '#a855f6', label: 'Brand equity' },
};

const HEALTH_LABELS: Record<string, { color: string; text: (asset: AssetDetail) => string }> = {
  healthy: {
    color: '#00d68f',
    text: () => 'Active and maintained',
  },
  stale: {
    color: '#ffb347',
    text: (asset) => {
      const days = Math.floor((Date.now() - new Date(asset.updatedAt).getTime()) / 86400000);
      return `No activity in ${days} days`;
    },
  },
  degraded: { color: 'var(--red)', text: () => 'Degraded' },
  critical: { color: 'var(--red)', text: () => 'Critical' },
};

const LOCATION_TYPE_ICONS: Record<string, string> = {
  local_path: '\u{1F4C1}',
  github_url: '\u{1F517}',
  platform_url: '\u{1F310}',
  custom: '\u{1F4CC}',
};

type TabId = 'past' | 'present' | 'future';

/* ── Component ── */

export default function AssetDetailPanel({ assetId, onClose, onAssetUpdated }: AssetDetailPanelProps) {
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('present');
  const [annotationText, setAnnotationText] = useState('');
  const [submittingAnnotation, setSubmittingAnnotation] = useState(false);
  const [maturityOpen, setMaturityOpen] = useState(false);
  const [locationFormOpen, setLocationFormOpen] = useState(false);
  const [locationType, setLocationType] = useState('local_path');
  const [locationValue, setLocationValue] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [locationCanonical, setLocationCanonical] = useState(false);

  /* ── Data fetching ── */

  const fetchAsset = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`);
      if (res.ok) {
        const data = await res.json();
        setAsset(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchAsset();
  }, [fetchAsset]);

  /* ── Escape key ── */

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  /* ── Handlers ── */

  const handleAddAnnotation = async () => {
    if (!annotationText.trim()) return;
    setSubmittingAnnotation(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: annotationText.trim() }),
      });
      if (res.ok) {
        setAnnotationText('');
        await fetchAsset();
        onAssetUpdated();
      }
    } catch {
      // silently fail
    } finally {
      setSubmittingAnnotation(false);
    }
  };

  const handleMaturityChange = async (level: string) => {
    if (!confirm(`Change maturity to ${level}?`)) return;
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maturity: level }),
      });
      if (res.ok) {
        setMaturityOpen(false);
        await fetchAsset();
        onAssetUpdated();
      }
    } catch {
      // silently fail
    }
  };

  const handleAddLocation = async () => {
    if (!locationValue.trim()) return;
    try {
      const res = await fetch(`/api/assets/${assetId}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: locationType,
          value: locationValue.trim(),
          label: locationLabel.trim() || null,
          isCanonical: locationCanonical,
        }),
      });
      if (res.ok) {
        setLocationFormOpen(false);
        setLocationValue('');
        setLocationLabel('');
        setLocationCanonical(false);
        await fetchAsset();
        onAssetUpdated();
      }
    } catch {
      // silently fail
    }
  };

  /* ── Styles ── */

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    right: 0,
    top: 0,
    width: 360,
    height: '100vh',
    background: 'var(--bg-2)',
    borderLeft: '1px solid var(--border)',
    zIndex: 100,
    overflowY: 'auto',
    padding: 16,
    animation: 'slideInRight 0.2s ease-out',
  };

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
  };

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid var(--border)',
    marginBottom: 16,
    marginTop: 16,
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: 13,
    color: active ? 'var(--text)' : 'var(--text-dim)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
  });

  const badgeStyle = (bg: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    background: bg,
    color: '#fff',
    marginRight: 8,
  });

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-dim)',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    marginTop: 16,
  };

  /* ── Shimmer loading ── */

  if (loading) {
    return (
      <div style={panelStyle}>
        <button style={closeButtonStyle} onClick={onClose}>X</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 40 }}>
          {[200, 150, 180].map((w, i) => (
            <div key={i} style={{
              width: w,
              height: 16,
              borderRadius: 4,
              background: 'linear-gradient(90deg, var(--border) 25%, var(--bg-3) 50%, var(--border) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }} />
          ))}
        </div>
        <style>{`
          @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
          @keyframes slideInRight { from { transform: translateX(360px); } to { transform: translateX(0); } }
        `}</style>
      </div>
    );
  }

  if (!asset) {
    return (
      <div style={panelStyle}>
        <button style={closeButtonStyle} onClick={onClose}>X</button>
        <p style={{ color: 'var(--text-dim)', marginTop: 40 }}>Failed to load asset.</p>
      </div>
    );
  }

  /* ── Parse JSON fields ── */

  const returnFactors: string[] = asset.returnFactors ? JSON.parse(asset.returnFactors) : [];
  const annotations: { text: string; createdAt: string }[] = asset.annotations ? JSON.parse(asset.annotations) : [];

  /* ── Category color mapping ── */

  const categoryColors: Record<string, string> = {
    code: '#00d68f',
    brand: '#a855f6',
    IP: '#6496ff',
    'digital-product': '#00bcd4',
    knowledge: '#ffb347',
  };

  /* ── Render tabs ── */

  const renderPastTab = () => {
    if (asset.events.length === 0) {
      return <p style={{ color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic' }}>No history recorded yet</p>;
    }
    const sorted = [...asset.events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map((ev) => (
          <div key={ev.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: EVENT_TYPE_COLORS[ev.type] || 'var(--text-dim)',
              marginTop: 5,
              flexShrink: 0,
            }} />
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{ev.type.replace(/_/g, ' ')}</span>
              <p style={{ fontSize: 13, color: 'var(--text)', margin: '2px 0' }}>{ev.summary}</p>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {new Date(ev.createdAt).toLocaleDateString()} {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPresentTab = () => {
    const healthInfo = HEALTH_LABELS[asset.healthStatus] || HEALTH_LABELS.healthy;

    return (
      <div>
        {/* Health Status */}
        <div style={sectionTitleStyle}>Health</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={badgeStyle(healthInfo.color)}>{asset.healthStatus}</span>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{healthInfo.text(asset)}</span>
        </div>

        {/* Locations */}
        <div style={sectionTitleStyle}>Locations</div>
        {asset.locations.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>No locations tracked</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {asset.locations.map((loc) => (
              <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span>{LOCATION_TYPE_ICONS[loc.type] || LOCATION_TYPE_ICONS.custom}</span>
                <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                  {loc.value}
                </span>
                {loc.label && <span style={{ color: 'var(--text-dim)' }}>({loc.label})</span>}
                {loc.isCanonical && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d68f', display: 'inline-block' }} />}
              </div>
            ))}
          </div>
        )}

        {/* Return Factors */}
        <div style={sectionTitleStyle}>Return Factors</div>
        {returnFactors.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>None assigned</p>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {returnFactors.map((f) => {
              const info = RETURN_FACTOR_COLORS[f];
              if (!info) return null;
              return (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: info.color, display: 'inline-block' }} />
                  <span style={{ color: 'var(--text)' }}>{info.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Annotations */}
        <div style={sectionTitleStyle}>Annotations</div>
        {annotations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            {annotations.map((ann, i) => (
              <div key={i} style={{ fontSize: 13, padding: 8, background: 'var(--bg)', borderRadius: 4, border: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--text)', margin: 0 }}>{ann.text}</p>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {new Date(ann.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={annotationText}
            onChange={(e) => setAnnotationText(e.target.value)}
            placeholder="Add a note about this asset..."
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddAnnotation(); }}
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: 13,
              fontFamily: 'var(--font)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAddAnnotation}
            disabled={submittingAnnotation || !annotationText.trim()}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              fontFamily: 'var(--font)',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: submittingAnnotation || !annotationText.trim() ? 'not-allowed' : 'pointer',
              opacity: submittingAnnotation || !annotationText.trim() ? 0.5 : 1,
            }}
          >
            Add
          </button>
        </div>

        {/* Actions: Change Maturity */}
        <div style={sectionTitleStyle}>Actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <button
              onClick={() => setMaturityOpen(!maturityOpen)}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                fontFamily: 'var(--font)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text)',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              Change Maturity (current: {asset.maturity})
            </button>
            {maturityOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, padding: 4, background: 'var(--bg)', borderRadius: 4, border: '1px solid var(--border)' }}>
                {MATURITY_LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => handleMaturityChange(level)}
                    disabled={level === asset.maturity}
                    style={{
                      padding: '4px 8px',
                      fontSize: 13,
                      fontFamily: 'var(--font)',
                      background: level === asset.maturity ? 'var(--border)' : 'transparent',
                      border: 'none',
                      borderRadius: 4,
                      color: level === asset.maturity ? 'var(--text-dim)' : 'var(--text)',
                      cursor: level === asset.maturity ? 'default' : 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add Location */}
          <div>
            <button
              onClick={() => setLocationFormOpen(!locationFormOpen)}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                fontFamily: 'var(--font)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text)',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              Add Location
            </button>
            {locationFormOpen && (
              <div style={{ marginTop: 4, padding: 8, background: 'var(--bg)', borderRadius: 4, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <select
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: 13, fontFamily: 'var(--font)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}
                >
                  <option value="local_path">Local Path</option>
                  <option value="github_url">GitHub URL</option>
                  <option value="platform_url">Platform URL</option>
                  <option value="custom">Custom</option>
                </select>
                <input
                  type="text"
                  value={locationValue}
                  onChange={(e) => setLocationValue(e.target.value)}
                  placeholder="Value (path or URL)"
                  style={{ padding: '4px 8px', fontSize: 13, fontFamily: 'var(--font)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', outline: 'none' }}
                />
                <input
                  type="text"
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  placeholder="Label (optional)"
                  style={{ padding: '4px 8px', fontSize: 13, fontFamily: 'var(--font)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', outline: 'none' }}
                />
                <label style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={locationCanonical}
                    onChange={(e) => setLocationCanonical(e.target.checked)}
                  />
                  Canonical location
                </label>
                <button
                  onClick={handleAddLocation}
                  disabled={!locationValue.trim()}
                  style={{
                    padding: '4px 8px',
                    fontSize: 13,
                    fontFamily: 'var(--font)',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: !locationValue.trim() ? 'not-allowed' : 'pointer',
                    opacity: !locationValue.trim() ? 0.5 : 1,
                  }}
                >
                  Save Location
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dependencies */}
        <div style={sectionTitleStyle}>Dependencies</div>
        {asset.dependsOn.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Depends on:</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {asset.dependsOn.map((d) => (
                <span key={d.id} style={{ fontSize: 13, color: 'var(--accent)' }}>
                  {d.targetTitle}{d.label ? ` (${d.label})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
        {asset.dependedBy.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Depended by:</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {asset.dependedBy.map((d) => (
                <span key={d.id} style={{ fontSize: 13, color: 'var(--accent)' }}>
                  {d.sourceTitle}{d.label ? ` (${d.label})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
        {asset.rippleCount > 0 && (
          <p style={{ fontSize: 13, color: 'var(--amber)', marginTop: 4 }}>
            Changing this asset may affect {asset.rippleCount} dependent assets
          </p>
        )}
        {asset.dependsOn.length === 0 && asset.dependedBy.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>No dependencies</p>
        )}
      </div>
    );
  };

  const renderFutureTab = () => {
    return (
      <div>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic' }}>No planned work for this asset</p>
        <div style={{ ...sectionTitleStyle, marginTop: 24 }}>Steward Recommendations</div>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic' }}>Coming in a future update</p>
      </div>
    );
  };

  return (
    <div style={panelStyle}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes slideInRight { from { transform: translateX(360px); } to { transform: translateX(0); } }
      `}</style>

      {/* Close button */}
      <button style={closeButtonStyle} onClick={onClose}>X</button>

      {/* Header */}
      <div style={{ marginTop: 4, marginBottom: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, paddingRight: 32 }}>{asset.title}</h2>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={badgeStyle(categoryColors[asset.category] || 'var(--border)')}>{asset.category}</span>
          <span style={badgeStyle('var(--bg-3)')}>{asset.maturity}</span>
          {asset.stewardId && (
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Steward: {asset.stewardId.toUpperCase()}</span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        {(['past', 'present', 'future'] as TabId[]).map((tab) => (
          <button key={tab} style={tabStyle(activeTab === tab)} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ paddingBottom: 80 }}>
        {activeTab === 'past' && renderPastTab()}
        {activeTab === 'present' && renderPresentTab()}
        {activeTab === 'future' && renderFutureTab()}
      </div>

      {/* Steward chat stub */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 0',
        background: 'var(--bg-2)',
        borderTop: '1px solid var(--border)',
      }}>
        <input
          type="text"
          placeholder="Ask the steward about this asset..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              // Steward chat stub - will be wired in Plan 05
              (e.target as HTMLInputElement).value = '';
            }
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 13,
            fontFamily: 'var(--font)',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text)',
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
}
