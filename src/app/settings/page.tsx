'use client';

import { useState, useEffect } from 'react';

interface SystemInfo {
  nodeVersion: string;
  platform: string;
  dbPath: string;
  runtime: string;
  workerStatus: string;
}

export default function SettingsPage() {
  const [showModal, setShowModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<Record<string, number> | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    fetch('/api/system/info')
      .then(res => res.json())
      .then(data => setSystemInfo(data))
      .catch(() => { /* fallback to null */ });
  }, []);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/system/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResetResult(data.summary);
      }
    } catch {
      // error handled silently
    } finally {
      setResetting(false);
      setShowModal(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '640px' }}>
      <h1>Settings</h1>

      {/* System Info section per D-09 */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-title">System Info</div>
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Node.js</span>
            <div style={{ fontWeight: 'bold' }}>{systemInfo?.nodeVersion ?? 'Loading...'}</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Database</span>
            <div style={{ fontWeight: 'bold' }}>{systemInfo?.dbPath ?? 'data/myelin.db'} (SQLite)</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Runtime</span>
            <div style={{ fontWeight: 'bold' }}>{systemInfo?.runtime ?? 'Next.js 14 (App Router)'}</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Worker</span>
            <div style={{ fontWeight: 'bold' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', marginRight: '4px' }} />
              {systemInfo?.workerStatus === 'running' ? 'Running' : 'Loading...'}
            </div>
          </div>
        </div>
      </div>

      {/* Reset result banner */}
      {resetResult && (
        <div className="card" style={{ marginTop: '16px', borderColor: 'var(--green)' }}>
          <div style={{ padding: '16px', fontSize: '12px' }}>
            <strong style={{ color: 'var(--green)' }}>System reset complete.</strong>
            <span style={{ color: 'var(--text-dim)', marginLeft: '8px' }}>
              Deleted: {resetResult.tasksDeleted} tasks, {resetResult.taskRunsDeleted} runs, {resetResult.deliverablesDeleted} deliverables, {resetResult.tempsTerminated} temp employees terminated.
            </span>
          </div>
        </div>
      )}

      {/* Danger Zone per D-08 */}
      <div className="danger-zone" style={{ marginTop: '24px' }}>
        <h3>Danger Zone</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '12px' }}>
          Reset all operational data. Vault documents, company DNA, skills, and permanent employees are preserved.
        </p>
        <button className="btn-danger" onClick={() => setShowModal(true)} disabled={resetting}>
          Reset System
        </button>
      </div>

      {/* Confirm modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reset all system data?</h3>
            <p>
              This will delete all tasks, task runs, activity logs, and deliverables.
              Vault documents, company DNA, skills, and permanent employees are preserved.
              This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>Keep Data</button>
              <button className="btn-danger" onClick={handleReset} disabled={resetting}>
                {resetting ? 'Resetting...' : 'Reset System'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
