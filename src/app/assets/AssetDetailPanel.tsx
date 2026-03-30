'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  locations: { id: string; type: string; value: string; label: string | null; isCanonical: boolean }[];
  dependsOn: { id: string; targetId: string; targetTitle: string; label: string | null }[];
  dependedBy: { id: string; sourceId: string; sourceTitle: string; label: string | null }[];
  rippleCount: number;
}

interface AssetDetailPanelProps {
  assetId: string;
  onClose: () => void;
  onAssetUpdated: () => void;
}

interface StewardLogEntry {
  id: number;
  badge: string;
  badgeClass: string;
  text: string;
  timestamp: string;
}

/* ── Constants ── */

const EVENT_TYPE_COLORS: Record<string, string> = {
  creation: '#00d68f',
  promotion: 'var(--accent)',
  steward_assessment: '#6496ff',
  maturity_change: '#ffb347',
  annotation: '#a855f6',
  location_added: '#e0e0e0',
  dependency_added: '#e0e0e0',
};

const HEALTH_LABELS: Record<string, { color: string; text: (asset: AssetDetail) => string }> = {
  healthy: { color: '#00d68f', text: () => 'Active and maintained' },
  stale: {
    color: '#ffb347',
    text: (asset) => {
      const days = Math.floor((Date.now() - new Date(asset.updatedAt).getTime()) / 86400000);
      return `No activity in ${days} days`;
    },
  },
  degraded: { color: 'var(--red)', text: () => 'Needs attention' },
  critical: { color: 'var(--red)', text: () => 'Critical — immediate action required' },
};

const AGENT_LABELS: Record<string, string> = {
  cto: 'CTO',
  cmo: 'CMO',
  coo: 'COO',
  tamir: 'Tamir',
};

/* ── Component ── */

