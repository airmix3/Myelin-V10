'use client';

import { useEffect, useState } from 'react';

export type AssetTarget =
  | { mode: 'not-sure' }
  | { mode: 'new-asset' }
  | { mode: 'standalone' }
  | { mode: 'specific'; assetId?: string; assetTitle?: string };

type AssetSummary = {
  id: string;
  title: string;
};

const OPTIONS: Array<{ value: AssetTarget['mode']; label: string }> = [
  { value: 'not-sure', label: 'Not Sure' },
  { value: 'specific', label: 'Existing Asset' },
  { value: 'new-asset', label: 'New Asset' },
  { value: 'standalone', label: 'Standalone' },
];

export default function TaskAssetSelector({
  value,
  onChange,
}: {
  value: AssetTarget;
  onChange: (target: AssetTarget) => void;
}) {
  const [assets, setAssets] = useState<AssetSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/assets')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        setAssets(data.map((asset: { id: string; title: string }) => ({
          id: asset.id,
          title: asset.title,
        })));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="shrink-0 px-6 pt-3"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="max-w-3xl mx-auto rounded-2xl p-4 glass-card space-y-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">
            Task Context
          </div>
          <p className="text-[12px] text-slate-400 mt-1">
            Tell Tamir whether this work should stay standalone or attach to an existing asset.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onChange({ mode: option.value } as AssetTarget)}
              className="px-3 py-2 rounded-xl text-[12px] font-semibold transition-all cursor-pointer"
              style={{
                background: value.mode === option.value ? 'rgba(56,189,248,0.14)' : 'rgba(255,255,255,0.04)',
                color: value.mode === option.value ? '#7dd3fc' : '#cbd5e1',
                border: value.mode === option.value
                  ? '1px solid rgba(56,189,248,0.35)'
                  : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {value.mode === 'specific' && (
          <div className="space-y-2">
            <label className="block text-[11px] text-slate-500 uppercase tracking-[0.12em]">
              Pick Asset
            </label>
            <select
              value={value.assetId ?? ''}
              onChange={(event) => {
                const next = assets.find((asset) => asset.id === event.target.value);
                onChange({
                  mode: 'specific',
                  assetId: next?.id,
                  assetTitle: next?.title,
                });
              }}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-slate-200 bg-transparent outline-none"
              style={{ border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)' }}
            >
              <option value="">Choose an asset...</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
