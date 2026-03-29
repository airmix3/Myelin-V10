'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface GalleryPanelProps {
  taskId: string;
  department: string;
  onSelectionChange: (tools: string[], skills: string[], hints: Record<string, string>) => void;
}

interface GalleryItem {
  id: string;
  name: string;
  description: string;
  source: string;
  stars?: number;
  department?: string;
  status?: string;
  url?: string;
  summary?: string;
}

type TabType = 'tools' | 'skills';

const TOOL_SOURCES = ['company', 'smithery'] as const;
const SKILL_SOURCES = ['company', 'skillssh'] as const;

export default function GalleryPanel({ taskId, department, onSelectionChange }: GalleryPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('tools');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceStatus, setSourceStatus] = useState<Record<string, 'ok' | 'unavailable'>>({});
  const [activeSources, setActiveSources] = useState<string[]>([...TOOL_SOURCES]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [toolHints, setToolHints] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset sources to ALL for the new tab when tab changes
  useEffect(() => {
    const sources = activeTab === 'tools' ? [...TOOL_SOURCES] : [...SKILL_SOURCES];
    setActiveSources(sources);
    setItems([]);
    setSourceStatus({});
  }, [activeTab]);

  const fetchItems = useCallback(async (searchQuery: string, sources: string[]) => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'tools' ? '/api/search/tools' : '/api/search/skills';
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      params.set('sources', sources.join(','));

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.results || []);
        setSourceStatus(data.sourceStatus || {});
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Fetch on mount and when sources change
  useEffect(() => {
    fetchItems(query, activeSources);
    // We intentionally exclude query from deps — query changes trigger via debounce below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSources, activeTab, fetchItems]);

  // Debounced search
  function handleSearchChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchItems(value, activeSources);
    }, 300);
  }

  function toggleSource(source: string) {
    setActiveSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source],
    );
  }

  function toggleSelection(item: GalleryItem) {
    if (activeTab === 'tools') {
      const next = selectedTools.includes(item.id)
        ? selectedTools.filter((id) => id !== item.id)
        : [...selectedTools, item.id];
      setSelectedTools(next);
      // Remove hint if deselected
      if (!next.includes(item.id)) {
        const nextHints = { ...toolHints };
        delete nextHints[item.id];
        setToolHints(nextHints);
        onSelectionChange(next, selectedSkills, nextHints);
      } else {
        onSelectionChange(next, selectedSkills, toolHints);
      }
    } else {
      const next = selectedSkills.includes(item.id)
        ? selectedSkills.filter((id) => id !== item.id)
        : [...selectedSkills, item.id];
      setSelectedSkills(next);
      onSelectionChange(selectedTools, next, toolHints);
    }
  }

  function handleHintChange(itemId: string, hint: string) {
    const next = { ...toolHints, [itemId]: hint };
    setToolHints(next);
    onSelectionChange(selectedTools, selectedSkills, next);
  }

  const [detailItem, setDetailItem] = useState<GalleryItem | null>(null);

  // Escape key handler for overlay
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDetailItem(null);
    }
    if (detailItem) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [detailItem]);

  const isSelected = (itemId: string) =>
    activeTab === 'tools' ? selectedTools.includes(itemId) : selectedSkills.includes(itemId);

  const isOtherDept = (item: GalleryItem) =>
    item.department && item.department !== department;

  const currentSources = activeTab === 'tools' ? TOOL_SOURCES : SKILL_SOURCES;

  function getSourceUrl(item: GalleryItem): string {
    if (item.url) return item.url;
    if (item.source === 'smithery') {
      const qualifiedName = item.id.replace('smithery-', '');
      return `https://smithery.ai/servers/${qualifiedName}`;
    }
    if (item.source === 'skillssh') {
      // id format: skillssh-owner/repo@skillName
      const repoSkill = item.id.replace('skillssh-', '');
      const repo = repoSkill.split('@')[0];
      return `https://skills.sh/${repo}`;
    }
    return '#';
  }

  function getSourceLabel(item: GalleryItem): string {
    if (item.source === 'smithery') return 'Smithery.ai';
    if (item.source === 'skillssh') return 'Skills.sh';
    return 'Company';
  }

  // Suppress unused taskId warning — taskId is in props for future use (e.g., persisting selection)
  void taskId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h4 style={{ margin: 0, fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.5px' }}>
        {activeTab === 'tools' ? 'Tool' : 'Skill'} Gallery
      </h4>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '0' }}>
        <button
          onClick={() => setActiveTab('tools')}
          style={{
            flex: 1,
            padding: '6px 12px',
            fontSize: '12px',
            background: activeTab === 'tools' ? 'var(--bg-tertiary)' : 'transparent',
            border: '1px solid var(--border)',
            borderRight: 'none',
            borderRadius: '4px 0 0 4px',
            color: activeTab === 'tools' ? 'var(--text-primary)' : 'var(--text-dim)',
            cursor: 'pointer',
          }}
        >
          Tools
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          style={{
            flex: 1,
            padding: '6px 12px',
            fontSize: '12px',
            background: activeTab === 'skills' ? 'var(--bg-tertiary)' : 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '0 4px 4px 0',
            color: activeTab === 'skills' ? 'var(--text-primary)' : 'var(--text-dim)',
            cursor: 'pointer',
          }}
        >
          Skills
        </button>
      </div>

      {/* Source Toggles */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {currentSources.map((source) => (
          <label key={source} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-dim)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={activeSources.includes(source)}
              onChange={() => toggleSource(source)}
            />
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: sourceStatus[source] === 'ok' ? 'var(--accent-green)' : sourceStatus[source] === 'unavailable' ? 'var(--text-dim)' : 'var(--text-dim)',
                display: 'inline-block',
              }}
            />
            <span>{source}</span>
            {sourceStatus[source] === 'unavailable' && (
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>(unavailable)</span>
            )}
          </label>
        ))}
      </div>

      {/* Search Input */}
      <input
        className="search-bar"
        type="text"
        value={query}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder={`Search ${activeTab}...`}
        style={{
          width: '100%',
          padding: '8px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          color: 'var(--text-primary)',
          fontSize: '13px',
        }}
      />

      {/* Gallery Grid */}
      {loading ? (
        <div style={{ color: 'var(--text-dim)', fontSize: '12px', padding: '12px', textAlign: 'center' }}>
          Loading {activeTab}...
        </div>
      ) : items.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: '12px', padding: '12px', textAlign: 'center' }}>
          No matching {activeTab}
          <div style={{ fontSize: '11px', marginTop: '4px' }}>
            Try a broader search term or check different sources.
          </div>
        </div>
      ) : (
        <div className="gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
          {items.map((item) => (
            <div key={item.id}>
              <div
                className={`gallery-card${isSelected(item.id) ? ' selected' : ''}${isOtherDept(item) ? ' other-dept' : ''}`}
                onClick={() => setDetailItem(item)}
                style={{
                  padding: '12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  opacity: isOtherDept(item) ? 0.5 : 1,
                }}
              >
                <div className="gallery-card-icon" style={{ fontSize: '18px', marginBottom: '4px' }}>
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <div className="gallery-card-name" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {item.name}
                </div>
                <div
                  className="gallery-card-desc"
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-dim)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {item.description}
                </div>
                {item.summary && (
                  <div
                    className="gallery-card-summary"
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      marginTop: '4px',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.summary}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--text-dim)' }}>
                  {item.stars != null && item.stars > 0 && <span>{item.stars} stars</span>}
                  <span className="badge" style={{ fontSize: '9px' }}>{item.source}</span>
                </div>
              </div>

              {/* CEO Hint for selected items */}
              {isSelected(item.id) && activeTab === 'tools' && (
                <input
                  type="text"
                  value={toolHints[item.id] || ''}
                  onChange={(e) => handleHintChange(item.id, e.target.value)}
                  placeholder="Add hint for agent..."
                  style={{
                    width: '100%',
                    marginTop: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    color: 'var(--text-primary)',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Overlay */}
      {detailItem && (
        <div className="gallery-overlay-backdrop" onClick={() => setDetailItem(null)}>
          <div className="gallery-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="gallery-overlay-header">
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{detailItem.name}</div>
                <span className="badge" style={{ fontSize: '10px', marginTop: '4px', display: 'inline-block' }}>{detailItem.source}</span>
              </div>
              <button className="gallery-overlay-close" onClick={() => setDetailItem(null)}>X</button>
            </div>
            <div className="gallery-overlay-meta">
              <div className="gallery-overlay-field">
                <div>Description</div>
                <div>{detailItem.description}</div>
              </div>
              {detailItem.summary && (
                <div className="gallery-overlay-field">
                  <div>Summary</div>
                  <div>{detailItem.summary}</div>
                </div>
              )}
              {detailItem.stars != null && detailItem.stars > 0 && (
                <div className="gallery-overlay-field">
                  <div>{detailItem.source === 'skillssh' ? 'Installs' : 'Stars'}</div>
                  <div>{detailItem.stars.toLocaleString()}</div>
                </div>
              )}
              {detailItem.department && (
                <div className="gallery-overlay-field">
                  <div>Department</div>
                  <div>{detailItem.department}</div>
                </div>
              )}
              <div className="gallery-overlay-field">
                <div>Source</div>
                <a className="gallery-overlay-link" href={getSourceUrl(detailItem)} target="_blank" rel="noopener noreferrer">
                  View on {getSourceLabel(detailItem)}
                </a>
              </div>
            </div>
            <button
              onClick={() => { toggleSelection(detailItem); setDetailItem(null); }}
              style={{
                marginTop: '20px', width: '100%', padding: '10px',
                background: isSelected(detailItem.id) ? 'transparent' : 'var(--green)',
                color: isSelected(detailItem.id) ? 'var(--text-dim)' : 'var(--bg)',
                border: isSelected(detailItem.id) ? '1px solid var(--border)' : 'none',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              }}
            >
              {isSelected(detailItem.id) ? 'Deselect' : 'Select for Task'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
