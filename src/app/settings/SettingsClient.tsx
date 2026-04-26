'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings, LayoutGrid, Target, Moon, Check, RotateCcw,
  AlertTriangle, Server, Database, Cpu, Activity, Eye,
} from 'lucide-react';

// -- Types --------------------------------------------------------------------

interface SystemInfo {
  nodeVersion: string;
  platform: string;
  dbPath: string;
  runtime: string;
  workerStatus: string;
  langfuseStatus: string;
}

type LayoutPreset = 'overview' | 'focus' | 'deep-work';

// -- Layout Presets -----------------------------------------------------------

const PRESETS: {
  id: LayoutPreset;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutGrid,
    color: '#38bdf8',
    description: 'Full dashboard. All missions, all metrics, all panels.',
  },
  {
    id: 'focus',
    label: 'Focus Mode',
    icon: Target,
    color: '#f59e0b',
    description: 'Top priority mission + Tamir only. Everything else hidden.',
  },
  {
    id: 'deep-work',
    label: 'Deep Work',
    icon: Moon,
    color: '#a78bfa',
    description: 'All silenced. Only critical escalations will interrupt.',
  },
];

// -- Component ----------------------------------------------------------------

export default function SettingsClient() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<Record<string, number> | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('overview');

  // Load system info
  useEffect(() => {
    fetch('/api/system/info')
      .then((res) => res.json())
      .then((data) => setSystemInfo(data))
      .catch(() => { /* fallback to null */ });
  }, []);

  // Load layout preset from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('myelin-settings-layout-preset');
    if (stored && ['overview', 'focus', 'deep-work'].includes(stored)) {
      setLayoutPreset(stored as LayoutPreset);
    }
  }, []);

  const handlePresetChange = (preset: LayoutPreset) => {
    setLayoutPreset(preset);
    localStorage.setItem('myelin-settings-layout-preset', preset);
  };

  const handleReset = async () => {
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch('/api/system/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResetResult(data.summary);
      } else {
        setResetError('Reset failed. Please try again.');
      }
    } catch {
      setResetError('Network error during reset.');
    } finally {
      setResetting(false);
      setShowModal(false);
    }
  };

  // -- System info rows -------------------------------------------------------

  const infoRows = systemInfo
    ? [
        { label: 'Node.js', value: systemInfo.nodeVersion, icon: Server },
        { label: 'Database', value: `${systemInfo.dbPath} (SQLite)`, icon: Database },
        { label: 'Runtime', value: systemInfo.runtime || 'Next.js 14 (App Router)', icon: Cpu },
        {
          label: 'Worker',
          value: systemInfo.workerStatus === 'running' ? 'Running' : 'Stopped',
          icon: Activity,
          status: systemInfo.workerStatus === 'running' ? 'active' : 'inactive',
        },
        {
          label: 'Observability',
          value: systemInfo.langfuseStatus === 'active' ? 'Active' : 'Inactive',
          icon: Eye,
          status: systemInfo.langfuseStatus === 'active' ? 'active' : 'inactive',
        },
      ]
    : null;

  // -- Render -----------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}
          >
            <Settings className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm text-slate-400">System configuration and preferences</p>
          </div>
        </div>
      </motion.div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: System Info */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <h2 className="text-[15px] font-bold text-white mb-1">System Info</h2>
          <p className="text-[12px] text-slate-500 mb-5 leading-relaxed">Runtime environment details</p>

          {!infoRows ? (
            /* Loading skeleton */
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-2.5 w-16 rounded bg-white/5 animate-pulse mb-1.5" />
                    <div className="h-3 w-32 rounded bg-white/5 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {infoRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  >
                    <row.icon size={14} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">{row.label}</p>
                    <div className="flex items-center gap-2">
                      {'status' in row && row.status && (
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{
                            background: row.status === 'active' ? '#34d399' : '#64748b',
                            boxShadow: row.status === 'active' ? '0 0 6px rgba(52,211,153,0.5)' : 'none',
                          }}
                        />
                      )}
                      <p className="text-[13px] text-white font-mono truncate">{row.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right: Frontend Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <h2 className="text-[15px] font-bold text-white mb-1">Layout Preset</h2>
          <p className="text-[12px] text-slate-500 mb-5 leading-relaxed">
            Switch your dashboard mode based on what you are doing
          </p>

          <div className="space-y-2">
            {PRESETS.map((p) => {
              const active = layoutPreset === p.id;
              return (
                <motion.button
                  key={p.id}
                  onClick={() => handlePresetChange(p.id)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full text-left rounded-xl px-4 py-3 transition-all cursor-pointer relative flex items-center gap-3"
                  style={{
                    background: active ? `${p.color}10` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${active ? `${p.color}35` : 'rgba(255,255,255,0.07)'}`,
                    boxShadow: active ? `0 0 20px ${p.color}10` : 'none',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: active ? `${p.color}15` : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${active ? `${p.color}30` : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    <p.icon size={14} style={{ color: active ? p.color : '#64748b' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold" style={{ color: active ? p.color : 'white' }}>
                      {p.label}
                    </span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{p.description}</p>
                  </div>
                  {active && (
                    <motion.div
                      layoutId="preset-active"
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: `${p.color}20`, border: `1px solid ${p.color}40` }}
                    >
                      <Check size={10} style={{ color: p.color }} />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Reset result banner */}
      <AnimatePresence>
        {resetResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-xl px-5 py-3"
            style={{
              background: 'rgba(52,211,153,0.08)',
              border: '1px solid rgba(52,211,153,0.2)',
            }}
          >
            <div className="flex items-center gap-2">
              <Check size={14} className="text-emerald-400 shrink-0" />
              <span className="text-[13px] font-medium text-emerald-300">System reset complete.</span>
              <span className="text-[12px] text-slate-400">
                Deleted: {resetResult.tasksDeleted} tasks, {resetResult.taskRunsDeleted} runs, {resetResult.deliverablesDeleted} deliverables, {resetResult.tempsTerminated} temp employees terminated.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset error banner */}
      <AnimatePresence>
        {resetError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-xl px-5 py-3"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <span className="text-[13px] font-medium text-red-300">{resetError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="rounded-2xl p-6"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(239,68,68,0.15)',
        }}
      >
        <h2 className="text-[15px] font-bold text-red-400 mb-1">Danger Zone</h2>
        <p className="text-[12px] text-slate-500 mb-4 leading-relaxed">
          Reset all operational data. Vault documents, company DNA, skills, and permanent employees are preserved.
        </p>
        <button
          onClick={() => setShowModal(true)}
          disabled={resetting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171',
          }}
        >
          <RotateCcw size={13} />
          Reset System
        </button>
      </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setShowModal(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 rounded-2xl p-6 w-full max-w-md mx-4"
              style={{
                background: 'rgba(10,16,36,0.98)',
                border: '1px solid rgba(239,68,68,0.2)',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-[16px] font-bold text-white mb-2">Reset all system data?</h3>
              <p className="text-[13px] text-slate-400 leading-relaxed mb-6">
                This will delete all tasks, task runs, activity logs, and deliverables.
                Vault documents, company DNA, skills, and permanent employees are preserved.
                This cannot be undone.
              </p>
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-slate-400 transition-all cursor-pointer"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  Keep Data
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all cursor-pointer"
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171',
                  }}
                >
                  {resetting ? 'Resetting...' : 'Reset System'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom spacer */}
      <div className="h-8" />
    </div>
  );
}
