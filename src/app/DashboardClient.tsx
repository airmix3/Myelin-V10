'use client';

import { Search } from 'lucide-react';
import StatusBar from '@/components/layout/StatusBar';
import MissionBoard from '@/components/dashboard/MissionBoard';
import TamirPanel from '@/components/dashboard/TamirPanel';
import type { Task } from '@/components/dashboard/MissionBoard';

export default function DashboardClient({ initialTasks }: { initialTasks: Task[] }) {
  const openCommandPalette = () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    );
  };

  return (
    <div style={{ margin: '-24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Dashboard Header */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 20px 2px',
        height: '44px',
        background: 'rgba(6,10,19,0.6)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(16px) saturate(140%)',
      }}>
        <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', margin: 0 }}>Home</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            style={{
              padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              background: 'rgba(56,189,248,0.12)', color: '#38bdf8',
              border: '1px solid rgba(56,189,248,0.20)', cursor: 'pointer',
            }}
          >
            Overview
          </button>
          <button
            onClick={openCommandPalette}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Search size={13} style={{ color: '#475569' }} />
            <span style={{ fontSize: '12px', color: '#475569' }}>Search &amp; act</span>
            <kbd style={{ fontSize: '10px', color: '#334155', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>
              &#8984;K
            </kbd>
          </button>
        </div>
      </div>

      {/* StatusBar metrics strip */}
      <div style={{ flexShrink: 0, padding: '0 4px' }}>
        <StatusBar />
      </div>

      {/* MissionBoard + TamirPanel — match mock: grid-cols-[1fr_340px] gap-3 px-4 pb-3 pt-1 */}
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px',
        gap: '12px', padding: '4px 16px 12px', minHeight: 0, overflow: 'hidden',
      }}>
        <div style={{ minHeight: 0, height: '100%' }}>
          <MissionBoard initialTasks={initialTasks} />
        </div>
        <div style={{ minHeight: 0, height: '100%', paddingTop: '4px', paddingBottom: '4px' }}>
          <TamirPanel />
        </div>
      </div>
    </div>
  );
}
