'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus } from 'lucide-react';

/* -- Types -- */

interface CreateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/* -- Constants -- */

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

/* -- Component -- */

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

  /* -- Escape key -- */

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  /* -- Reset on open -- */

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

  /* -- Validation -- */

  const isValid = name.trim() !== '' && description.trim() !== '' && category !== '' && steward !== '';

  /* -- Submit -- */

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

  /* -- Toggle return factor -- */

  const toggleFactor = (factor: string) => {
    setReturnFactors((prev) =>
      prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor]
    );
  };

  const inputClasses = 'w-full bg-transparent border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--text-dim)] outline-none focus:ring-1 focus:ring-white/10';
  const labelClasses = 'block text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-1 mt-4';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative glass-deep rounded-2xl p-6 w-[90%] max-w-[480px] max-h-[90vh] overflow-y-auto"
            style={{ border: '1px solid var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-[var(--text-dim)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title */}
            <div className="flex items-center gap-2 mb-2">
              <Plus className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white">Create Asset</h2>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Name */}
              <label className={labelClasses}>Asset Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className={inputClasses}
                autoFocus
              />

              {/* Description */}
              <label className={labelClasses}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`${inputClasses} resize-y`}
              />

              {/* Category */}
              <label className={labelClasses}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClasses} cursor-pointer`}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value} className="bg-[var(--bg-panel)] text-white">{c.label}</option>
                ))}
              </select>

              {/* Steward */}
              <label className={labelClasses}>Steward</label>
              <select value={steward} onChange={(e) => setSteward(e.target.value)} className={`${inputClasses} cursor-pointer`}>
                {STEWARDS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-[var(--bg-panel)] text-white">{s.label}</option>
                ))}
              </select>

              {/* Initial Maturity */}
              <label className={labelClasses}>Initial Maturity</label>
              <select value={maturity} onChange={(e) => setMaturity(e.target.value)} className={`${inputClasses} cursor-pointer`}>
                {MATURITY_LEVELS.map((m) => (
                  <option key={m.value} value={m.value} className="bg-[var(--bg-panel)] text-white">{m.label}</option>
                ))}
              </select>

              {/* Return Factors */}
              <label className={labelClasses}>Return Factors (select 1-4)</label>
              <div className="flex flex-col gap-2 mt-1.5">
                {RETURN_FACTORS.map((f) => (
                  <label key={f.value} className="flex items-center gap-2 text-xs text-white cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={returnFactors.includes(f.value)}
                      onChange={() => toggleFactor(f.value)}
                      className="accent-purple-400"
                    />
                    <span className="group-hover:text-white/90">{f.label}</span>
                  </label>
                ))}
              </div>

              {/* Primary Location */}
              <label className={labelClasses}>Primary Location (path or URL)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., /path/to/code or https://github.com/..."
                className={inputClasses}
              />

              {/* Error */}
              {error && (
                <p className="text-rose-400 text-xs mt-3">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="glass-pill px-4 py-2 text-sm text-[var(--text-dim)] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid || submitting}
                  className="glass-pill px-4 py-2 text-sm font-semibold text-purple-400 disabled:opacity-40 cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Create Asset'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
