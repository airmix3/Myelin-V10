'use client';

/**
 * OrgDetailPanel — department customization overlay.
 *
 * For presets: department name + head title are locked. User picks personality
 * style and communication style from structured options.
 * For custom: all fields are editable.
 */

import { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { OnboardingDepartment } from '@/lib/onboarding/state';

// ---------------------------------------------------------------------------
// Structured options
// ---------------------------------------------------------------------------

const PERSONALITY_STYLES = [
  { id: 'analytical', label: 'Analytical', description: 'Systematic, data-driven, methodical' },
  { id: 'creative', label: 'Creative', description: 'Imaginative, big-picture, experimental' },
  { id: 'pragmatic', label: 'Pragmatic', description: 'Results-focused, efficient, no-nonsense' },
  { id: 'visionary', label: 'Visionary', description: 'Forward-thinking, ambitious, strategic' },
];

const COMMUNICATION_STYLES = [
  { id: 'direct', label: 'Direct & concise', description: 'Short answers, bullet points, no fluff' },
  { id: 'thorough', label: 'Detailed & thorough', description: 'Full context, explains reasoning, comprehensive' },
  { id: 'collaborative', label: 'Collaborative', description: 'Asks questions, suggests options, conversational' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgDetailPanelProps {
  mode: 'create' | 'edit';
  isPreset: boolean;
  department?: OnboardingDepartment;
  defaults?: { name: string; headName: string; personality: string };
  onSave: (dept: { name: string; headName: string; personality: string }) => void;
  onRemove?: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrgDetailPanel({
  mode,
  isPreset,
  department,
  defaults,
  onSave,
  onRemove,
  onClose,
}: OrgDetailPanelProps) {
  const [name, setName] = useState(department?.name ?? defaults?.name ?? '');
  const [headName, setHeadName] = useState(department?.headName ?? defaults?.headName ?? '');
  const [selectedPersonality, setSelectedPersonality] = useState<string | null>(
    () => {
      const existing = department?.headPersonality ?? defaults?.personality ?? '';
      const match = PERSONALITY_STYLES.find(p => existing.toLowerCase().includes(p.id));
      return match?.id ?? null;
    }
  );
  const [selectedComm, setSelectedComm] = useState<string | null>('collaborative');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  function buildPersonality(): string {
    const parts: string[] = [];
    const style = PERSONALITY_STYLES.find(p => p.id === selectedPersonality);
    if (style) parts.push(`${style.label}: ${style.description}.`);
    const comm = COMMUNICATION_STYLES.find(c => c.id === selectedComm);
    if (comm) parts.push(`Communication: ${comm.label.toLowerCase()} — ${comm.description.toLowerCase()}.`);
    return parts.join(' ') || defaults?.personality || '';
  }

  async function handleSave() {
    if (!name.trim() || !headName.trim()) return;
    setSaving(true);
    try {
      onSave({ name: name.trim(), headName: headName.trim(), personality: buildPersonality() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          width: 440,
          maxHeight: '85vh',
          background: 'rgba(12,16,28,0.97)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              {isPreset ? name : (mode === 'create' ? 'Custom Department' : name || 'Edit')}
            </span>
            {isPreset && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginLeft: 8 }}>
                {headName}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div
          className="px-5 py-5 space-y-5 overflow-y-auto"
          style={{ maxHeight: 'calc(85vh - 130px)', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
        >
          {/* Custom-only: name + head fields */}
          {!isPreset && (
            <>
              <div>
                <label className="block mb-1.5" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.30)' }}>
                  Department Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Data Science"
                  className="w-full rounded-lg px-3 py-2.5 focus:border-sky-500/40"
                  style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.30)' }}>
                  Head Title
                </label>
                <input
                  type="text"
                  value={headName}
                  onChange={(e) => setHeadName(e.target.value)}
                  placeholder="e.g. Head of Data"
                  className="w-full rounded-lg px-3 py-2.5 focus:border-sky-500/40"
                  style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }}
                />
              </div>
            </>
          )}

          {/* Personality style picker */}
          <div>
            <label className="block mb-2" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.30)' }}>
              Personality
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PERSONALITY_STYLES.map((style) => {
                const active = selectedPersonality === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setSelectedPersonality(active ? null : style.id)}
                    className="rounded-lg px-3 py-2.5 text-left transition-all cursor-pointer"
                    style={{
                      background: active ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${active ? 'rgba(56,189,248,0.30)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: active ? 'rgba(56,189,248,0.40)' : 'transparent',
                          border: `1.5px solid ${active ? 'rgba(56,189,248,0.60)' : 'rgba(255,255,255,0.12)'}`,
                        }}
                      >
                        {active && <Check size={8} color="#fff" />}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: active ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.60)' }}>
                        {style.label}
                      </span>
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3, marginLeft: 22, lineHeight: 1.3 }}>
                      {style.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Communication style picker */}
          <div>
            <label className="block mb-2" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.30)' }}>
              Communication
            </label>
            <div className="space-y-1.5">
              {COMMUNICATION_STYLES.map((style) => {
                const active = selectedComm === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setSelectedComm(style.id)}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all cursor-pointer"
                    style={{
                      background: active ? 'rgba(139,92,246,0.08)' : 'transparent',
                      border: `1px solid ${active ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)'}`,
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        background: active ? '#a78bfa' : 'transparent',
                        border: `1.5px solid ${active ? '#a78bfa' : 'rgba(255,255,255,0.12)'}`,
                      }}
                    />
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)' }}>
                        {style.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 6 }}>
                        {style.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex gap-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {mode === 'edit' && onRemove && (
            <button
              onClick={() => setShowRemoveConfirm(true)}
              className="px-4 py-2.5 rounded-lg transition-all cursor-pointer"
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.30)'; e.currentTarget.style.color = '#fca5a5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.30)'; }}
            >
              Remove
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!name.trim() || !headName.trim() || !selectedPersonality || saving}
            className="flex-1 py-2.5 rounded-lg font-medium transition-all disabled:opacity-25 cursor-pointer"
            style={{
              fontSize: 13,
              background: 'rgba(56,189,248,0.12)',
              border: '1px solid rgba(56,189,248,0.25)',
              color: '#7dd3fc',
            }}
          >
            {saving ? 'Adding...' : mode === 'create' ? 'Add Department' : 'Save'}
          </button>
        </div>
      </div>

      {/* Remove Confirmation */}
      {showRemoveConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="rounded-xl p-5 max-w-xs"
            style={{
              background: 'rgba(12,16,28,0.97)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}
          >
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 16 }}>
              Remove <strong>{name}</strong>?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="flex-1 py-2 rounded-lg cursor-pointer"
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowRemoveConfirm(false); onRemove?.(); }}
                className="flex-1 py-2 rounded-lg font-medium cursor-pointer"
                style={{ fontSize: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
