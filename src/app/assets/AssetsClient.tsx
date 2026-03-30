'use client';

import { useState, useCallback, useRef } from 'react';
import AssetCityCanvas, { type CanvasControls } from './AssetCityCanvas';
import AssetDetailPanel from './AssetDetailPanel';
import AssetToolbar from './AssetToolbar';
import EvolutionTimeline from './EvolutionTimeline';
import CreateAssetModal from './CreateAssetModal';

interface AssetEvent {
  id: string;
  assetId: string;
  type: string;
  summary: string;
  metadata: string | null;
  agentId: string | null;
  createdAt: string;
}

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
  events?: AssetEvent[];
}

interface AssetsClientProps {
  initialAssets: Asset[];
}

export default function AssetsClient({ initialAssets }: AssetsClientProps) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [categoryFilters, setCategoryFilters] = useState<Record<string, boolean>>({
    code: true,
    brand: true,
    IP: true,
    'digital-product': true,
    knowledge: true,
  });

  const canvasControlRef = useRef<CanvasControls>(null);

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

  const handleToggleCategory = useCallback((cat: string) => {
    setCategoryFilters((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const filteredAssets = assets.filter((a) => categoryFilters[a.category] !== false);

  const selectedEvents = selectedAssetId
    ? assets.find((a) => a.id === selectedAssetId)?.events || null
    : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <AssetCityCanvas
        ref={canvasControlRef}
        assets={filteredAssets}
        selectedAssetId={selectedAssetId}
        onAssetSelect={handleAssetSelect}
      />

      <AssetToolbar
        onCreateClick={() => setShowCreateModal(true)}
        onZoomIn={() => canvasControlRef.current?.zoomIn()}
        onZoomOut={() => canvasControlRef.current?.zoomOut()}
        onZoomReset={() => canvasControlRef.current?.zoomReset()}
        categoryFilters={categoryFilters}
        onToggleCategory={handleToggleCategory}
        panelOpen={!!selectedAssetId}
      />

      {selectedAssetId && (
        <AssetDetailPanel
          assetId={selectedAssetId}
          onClose={() => setSelectedAssetId(null)}
          onAssetUpdated={refreshAssets}
        />
      )}

      <EvolutionTimeline
        selectedAssetId={selectedAssetId}
        events={selectedEvents}
      />

      {assets.length === 0 && !showCreateModal && (
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
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'var(--font)',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Create First Asset
          </button>
        </div>
      )}

      <CreateAssetModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={refreshAssets}
      />
    </div>
  );
}
