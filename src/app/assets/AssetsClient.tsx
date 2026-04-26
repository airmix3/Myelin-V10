'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Target,
  CircuitBoard,
  Sparkles,
  Shield,
  Layers,
  BookOpen,
  Plus,
} from 'lucide-react';
import AssetDetailPanel from './AssetDetailPanel';
import CreateAssetModal from './CreateAssetModal';

/* -- Types -- */

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

/* -- Category Config -- */

const CATEGORY_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  accent: string;
  accentBg: string;
  gradient: string;
  border: string;
}> = {
  code: {
    label: 'Code',
    icon: CircuitBoard,
    accent: 'text-blue-400',
    accentBg: 'bg-blue-500/15',
    gradient: 'from-blue-500/20 to-transparent',
    border: 'border-blue-500/30',
  },
  brand: {
    label: 'Brand',
    icon: Sparkles,
    accent: 'text-purple-400',
    accentBg: 'bg-purple-500/15',
    gradient: 'from-purple-500/20 to-transparent',
    border: 'border-purple-500/30',
  },
  IP: {
    label: 'IP',
    icon: Shield,
    accent: 'text-amber-400',
    accentBg: 'bg-amber-500/15',
    gradient: 'from-amber-500/20 to-transparent',
    border: 'border-amber-500/30',
  },
  'digital-product': {
    label: 'Digital Product',
    icon: Layers,
    accent: 'text-sky-400',
    accentBg: 'bg-sky-500/15',
    gradient: 'from-sky-500/20 to-transparent',
    border: 'border-sky-500/30',
  },
  knowledge: {
    label: 'Knowledge',
    icon: BookOpen,
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-500/15',
    gradient: 'from-emerald-500/20 to-transparent',
    border: 'border-emerald-500/30',
  },
};

const ALL_CATEGORIES = ['code', 'brand', 'IP', 'digital-product', 'knowledge'] as const;

const HEALTH_DOT: Record<string, string> = {
  healthy: 'bg-emerald-400',
  stale: 'bg-amber-400',
  degraded: 'bg-rose-400',
  critical: 'bg-rose-500',
};

const AGENT_LABELS: Record<string, string> = {
  cto: 'CTO',
  cmo: 'CMO',
  coo: 'COO',
  tamir: 'Tamir',
};

/* -- Component -- */

export default function AssetsClient({ initialAssets }: AssetsClientProps) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

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

  const filteredAssets = activeFilter
    ? assets.filter((a) => a.category === activeFilter)
    : assets;

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* -- Page Header -- */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <Target className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Assets</h1>
            <p className="text-sm text-[var(--text-dim)]">
              Company strategic assets and their evolution
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="glass-pill flex items-center gap-2 px-4 py-2 text-sm font-medium text-white hover:scale-[1.02] transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Asset
        </button>
      </div>

      {/* -- Category Filter Bar -- */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveFilter(null)}
          className={`glass-pill px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
            activeFilter === null
              ? 'text-white ring-1 ring-white/20'
              : 'text-[var(--text-dim)] hover:text-white'
          }`}
        >
          All
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const Icon = cfg.icon;
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
              className={`glass-pill px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                activeFilter === cat
                  ? `${cfg.accent} ring-1 ring-current/30`
                  : 'text-[var(--text-dim)] hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* -- Asset Card Grid -- */}
      {filteredAssets.length === 0 && !showCreateModal ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-purple-400/60" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">No assets yet</h2>
          <p className="text-sm text-[var(--text-dim)] max-w-sm mb-6">
            Create your first company asset to start building your strategic portfolio.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="glass-pill px-5 py-2.5 text-sm font-semibold text-purple-400 hover:scale-[1.02] transition-transform cursor-pointer"
          >
            Create First Asset
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredAssets.map((asset, i) => {
              const cfg = CATEGORY_CONFIG[asset.category] || CATEGORY_CONFIG.code;
              const Icon = cfg.icon;
              const healthDot = HEALTH_DOT[asset.healthStatus] || 'bg-slate-400';
              const stewardName = asset.stewardId ? AGENT_LABELS[asset.stewardId] || asset.stewardId : null;

              return (
                <motion.div
                  key={asset.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  onClick={() => handleAssetSelect(asset.id)}
                  className={`glass-card rounded-xl overflow-hidden cursor-pointer group hover:scale-[1.01] transition-transform border ${cfg.border}`}
                >
                  {/* Colored header strip */}
                  <div className={`h-12 bg-gradient-to-b ${cfg.gradient} flex items-center gap-3 px-4`}>
                    <div className={`w-7 h-7 rounded-lg ${cfg.accentBg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${cfg.accent}`} />
                    </div>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.accent}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="p-4 space-y-3">
                    <h3 className="text-base font-bold text-white truncate group-hover:text-white/90">
                      {asset.title}
                    </h3>

                    {asset.description && (
                      <p className="text-xs text-[var(--text-dim)] line-clamp-2 leading-relaxed">
                        {asset.description}
                      </p>
                    )}

                    {/* Metadata row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Maturity badge */}
                      <span className="glass-pill px-2 py-0.5 text-[10px] font-medium text-[var(--text-dim)] capitalize">
                        {asset.maturity}
                      </span>

                      {/* Health dot */}
                      <span className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${healthDot}`} />
                        <span className="text-[10px] text-[var(--text-dim)] capitalize">
                          {asset.healthStatus}
                        </span>
                      </span>

                      {/* Steward */}
                      {stewardName && (
                        <span className="glass-pill px-2 py-0.5 text-[10px] font-medium text-[var(--text-dim)]">
                          {stewardName}
                        </span>
                      )}
                    </div>

                    {/* Return factors */}
                    {asset.returnFactors && (() => {
                      try {
                        const factors = JSON.parse(asset.returnFactors);
                        if (Array.isArray(factors) && factors.length > 0) {
                          return (
                            <div className="flex gap-1 flex-wrap">
                              {factors.map((f: string) => (
                                <span key={f} className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${cfg.accentBg} ${cfg.accent}`}>
                                  {f.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          );
                        }
                      } catch { /* ignore parse errors */ }
                      return null;
                    })()}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* -- Detail Panel -- */}
      <AnimatePresence>
        {selectedAssetId && (
          <AssetDetailPanel
            assetId={selectedAssetId}
            onClose={() => setSelectedAssetId(null)}
            onAssetUpdated={refreshAssets}
          />
        )}
      </AnimatePresence>

      {/* -- Create Modal -- */}
      <CreateAssetModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={refreshAssets}
      />
    </div>
  );
}
