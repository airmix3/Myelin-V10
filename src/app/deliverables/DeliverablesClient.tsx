'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DeliverableItem {
  id: string;
  title: string;
  type: string | null;
  status: string;
  department: string;
  creatorId: string | null;
  createdAt: string;
  taskTitle: string | null;
  taskState: string | null;
}

interface DeliverablesClientProps {
  deliverables: DeliverableItem[];
}

function deptBadgeClass(dept: string): string {
  switch (dept) {
    case 'tech': return 'badge-tech';
    case 'marketing': return 'badge-marketing';
    case 'operations': return 'badge-ops';
    default: return 'badge-tech';
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'in-progress': return 'badge-pending';
    case 'completed': return 'badge-done';
    case 'reviewed': return 'badge-active';
    default: return 'badge-pending';
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'tech', label: 'Tech' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'operations', label: 'Operations' },
];

export default function DeliverablesClient({ deliverables }: DeliverablesClientProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 300ms debounce for search
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Filter by department tab
  let filtered = activeTab === 'all'
    ? deliverables
    : deliverables.filter((d) => d.department === activeTab);

  // Filter by search term
  if (debouncedSearch.trim()) {
    const term = debouncedSearch.toLowerCase();
    filtered = filtered.filter((d) => d.title.toLowerCase().includes(term));
  }

  // Sort: in-progress first, then by createdAt descending
  filtered = [...filtered].sort((a, b) => {
    if (a.status === 'in-progress' && b.status !== 'in-progress') return -1;
    if (a.status !== 'in-progress' && b.status === 'in-progress') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div>
      <h1>Deliverables</h1>

      {/* Tab Bar */}
      <div className="tab-bar" style={{ marginBottom: '16px' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <input
        type="text"
        className="search-bar"
        placeholder="Search deliverables..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        style={{ width: '100%', marginBottom: '24px' }}
      />

      {/* Card Grid */}
      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', padding: '24px' }}>
          <p style={{ fontWeight: 700 }}>No deliverables yet</p>
          <p>Submit a task through Tamir to see deliverables here.</p>
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map((d) => (
            <Link
              key={d.id}
              href={`/deliverables/${d.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                className="card"
                style={d.status === 'in-progress' ? { borderLeft: '3px solid var(--amber)' } : undefined}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
                  {d.title}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <span className={deptBadgeClass(d.department)}>{d.department}</span>
                  {d.type && (
                    <span className="badge-active" style={{ fontSize: '11px' }}>
                      {d.type.toUpperCase()}
                    </span>
                  )}
                  <span className={statusBadgeClass(d.status)}>{d.status}</span>
                </div>
                {d.creatorId && (
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                    by {d.creatorId}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  {formatDate(d.createdAt)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
