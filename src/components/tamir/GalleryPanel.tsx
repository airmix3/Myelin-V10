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
    // We intentionally exclude query from deps -- query changes trigger via debounce below
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

  // Suppress unused taskId warning -- taskId is in props for future use (e.g., persisting selection)
  void taskId;

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-[12px] uppercase text-slate-500 tracking-wider font-medium m-0">
        {activeTab === 'tools' ? 'Tool' : 'Skill'} Gallery
      </h4>

      {/* Tab Bar */}
      <div className="flex">
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex-1 px-3 py-1.5 text-[12px] rounded-l-md border border-white/[0.06] border-r-0 cursor-pointer transition-colors ${
            activeTab === 'tools'
              ? 'glass-card text-white'
              : 'bg-transparent text-slate-500'
          }`}
        >
          Tools
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`flex-1 px-3 py-1.5 text-[12px] rounded-r-md border border-white/[0.06] cursor-pointer transition-colors ${
            activeTab === 'skills'
              ? 'glass-card text-white'
              : 'bg-transparent text-slate-500'
          }`}
        >
          Skills
        </button>
      </div>

      {/* Source Toggles */}
      <div className="flex gap-3 flex-wrap">
        {currentSources.map((source) => (
          <label key={source} className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={activeSources.includes(source)}
              onChange={() => toggleSource(source)}
            />
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block ${
                sourceStatus[source] === 'ok' ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            <span>{source}</span>
            {sourceStatus[source] === 'unavailable' && (
              <span className="text-[10px] text-slate-500">(unavailable)</span>
            )}
          </label>
        ))}
      </div>

      {/* Search Input */}
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder={`Search ${activeTab}...`}
        className="glass-deep w-full px-3 py-2 rounded-md border border-white/[0.06] text-[13px] text-white bg-white/[0.03] outline-none"
      />

      {/* Gallery Grid */}
      {loading ? (
        <div className="text-slate-500 text-[12px] p-3 text-center">
          Loading {activeTab}...
        </div>
      ) : items.length === 0 ? (
        <div className="text-slate-500 text-[12px] p-3 text-center">
          No matching {activeTab}
          <div className="text-[11px] mt-1">
            Try a broader search term or check different sources.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
          {items.map((item) => (
            <div key={item.id}>
              <div
                onClick={() => setDetailItem(item)}
                className={`glass-card p-3 rounded-md cursor-pointer ${
                  isSelected(item.id) ? 'ring-1 ring-sky-400/40' : ''
                } ${isOtherDept(item) ? 'opacity-50' : ''}`}
              >
                <div className="text-[18px] mb-1">
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-[12px] font-semibold text-white mb-1">
                  {item.name}
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-1">
                  {item.description}
                </div>
                {item.summary && (
                  <div className="text-[11px] text-slate-300 mt-1 line-clamp-3">
                    {item.summary}
                  </div>
                )}
                <div className="flex justify-between mt-1.5 text-[10px] text-slate-500">
                  {item.stars != null && item.stars > 0 && <span>{item.stars} stars</span>}
                  <span className="text-[9px]">{item.source}</span>
                </div>
              </div>

              {/* CEO Hint for selected items */}
              {isSelected(item.id) && activeTab === 'tools' && (
                <input
                  type="text"
                  value={toolHints[item.id] || ''}
                  onChange={(e) => handleHintChange(item.id, e.target.value)}
                  placeholder="Add hint for agent..."
                  className="glass-deep w-full mt-1 text-[11px] px-2 py-1 rounded border border-white/[0.06] text-white bg-white/[0.03] outline-none"
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
                <div className="text-[16px] font-bold text-white">{detailItem.name}</div>
                <span className="text-[10px] mt-1 inline-block text-slate-400">{detailItem.source}</span>
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
              className={`mt-5 w-full py-2.5 rounded-md cursor-pointer text-[13px] font-semibold transition-colors ${
                isSelected(detailItem.id)
                  ? 'bg-transparent border border-white/[0.06] text-slate-500'
                  : 'bg-emerald-500 text-slate-900 border-0'
              }`}
            >
              {isSelected(detailItem.id) ? 'Deselect' : 'Select for Task'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
