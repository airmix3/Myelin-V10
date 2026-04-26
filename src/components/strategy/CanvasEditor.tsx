'use client';

/**
 * CanvasEditor -- Excalidraw wrapper component for the strategic canvas.
 *
 * Renders @excalidraw/excalidraw with dark theme.
 * Creates an adapter on mount for programmatic canvas access.
 * Auto-saves canvas snapshots with 2-second debounce.
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { createExcalidrawAdapter } from '@/lib/strategy/canvas-adapter';
import type { CanvasAdapter } from '@/lib/strategy/canvas-adapter';

interface CanvasEditorProps {
  chatId: string;
  onAdapterReady: (adapter: CanvasAdapter) => void;
}

export default function CanvasEditor({ chatId, onAdapterReady }: CanvasEditorProps) {
  const apiRef = useRef<any>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  const [ExcalidrawComp, setExcalidrawComp] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const snapshotRef = useRef<any>(null);
  const loadedRef = useRef(false);

  // Load Excalidraw module AND snapshot before rendering
  useEffect(() => {
    let cancelled = false;
    loadedRef.current = false;
    Promise.all([
      import('@excalidraw/excalidraw').then(async (mod) => {
      // Load CSS dynamically (can't use static import — breaks SSR)
      await import('@excalidraw/excalidraw/index.css');
      return mod;
    }),
      fetch(`/api/strategy/canvas-chats/${chatId}/snapshot`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([mod, snapData]) => {
      if (cancelled) return;
      setExcalidrawComp(() => mod.Excalidraw);
      if (snapData?.document?.elements) {
        snapshotRef.current = snapData.document.elements;
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [chatId]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Auto-save with 2-second debounce (skip until snapshot is loaded to avoid overwriting)
  const scheduleSave = useCallback(() => {
    if (!loadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const api = apiRef.current;
      if (!api) return;
      try {
        const elements = api.getSceneElements();
        if (!elements || elements.length === 0) return; // Don't save empty canvas
        const document = { elements, appState: api.getAppState() };
        await fetch(`/api/strategy/canvas-chats/${chatIdRef.current}/snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document }),
        });
      } catch {
        // Silently handle save failures -- canvas is local-first
      }
    }, 2000);
  }, []);

  // Excalidraw API callback -- fires when the component mounts
  const handleExcalidrawAPI = useCallback(
    (api: any) => {
      apiRef.current = api;

      // Create adapter and notify parent
      const adapter = createExcalidrawAdapter(apiRef);
      onAdapterReady(adapter);

      // Load snapshot via updateScene after mount (deferred to let Excalidraw fully initialize)
      if (snapshotRef.current) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            try {
              api.updateScene({ elements: snapshotRef.current });
              // scrollToContent needs another frame after scene update
              requestAnimationFrame(() => {
                try { api.scrollToContent(undefined, { fitToViewport: true }); } catch {}
                loadedRef.current = true;
              });
            } catch (err) {
              console.warn('[CanvasEditor] Failed to load snapshot:', err);
              loadedRef.current = true;
            }
          }, 50);
        });
      } else {
        loadedRef.current = true;
      }

    },
    [onAdapterReady, scheduleSave],
  );

  if (!ExcalidrawComp || !ready) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm text-slate-500">Loading canvas...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ExcalidrawComp
        excalidrawAPI={handleExcalidrawAPI}
        onChange={scheduleSave}
        theme="dark"
        UIOptions={{
          canvasActions: {
            saveToActiveFile: false,
            loadScene: false,
            export: false,
          },
        }}
      />
    </div>
  );
}
