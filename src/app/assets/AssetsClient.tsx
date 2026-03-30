'use client';

import { useState, useCallback } from 'react';
import AssetCityCanvas from './AssetCityCanvas';

interface Asset {
  id: string;
  title: string;
  description: string | null;
  category: string;
  maturity: string;
  stewardId: string | null;
  returnFactors: string | null;
  healthStatus: string;
  directoryPath: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssetsClientProps {
  initialAssets: Asset[];
}

export default function AssetsClient({ initialAssets }: AssetsClientProps) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const handleAssetSelect = useCallback((assetId: string | null) => {
    setSelectedAssetId(assetId);
  }, []);

  const refreshAssets = useCallback(async () => {
    try {
      const res = await fetch('/api/assets');
      if (res.ok) setAssets(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <AssetCityCanvas
        assets={assets}
        selectedAssetId={selectedAssetId}
        onAssetSelect={handleAssetSelect}
      />
      {/* AssetToolbar and AssetDetailPanel will be added in Plan 04 */}
      {/* EvolutionTimeline will be added in Plan 04 */}
      {assets.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: 'var(--text-dim)',
            maxWidth: 400,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 16,
              color: 'var(--text)',
            }}
          >
            Your company portfolio is empty
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 24 }}>
            Create your first asset to start building your company map. Assets are the things your
            company manages over time — code, brand, IP, products, and knowledge.
          </p>
        </div>
      )}
    </div>
  );
}
