'use client';

import { useState, useEffect } from 'react';

interface PromoteToAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliverableId: string;
  deliverableTitle: string;
  onPromoted: () => void;
}

interface ExistingAsset {
  id: string;
  title: string;
  category: string;
}

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

const RETURN_FACTORS = [
  { value: 'revenue', label: 'Revenue generation' },
  { value: 'moat', label: 'Competitive moat' },
  { value: 'core_tech', label: 'Core technology' },
  { value: 'brand_equity', label: 'Brand equity' },
];

export default function PromoteToAssetModal({
  isOpen,
  onClose,
  deliverableId,
  deliverableTitle,
  onPromoted,
}: PromoteToAssetModalProps) {
  const [title, setTitle] = useState(deliverableTitle);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('code');
  const [stewardId, setStewardId] = useState('cto');
  const [intent, setIntent] = useState('');
  const [returnFactors, setReturnFactors] = useState<string[]>([]);
  const [addToExisting, setAddToExisting] = useState(false);
  const [existingAssetId, setExistingAssetId] = useState('');
  const [existingAssets, setExistingAssets] = useState<ExistingAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(deliverableTitle);
      setDescription('');
      setCategory('code');
      setStewardId('cto');
      setIntent('');
      setReturnFactors([]);
      setAddToExisting(false);
      setExistingAssetId('');
      setError(null);
    }
  }, [isOpen, deliverableTitle]);

  // Fetch existing assets when "add to existing" is toggled
  useEffect(() => {
    if (addToExisting && existingAssets.length === 0) {
      fetch('/api/assets')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setExistingAssets(data.map((a: Record<string, unknown>) => ({
              id: a.id as string,
              title: a.title as string,
              category: a.category as string,
            })));
          }
        })
        .catch(() => { /* silently fail */ });
    }
  }, [addToExisting, existingAssets.length]);

  const handleToggleReturnFactor = (factor: string) => {
    setReturnFactors((prev) =>
      prev.includes(factor)
        ? prev.filter((f) => f !== factor)
        : [...prev, factor],
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title,
        description: description || undefined,
        category,
        stewardId,
        intent: intent || undefined,
        returnFactors: returnFactors.length > 0 ? returnFactors : undefined,
      };

      if (addToExisting && existingAssetId) {
        payload.existingAssetId = existingAssetId;
      }

      const res = await fetch(`/api/deliverables/${deliverableId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onPromoted();
        onClose();
      } else {
        setError('Failed to promote deliverable. Please try again.');
      }
    } catch {
      setError('Failed to promote deliverable. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  /* ── Styles ── */

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const modalStyle: React.CSSProperties = {
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 24,
    width: 480,
    maxWidth: '90vw',
    maxHeight: '85vh',
    overflowY: 'auto',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
    display: 'block',
    marginBottom: 4,
    marginTop: 12,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: 'var(--font)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px 0' }}>
          Promote Deliverable to Asset
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
          Create a company asset from this deliverable
        </p>

        {/* Add to existing asset toggle */}
        <label style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={addToExisting}
            onChange={(e) => setAddToExisting(e.target.checked)}
          />
          Add to existing asset
        </label>

        {addToExisting ? (
          <>
            <label style={labelStyle}>Select Asset</label>
            <select
              value={existingAssetId}
              onChange={(e) => setExistingAssetId(e.target.value)}
              style={selectStyle}
            >
              <option value="">-- Select an asset --</option>
              {existingAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.category})
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            {/* Asset Name */}
            <label style={labelStyle}>Asset Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />

            {/* Description */}
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />

            {/* Category */}
            <label style={labelStyle}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={selectStyle}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            {/* Return Factors */}
            <label style={labelStyle}>Return Factors</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {RETURN_FACTORS.map((rf) => (
                <label key={rf.value} style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={returnFactors.includes(rf.value)}
                    onChange={() => handleToggleReturnFactor(rf.value)}
                  />
                  {rf.label}
                </label>
              ))}
            </div>
          </>
        )}

        {/* Steward */}
        <label style={labelStyle}>Steward</label>
        <select
          value={stewardId}
          onChange={(e) => setStewardId(e.target.value)}
          style={selectStyle}
        >
          {STEWARDS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Intent */}
        <label style={labelStyle}>How do you see this asset? (optional)</label>
        <textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="Describe your vision for this asset..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />

        {/* Error */}
        {error && (
          <p style={{ fontSize: 13, color: 'var(--red)', margin: '8px 0 0 0' }}>{error}</p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontFamily: 'var(--font)',
              background: 'transparent',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (!addToExisting && !title.trim()) || (addToExisting && !existingAssetId)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontFamily: 'var(--font)',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting || (!addToExisting && !title.trim()) || (addToExisting && !existingAssetId) ? 0.5 : 1,
            }}
          >
            {submitting ? 'Promoting...' : 'Confirm Promotion'}
          </button>
        </div>
      </div>
    </div>
  );
}
