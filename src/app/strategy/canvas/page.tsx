'use client';

/**
 * /strategy/canvas -- Strategic Canvas Page
 *
 * Three-column layout:
 *   Left (280px):  CanvasSidebar -- list & create canvas-chats
 *   Center (flex):  CanvasEditor -- Excalidraw canvas (dynamic import, ssr: false)
 *   Right (360px): CanvasChatPanel -- Tamir strategic conversation
 *
 * Additional features:
 *   - Floating "Open Tamir" button (bottom-right of canvas area)
 *   - TamirSlideOver panel (right-side, z-50) for quick task routing
 *   - Keyboard shortcut: Ctrl+T / Cmd+T to toggle slide-over
 *
 * Excalidraw is dynamically imported to avoid SSR crashes (browser-only APIs).
 * The center column uses CSS isolation to prevent style conflicts.
 */

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles, GitCommit } from 'lucide-react';
import type { CanvasAdapter } from '@/lib/strategy/canvas-adapter';
import CanvasSidebar from '@/components/strategy/CanvasSidebar';
import type { CanvasChat } from '@/components/strategy/CanvasSidebar';
import CanvasChatPanel from '@/components/strategy/CanvasChatPanel';
import TamirSlideOver from '@/components/strategy/TamirSlideOver';
import CommitDirectionModal from '@/components/strategy/CommitDirectionModal';

// Dynamic import -- SSR disabled for Excalidraw (browser-only APIs)
const CanvasEditor = dynamic(
  () => import('@/components/strategy/CanvasEditor'),
  { ssr: false },
);

export default function CanvasPage() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [adapter, setAdapter] = useState<CanvasAdapter | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [showSlideOver, setShowSlideOver] = useState(false);
  const [showCommitOverlay, setShowCommitOverlay] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);

  // Set page title
  useEffect(() => {
    document.title = 'Strategic Canvas';
  }, []);

  // Keyboard shortcut: Ctrl+T / Cmd+T to toggle slide-over
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        setShowSlideOver((prev) => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load initial chat list and select first
  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const res = await fetch('/api/strategy/canvas-chats');
        if (res.ok) {
          const data = await res.json();
          const chats = data.chats ?? [];
          if (!cancelled && chats.length > 0 && !activeChatId) {
            setActiveChatId(chats[0].id);
          }
        }
      } catch {
        // No chats yet
      } finally {
        if (!cancelled) setInitialLoadDone(true);
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdapterReady = useCallback((newAdapter: CanvasAdapter) => {
    setAdapter(newAdapter);
  }, []);

  const handleSelectChat = useCallback(
    async (chatId: string) => {
      // Save current canvas before switching
      if (adapter && activeChatId) {
        try {
          const document = adapter.getSnapshot();
          await fetch(
            `/api/strategy/canvas-chats/${activeChatId}/snapshot`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ document }),
            },
          );
        } catch {
          // Best-effort save
        }
      }
      setAdapter(null);
      setActiveChatId(chatId);
    },
    [adapter, activeChatId],
  );

  const handleCreateChat = useCallback((chat: CanvasChat) => {
    setAdapter(null);
    setActiveChatId(chat.id);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Left sidebar -- canvas-chat list */}
      <CanvasSidebar
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onCreateChat={handleCreateChat}
      />

      {/* Center -- Excalidraw canvas editor */}
      <div
        className="flex-1 relative overflow-hidden"
        style={{ isolation: 'isolate' }}
      >
        {activeChatId ? (
          <CanvasEditor
            key={activeChatId}
            chatId={activeChatId}
            onAdapterReady={handleAdapterReady}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{
                  background: 'rgba(139,92,246,0.12)',
                  border: '1px solid rgba(139,92,246,0.2)',
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(139,92,246,0.6)"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white/80 mb-1">
                {initialLoadDone ? 'Create a Canvas' : 'Loading...'}
              </h2>
              {initialLoadDone && (
                <p className="text-[13px] text-slate-500 max-w-[20rem]">
                  Use the sidebar to create a new canvas and start thinking
                  with Tamir.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Floating buttons */}
        {activeChatId && (
          <>
            {/* Commit Direction button -- top-right */}
            <button
              onClick={() => setShowCommitOverlay(true)}
              className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all z-10"
              style={{
                background: 'rgba(139,92,246,0.15)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(139,92,246,0.30)',
                color: '#c4b5fd',
              }}
              title="Commit this canvas as a strategic direction"
            >
              <GitCommit className="w-4 h-4" />
              <span className="text-[12px] font-medium">Commit Direction</span>
            </button>

            {/* Success toast */}
            {commitSuccess && (
              <div
                className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-[12px] font-medium z-20"
                style={{
                  background: 'rgba(34,197,94,0.15)',
                  border: '1px solid rgba(34,197,94,0.30)',
                  color: '#86efac',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {commitSuccess}
              </div>
            )}

            {/* Open Tamir button -- bottom-right */}
            <button
              onClick={() => setShowSlideOver(true)}
              className="absolute bottom-6 right-6 flex items-center gap-2 px-4 py-2.5 rounded-full cursor-pointer transition-all z-10"
              style={{
                background: 'var(--glass-elevated)',
                backdropFilter: 'blur(12px) saturate(140%) brightness(1.05)',
                WebkitBackdropFilter: 'blur(12px) saturate(140%) brightness(1.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25)',
                color: '#fff',
              }}
              title="Open Tamir (Ctrl+T)"
            >
              <Sparkles className="w-4 h-4" style={{ color: '#f59e0b' }} />
              <span className="text-[12px] font-medium text-white/85">Open Tamir</span>
            </button>
          </>
        )}
      </div>

      {/* Smart commit direction modal */}
      {activeChatId && (
        <CommitDirectionModal
          chatId={activeChatId}
          isOpen={showCommitOverlay}
          onClose={() => setShowCommitOverlay(false)}
          onCommitted={(title) => {
            setShowCommitOverlay(false);
            setCommitSuccess('Direction created: ' + title);
            setTimeout(() => setCommitSuccess(null), 4000);
          }}
        />
      )}

      {/* Right -- chat panel */}
      {activeChatId && (
        <CanvasChatPanel chatId={activeChatId} />
      )}

      {/* Tamir slide-over (z-50, above everything) */}
      <TamirSlideOver
        isOpen={showSlideOver}
        onClose={() => setShowSlideOver(false)}
      />
    </div>
  );
}
