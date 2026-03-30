'use client';

import { useEffect, useState } from 'react';

/* ── Types ── */

interface CreateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/* ── Constants ── */

const CATEGORIES = [
  { value: 'code', label: 'Code' },
  { value: 'brand', label: 'Brand' },
  { value: 'IP', label: 'IP' },
  { value: 'digital-product', label: 'Digital Product' },
  { value: 'knowledge', label: 'Knowledge' },
];

const STEWARDS = [
  { value: 'cto', label: 'CTO' },
  { value: 'cmo', label: 'CMO' },
  { value: 'coo', label: 'COO' },
];

const MATURITY_LEVELS = [
  { value: 'nascent', label: 'Nascent' },
  { value: 'developing', label: 'Developing' },
  { value: 'established', label: 'Established' },
  { value: 'foundational', label: 'Foundational' },
  { value: 'legacy', label: 'Legacy' },
  { value: 'heritage', label: 'Heritage' },
];

const RETURN_FACTORS = [
  { value: 'revenue', label: 'Revenue generation' },
  { value: 'moat', label: 'Competitive moat' },
  { value: 'core_tech', label: 'Core technology' },
  { value: 'brand_equity', label: 'Brand equity' },
];

/* ── Component ── */

export default function CreateAssetModal({ isOpen, onClose, onCreated }: CreateAssetModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('code');
  const [steward, setSteward] = useState('cto');
  const [maturity, setMaturity] = useState('nascent');
  const [returnFactors, setReturnFactors] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  /* ── Escape key ── */

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  /* ── Reset on open ── */

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setCategory('code');
      setSteward('cto');
      setMaturity('nascent');
      setReturnFactors([]);
      setLocation('');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  /* ── Validation ── */

  const isValid = name.trim() !== '' && description.trim() !== '' && category !== '' && steward !== '';

  /* ── Submit ── */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        title: name.trim(),
        description: description.trim(),
        category,
        stewardId: steward,
        maturity,
        returnFactors,
      };
      if (location.trim()) {
        body.initialLocation = location.trim();
      }

      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onCreated();
        onClose();
      } else {
        setError('Failed to create asset. Please try again.');
      }
    } catch {
      setError('Failed to create asset. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Toggle return factor ── */

  const toggleFactor = (factor: string) => {
    setReturnFactors((prev) =>
      prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor]
    );
  };

  /* ── Styles ── */

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  };

  const modalStyle: React.CSSProperties = {
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 24,
    maxWidth: 480,
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-dim)',
    marginBottom: 4,
    marginTop: 12,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    fontFamily: 'var(--font)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text)',
    outline: 'none',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Create Asset</h2>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <label style={labelStyle}>Asset Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            style={inputStyle}
            autoFocus
          />

          {/* Description */}
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />

          {/* Category */}
          <label style={labelStyle}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          {/* Steward */}
          <label style={labelStyle}>Steward</label>
          <select value={steward} onChange={(e) => setSteward(e.target.value)} style={selectStyle}>
            {STEWARDS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Initial Maturity */}
          <label style={labelStyle}>Initial Maturity</label>
          <select value={maturity} onChange={(e) => setMaturity(e.target.value)} style={selectStyle}>
            {MATURITY_LEVELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {/* Return Factors */}
          <label style={labelStyle}>Return Factors (select 1-4)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {RETURN_FACTORS.map((f) => (
              <label key={f.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={returnFactors.includes(f.value)}
                  onChange={() => toggleFactor(f.value)}
                />
                {f.label}
              </label>
            ))}
          </div>

          {/* Primary Location */}
          <label style={labelStyle}>Primary Location (path or URL)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., /path/to/code or https://github.com/..."
            style={inputStyle}
          />

          {/* Error */}
          {error && (
            <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</p>
          )}

          {/* Submit */}
          <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontFamily: 'var(--font)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || submitting}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'var(--font)',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: !isValid || submitting ? 'not-allowed' : 'pointer',
                opacity: !isValid || submitting ? 0.5 : 1,
              }}
            >
              {submitting ? 'Creating...' : 'Create Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
