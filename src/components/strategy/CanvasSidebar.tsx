'use client';

/**
 * CanvasSidebar — lists canvas-chats with create/switch functionality.
 *
 * Similar pattern to Tamir's ChatSidebar but for canvas-chat sessions.
 * Glass-panel styling, 280px width, scrollable list.
 */

import { useState, useEffect } from 'react';
import { Plus, Layout } from 'lucide-react';

export interface CanvasChat {
  id: string;
  title: string;
  lastOpenedAt: string;
  preview?: string;
}

interface CanvasSidebarProps {
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateChat: (chat: CanvasChat) => void;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CanvasSidebar({
  activeChatId,
  onSelectChat,
  onCreateChat,
}: CanvasSidebarProps) {
  const [chats, setChats] = useState<CanvasChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchChats() {
      try {
        const res = await fetch('/api/strategy/canvas-chats');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setChats(Array.isArray(data) ? data : data.chats ?? []);
        }
      } catch {
        // Silently handle
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchChats();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateChat = async () => {
    try {
      const res = await fetch('/api/strategy/canvas-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Canvas' }),
      });
      if (res.ok) {
        const newChat: CanvasChat = await res.json();
        setChats((prev) => [newChat, ...prev]);
        onCreateChat(newChat);
      }
    } catch {
      // Silently handle
    }
  };

  return (
    <div
      className="h-full flex flex-col shrink-0 overflow-hidden"
      style={{
        width: '280px',
        background: 'rgba(255,255,255,0.02)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Header */}
      <div className="px-3 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Layout className="w-4 h-4 text-purple-400" />
          <span className="text-[13px] font-semibold text-white/80">
            Canvases
          </span>
        </div>
        <button
          onClick={handleCreateChat}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-purple-300 cursor-pointer transition-all hover:brightness-125"
          style={{
            background: 'rgba(139,92,246,0.10)',
            border: '1px solid rgba(139,92,246,0.20)',
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {/* Chat list */}
      <div
        className="flex-1 overflow-y-auto px-1.5"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.06) transparent',
        }}
      >
        {loading ? (
          <div className="text-[11px] text-slate-600 text-center py-4">
            Loading...
          </div>
        ) : chats.length === 0 ? (
          <div className="text-[11px] text-slate-600 text-center py-8 px-4">
            No canvases yet. Create one to start sketching ideas.
          </div>
        ) : (
          chats.map((chat) => {
            const active = chat.id === activeChatId;
            return (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all cursor-pointer mb-0.5 ${
                  active ? 'bg-white/5' : 'hover:bg-white/[0.03]'
                }`}
                style={
                  active
                    ? { borderLeft: '2px solid rgba(139,92,246,0.7)' }
                    : { borderLeft: '2px solid transparent' }
                }
              >
                <div
                  className={`text-[13px] font-medium truncate ${
                    active ? 'text-white' : 'text-slate-300'
                  }`}
                >
                  {chat.title}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-600">
                    {relativeTime(chat.lastOpenedAt)}
                  </span>
                  {chat.preview && (
                    <span className="text-[10px] text-slate-600 truncate">
                      {chat.preview}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer info */}
      <div
        className="px-3 py-2.5 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="text-[10px] text-slate-600 text-center">
          {chats.length} canvas{chats.length !== 1 ? 'es' : ''}
        </div>
      </div>
    </div>
  );
}
