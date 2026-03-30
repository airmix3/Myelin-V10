'use client';

/* ── Types ── */

interface AssetToolbarProps {
  onCreateClick: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  categoryFilters: Record<string, boolean>;
  onToggleCategory: (cat: string) => void;
  panelOpen?: boolean;
}

/* ── Constants ── */

const CATEGORIES: { key: string; label: string; abbr: string; color: string }[] = [
  { key: 'code', label: 'Code', abbr: 'C', color: '#00d68f' },
  { key: 'brand', label: 'Brand', abbr: 'B', color: '#a855f6' },
  { key: 'IP', label: 'IP', abbr: 'IP', color: '#6496ff' },
  { key: 'digital-product', label: 'Product', abbr: 'P', color: '#00bcd4' },
  { key: 'knowledge', label: 'Knowledge', abbr: 'K', color: '#ffb347' },
];

/* ── Component ── */

export default function AssetToolbar({
  onCreateClick,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  categoryFilters,
  onToggleCategory,
  panelOpen,
}: AssetToolbarProps) {
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 16,
    right: panelOpen ? 376 : 16,
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 8,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    zIndex: 50,
    transition: 'right 0.2s ease-out',
  };

  const separatorStyle: React.CSSProperties = {
    width: 1,
    height: 24,
    background: 'var(--border)',
  };

  const iconButtonStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text)',
    fontSize: 13,
    fontFamily: 'var(--font)',
    cursor: 'pointer',
    padding: 0,
  };

  return (
    <div style={containerStyle}>
      {/* Create Asset */}
      <button
        onClick={onCreateClick}
        style={{
          padding: '6px 12px',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'var(--font)',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        Create Asset
      </button>

      <div style={separatorStyle} />

      {/* Zoom Controls */}
      <button onClick={onZoomIn} style={iconButtonStyle} aria-label="Zoom in" title="Zoom in">+</button>
      <button onClick={onZoomOut} style={iconButtonStyle} aria-label="Zoom out" title="Zoom out">-</button>
      <button onClick={onZoomReset} style={iconButtonStyle} aria-label="Reset zoom to default" title="Reset zoom">1:1</button>

      <div style={separatorStyle} />

      {/* Category Filters */}
      {CATEGORIES.map((cat) => {
        const active = categoryFilters[cat.key] !== false;
        return (
          <button
            key={cat.key}
            onClick={() => onToggleCategory(cat.key)}
            title={cat.label}
            style={{
              ...iconButtonStyle,
              background: active ? cat.color : 'var(--bg)',
              color: active ? '#fff' : 'var(--text-dim)',
              opacity: active ? 1 : 0.3,
              fontWeight: 700,
              fontSize: 11,
              transition: 'opacity 0.15s, background 0.15s',
            }}
          >
            {cat.abbr}
          </button>
        );
      })}
    </div>
  );
}
