'use client';

import { useState, useEffect } from 'react';
import { marked } from 'marked';

interface VaultDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  department: string | null;
  filedBy: string | null;
  createdAt: string;
}

interface SearchResult {
  id: string;
  title: string;
  source: string;
  department: string | null;
  snippet: string;
  rank: number;
}

interface VaultClientProps {
  initialDocuments: VaultDocument[];
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function VaultClient({ initialDocuments }: VaultClientProps) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
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
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    fetch(`/api/vault/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        setSearchResults(data.results || []);
        setIsSearching(false);
      })
      .catch(() => {
        setSearchResults([]);
        setIsSearching(false);
      });
  }, [debouncedQuery]);

  const handleCardClick = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Find full document by ID for expanded view
  const getDocContent = (id: string): string => {
    const doc = initialDocuments.find((d) => d.id === id);
    return doc?.content || '';
  };

  const isSearchActive = debouncedQuery.trim().length > 0;

  // No documents at all
  if (initialDocuments.length === 0 && !isSearchActive) {
    return (
      <div>
        <h1>Vault</h1>
        <input
          type="text"
          className="search-bar"
          placeholder="Search documents..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ width: '100%', marginBottom: '24px' }}
        />
        <div style={{ color: 'var(--text-dim)', padding: '24px' }}>
          <p style={{ fontWeight: 700 }}>Vault is empty</p>
          <p>Documents filed by agents will appear here. Company DNA is loaded on first boot.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Vault</h1>

      <input
        type="text"
        className="search-bar"
        placeholder="Search documents..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        style={{ width: '100%', marginBottom: '24px' }}
      />

      {isSearching && (
        <div style={{ color: 'var(--text-dim)', marginBottom: '16px' }}>Searching...</div>
      )}

      {/* Search results mode */}
      {isSearchActive && !isSearching && searchResults !== null && (
        <>
          {searchResults.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', padding: '24px' }}>
              <p style={{ fontWeight: 700 }}>No documents found</p>
              <p>Try a different search term, or file documents through agent tasks.</p>
            </div>
          ) : (
            <div>
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="card"
                  style={{ cursor: 'pointer', marginBottom: '8px' }}
                  onClick={() => handleCardClick(result.id)}
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
                  {expandedId === result.id && (
                    <div
                      className="md-render"
                      style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}
                      dangerouslySetInnerHTML={{ __html: marked.parse(getDocContent(result.id)) as string }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Browse mode (no search query) */}
      {!isSearchActive && (
        <div>
          {initialDocuments.map((doc) => (
            <div
              key={doc.id}
              className="card"
              style={{ cursor: 'pointer', marginBottom: '8px' }}
              onClick={() => handleCardClick(doc.id)}
            >
              <div style={{ fontWeight: 700, marginBottom: '8px' }}>{doc.title}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {doc.department && (
                  <span className={deptBadgeClass(doc.department)}>{doc.department}</span>
                )}
                <span className={sourceBadgeClass(doc.source)}>{doc.source}</span>
                {doc.filedBy && (
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>by {doc.filedBy}</span>
                )}
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{formatDate(doc.createdAt)}</span>
              </div>
              {expandedId === doc.id && (
                <div
                  className="md-render"
                  style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}
                  dangerouslySetInnerHTML={{ __html: marked.parse(doc.content) as string }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
