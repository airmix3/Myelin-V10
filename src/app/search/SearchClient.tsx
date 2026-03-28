'use client';

import { useState, useEffect } from 'react';
import { marked } from 'marked';

interface SearchResult {
  id: string;
  title: string;
  source: string;
  department: string | null;
  snippet: string;
  rank: number;
  content?: string;
}

interface DeliverableMeta {
  id: string;
  title: string;
  type: string | null;
  status: string;
  department: string;
}

function deptBadgeClass(dept: string | null): string {
  switch (dept) {
    case 'tech': return 'badge-tech';
    case 'marketing': return 'badge-marketing';
    case 'operations': return 'badge-ops';
    default: return 'badge-active';
  }
}

function sourceBadgeClass(source: string): string {
  switch (source) {
    case 'vault': return 'badge-active';
    case 'knowledge': return 'badge-pending';
    case 'deliverable': return 'badge-done';
    default: return 'badge-active';
  }
}

export default function SearchClient() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [deliverables, setDeliverables] = useState<Record<string, DeliverableMeta>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 300ms debounce
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(searchInput), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Fetch search results when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(null);
      setDeliverables({});
      return;
    }

    setIsSearching(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        setResults(data.results || []);
        setDeliverables(data.deliverables || {});
        setIsSearching(false);
      })
      .catch(() => {
        setResults([]);
        setDeliverables({});
        setIsSearching(false);
      });
  }, [debouncedQuery]);

  const handleCardClick = (id: string, source: string) => {
    // Don't expand deliverable results (they link out)
    if (source === 'deliverable') return;
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Group results by source
  const grouped = results
    ? {
        vault: results.filter((r) => r.source === 'vault'),
        knowledge: results.filter((r) => r.source === 'knowledge'),
        deliverable: results.filter((r) => r.source === 'deliverable'),
      }
    : null;

  const totalCount = results ? results.length : 0;
  const isSearchActive = debouncedQuery.trim().length > 0;

  return (
    <div>
      <h1>Search</h1>

      <input
        type="text"
        className="search-bar"
        placeholder="Search vault, knowledge base, and deliverables..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        style={{ width: '100%', marginBottom: '24px', marginTop: '16px' }}
      />

      {isSearching && (
        <div style={{ color: 'var(--text-dim)', marginBottom: '16px' }}>Searching...</div>
      )}

      {/* No query yet */}
      {!isSearchActive && !isSearching && (
        <div className="empty-state">
          <h3>Full-Text Search</h3>
          <p>Type a query to search across all company knowledge</p>
        </div>
      )}

      {/* No results */}
      {isSearchActive && !isSearching && results !== null && totalCount === 0 && (
        <div style={{ color: 'var(--text-dim)', padding: '24px' }}>
          <p style={{ fontWeight: 700 }}>No results found</p>
          <p>No results found for &ldquo;{debouncedQuery}&rdquo;</p>
        </div>
      )}

      {/* Results */}
      {isSearchActive && !isSearching && grouped && totalCount > 0 && (
        <>
          <div className="search-result-count">
            {totalCount} result{totalCount !== 1 ? 's' : ''} for &ldquo;{debouncedQuery}&rdquo;
          </div>

          {/* Vault section */}
          {grouped.vault.length > 0 && (
            <div className="search-section">
              <div className="search-section-title">Vault ({grouped.vault.length})</div>
              {grouped.vault.map((result) => (
                <div
                  key={result.id}
                  className="card"
                  style={{ cursor: 'pointer', marginBottom: '8px' }}
                  onClick={() => handleCardClick(result.id, result.source)}
                >
                  <div style={{ fontWeight: 700, marginBottom: '8px' }}>{result.title}</div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    {result.department && (
                      <span className={deptBadgeClass(result.department)}>{result.department}</span>
                    )}
                    <span className={sourceBadgeClass(result.source)}>{result.source}</span>
                  </div>
                  <div
                    style={{ fontSize: '13px', color: 'var(--text-dim)' }}
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                  {expandedId === result.id && result.content && (
                    <div
                      className="md-render"
                      style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}
                      dangerouslySetInnerHTML={{ __html: marked.parse(result.content) as string }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Knowledge section */}
          {grouped.knowledge.length > 0 && (
            <div className="search-section">
              <div className="search-section-title">Knowledge ({grouped.knowledge.length})</div>
              {grouped.knowledge.map((result) => (
                <div
                  key={result.id}
                  className="card"
                  style={{ cursor: 'pointer', marginBottom: '8px' }}
                  onClick={() => handleCardClick(result.id, result.source)}
                >
                  <div style={{ fontWeight: 700, marginBottom: '8px' }}>{result.title}</div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    {result.department && (
                      <span className={deptBadgeClass(result.department)}>{result.department}</span>
                    )}
                    <span className={sourceBadgeClass(result.source)}>{result.source}</span>
                  </div>
                  <div
                    style={{ fontSize: '13px', color: 'var(--text-dim)' }}
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                  {expandedId === result.id && result.content && (
                    <div
                      className="md-render"
                      style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}
                      dangerouslySetInnerHTML={{ __html: marked.parse(result.content) as string }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Deliverables section */}
          {grouped.deliverable.length > 0 && (
            <div className="search-section">
              <div className="search-section-title">Deliverables ({grouped.deliverable.length})</div>
              {grouped.deliverable.map((result) => {
                const meta = deliverables[result.id];
                return (
                  <div
                    key={result.id}
                    className="card"
                    style={{ marginBottom: '8px' }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '8px' }}>{result.title}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {result.department && (
                        <span className={deptBadgeClass(result.department)}>{result.department}</span>
                      )}
                      <span className={sourceBadgeClass(result.source)}>deliverable</span>
                      {meta?.type && (
                        <span className="badge-done">{meta.type}</span>
                      )}
                      {meta?.status && (
                        <span className="badge-pending">{meta.status}</span>
                      )}
                    </div>
                    <div
                      style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}
                      dangerouslySetInnerHTML={{ __html: result.snippet }}
                    />
                    {meta && (
                      <a
                        href={`/deliverables#${meta.id}`}
                        className="btn btn-sm"
                        style={{ display: 'inline-block' }}
                      >
                        View Deliverable
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