export default function AssetDetailPanel({ assetId, onClose, onAssetUpdated }: AssetDetailPanelProps) {
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'steward'; text: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [stewardLog, setStewardLog] = useState<StewardLogEntry[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);

  /* ── Data fetching ── */

  const fetchAsset = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`);
      if (res.ok) setAsset(await res.json());
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [assetId]);

  useEffect(() => { fetchAsset(); }, [fetchAsset]);

  /* ── Escape key ── */

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  /* ── Auto-scroll chat ── */

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages.length, stewardLog.length]);

  /* ── Steward label ── */

  const stewardLabel = asset?.stewardId
    ? `${AGENT_LABELS[asset.stewardId] || asset.stewardId.toUpperCase()} (Steward)`
    : 'Steward';

  /* ── Log helpers ── */

  const addLogEntry = (badge: string, badgeClass: string, text: string) => {
    const id = ++logIdRef.current;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setStewardLog(prev => {
      const next = [...prev, { id, badge, badgeClass, text, timestamp }];
      return next.slice(-3); // Keep last 3
    });
  };

  /* ── Chat handler ── */

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setChatLoading(true);

    // Steward activity log — show steps as they happen
    addLogEntry('SESSION', 'log-type-session', `Invoking ${stewardLabel} for asset context...`);

    // Simulate progressive activity with slight delays
    const toolTimeout = setTimeout(() => {
      addLogEntry('TOOL', 'log-type-tool', 'Reading asset health, events, and dependencies...');
    }, 800);

    const thinkTimeout = setTimeout(() => {
      addLogEntry('THINKING', 'log-type-assistant', 'Generating steward assessment...');
    }, 2000);

    try {
      const res = await fetch(`/api/assets/${assetId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      clearTimeout(toolTimeout);
      clearTimeout(thinkTimeout);

      // Final log entry — success
      addLogEntry('DONE', 'log-type-success', 'Assessment complete');
      setChatMessages(prev => [...prev, { role: 'steward', text: data.response || 'No response' }]);

      // Refresh asset in case steward modified it
      await fetchAsset();
      onAssetUpdated();
    } catch {
      clearTimeout(toolTimeout);
      clearTimeout(thinkTimeout);
      addLogEntry('ERROR', 'log-type-error', 'Steward invocation failed');
      setChatMessages(prev => [...prev, { role: 'steward', text: 'Failed to reach steward.' }]);
    }
    setChatLoading(false);
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
    display: 'flex',
    flexDirection: 'column',
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
    marginTop: 20,
  };

  /* ── Shimmer loading ── */

  if (loading) {
    return (
      <div style={panelStyle}>
        <button style={closeButtonStyle} onClick={onClose}>X</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 40 }}>
          {[200, 150, 180].map((w, i) => (
            <div key={i} style={{
              width: w, height: 16, borderRadius: 4,
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

  /* ── Derived data ── */

  const categoryColors: Record<string, string> = {
    code: '#00d68f', brand: '#a855f6', IP: '#6496ff', 'digital-product': '#00bcd4', knowledge: '#ffb347',
  };
  const healthInfo = HEALTH_LABELS[asset.healthStatus] || HEALTH_LABELS.healthy;
  const recentEvents = [...asset.events]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div style={panelStyle}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes slideInRight { from { transform: translateX(360px); } to { transform: translateX(0); } }
      `}</style>

      {/* Close button */}
      <button style={closeButtonStyle} onClick={onClose}>X</button>

      {/* ── Header ── */}
      <div style={{ marginTop: 4, marginBottom: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, paddingRight: 32 }}>{asset.title}</h2>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={badgeStyle(categoryColors[asset.category] || 'var(--border)')}>{asset.category}</span>
          <span style={badgeStyle('var(--bg-3)')}>{asset.maturity}</span>
          {asset.stewardId && (
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{stewardLabel}</span>
          )}
        </div>
        {asset.description && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '8px 0 0' }}>{asset.description}</p>
        )}
      </div>

      {/* ── Health ── */}
      <div style={sectionTitleStyle}>Health</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={badgeStyle(healthInfo.color)}>{asset.healthStatus}</span>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{healthInfo.text(asset)}</span>
      </div>

      {/* ── Trend ── */}
      <div style={sectionTitleStyle}>Trend</div>
      {recentEvents.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic' }}>No activity recorded yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recentEvents.map((ev) => (
            <div key={ev.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                background: EVENT_TYPE_COLORS[ev.type] || 'var(--text-dim)',
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{ev.type.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {new Date(ev.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.summary}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Steward Chat ── */}
      <div style={{ ...sectionTitleStyle, marginTop: 24 }}>Chat</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* Steward Activity Log — 3 colorful entries */}
        {stewardLog.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {stewardLog.map((entry) => (
              <div key={entry.id} className="log-entry" style={{ marginBottom: 4 }}>
                <div className="log-entry-header" style={{ padding: '5px 10px', cursor: 'default' }}>
                  <span className={`badge ${entry.badgeClass}`}>{entry.badge}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.text}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 10, flexShrink: 0 }}>{entry.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat messages */}
        <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', marginBottom: 8, minHeight: 60 }}>
          {chatMessages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 10, fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: msg.role === 'user' ? 'var(--accent)' : 'var(--green)' }}>
                {msg.role === 'user' ? 'You' : stewardLabel}:
              </span>{' '}
              <span style={{ color: 'var(--text)' }}>{msg.text}</span>
            </div>
          ))}
          {chatLoading && chatMessages[chatMessages.length - 1]?.role === 'user' && (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>
              {stewardLabel} is thinking...
            </div>
          )}
        </div>

        {/* Chat input */}
        <form onSubmit={handleChat} style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={asset?.stewardId ? `Ask ${stewardLabel}...` : 'No steward assigned'}
            disabled={chatLoading || !asset?.stewardId}
            style={{
              flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '6px 8px', color: 'var(--text)',
              fontSize: 13, fontFamily: 'var(--font)', outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={chatLoading || !chatInput.trim()}
            style={{
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 4, padding: '6px 12px', fontSize: 13,
              fontFamily: 'var(--font)',
              cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
              opacity: chatLoading || !chatInput.trim() ? 0.5 : 1,
            }}
          >
            Send
          </button>
        </form>
        {!asset?.stewardId && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>No steward assigned. Assign one to enable chat.</div>
        )}
      </div>
    </div>
  );
}
