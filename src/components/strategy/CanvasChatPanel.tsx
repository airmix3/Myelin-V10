'use client';

/**
 * CanvasChatPanel -- chat panel for Tamir strategic conversation alongside the canvas.
 *
 * Features:
 * - CEO messages right-aligned with glass-deep bg, Tamir messages left-aligned
 *   with glass-card bg and a red avatar dot
 * - "Place idea" button for adding Tamir response content as canvas nodes
 * - Timestamps below each message
 * - Auto-scroll to bottom on new message
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface CanvasChatPanelProps {
  chatId: string;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CanvasChatPanel({
  chatId,
}: CanvasChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Load chat history
  useEffect(() => {
    let cancelled = false;

    async function fetchMessages() {
      try {
        const res = await fetch(`/api/strategy/canvas-chats/${chatId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.messages) {
            setMessages(data.messages);
          }
        }
      } catch {
        // Fresh chat, no messages yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setMessages([]);
    setLoading(true);
    fetchMessages();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(
        `/api/strategy/canvas-chats/${chatId}/message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        const responseText = data.response || data.reply;
        if (responseText) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: responseText,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      }
    } catch {
      // Handle send failure silently
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [input, sending, chatId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  function formatTime(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  return (
    <div
      className="h-full flex flex-col shrink-0 overflow-hidden"
      style={{
        width: '360px',
        background: 'rgba(255,255,255,0.02)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 shrink-0 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: '#ef4444',
            boxShadow: '0 0 6px rgba(239,68,68,0.4)',
          }}
        />
        <span className="text-[13px] font-semibold text-white/80">
          Tamir
        </span>
        <span className="text-[10px] text-slate-600 ml-auto">
          Strategic Canvas Chat
        </span>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.06) transparent',
        }}
      >
        {loading ? (
          <div className="text-[11px] text-slate-600 text-center py-4">
            Loading...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-[11px] text-slate-500 text-center py-8 px-4">
            Start a strategic conversation. Tamir will help you think through
            ideas on the canvas.
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i}>
              <div
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-start gap-2 max-w-[85%]">
                    {/* Tamir avatar */}
                    <span
                      className="w-5 h-5 rounded-full shrink-0 mt-1"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(245,158,11,0.2))',
                        border: '1px solid rgba(239,68,68,0.3)',
                      }}
                    />
                    <div>
                      <span
                        className="text-[10px] font-medium block mb-0.5"
                        style={{ color: 'rgba(239,68,68,0.50)' }}
                      >
                        Tamir
                      </span>
                      <div
                        className="rounded-xl px-3 py-2 text-[13px] text-white/85 leading-relaxed"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )}
                {msg.role === 'user' && (
                  <div
                    className="max-w-[85%] rounded-xl px-3 py-2 text-[13px] text-white/90 leading-relaxed"
                    style={{
                      background: 'rgba(56,189,248,0.12)',
                      border: '1px solid rgba(56,189,248,0.15)',
                    }}
                  >
                    {msg.content}
                  </div>
                )}
              </div>
              {/* Timestamp */}
              <div
                className={`text-[10px] mt-0.5 ${
                  msg.role === 'user' ? 'text-right' : 'text-left ml-7'
                }`}
                style={{ color: 'rgba(255,255,255,0.20)' }}
              >
                {formatTime(msg.timestamp)}
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {sending && (
          <div className="flex items-start gap-2">
            <span
              className="w-5 h-5 rounded-full shrink-0 mt-1"
              style={{
                background:
                  'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(245,158,11,0.2))',
                border: '1px solid rgba(239,68,68,0.3)',
              }}
            />
            <div
              className="rounded-xl px-3 py-2 flex items-center gap-1"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {[0, 1, 2].map((j) => (
                <span
                  key={j}
                  className="w-1.5 h-1.5 rounded-full bg-amber-400/60"
                  style={{
                    animation: `canvasChatPulse 1.2s ease-in-out ${j * 0.18}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-4 pb-4 pt-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2.5 transition-all focus-within:shadow-[0_0_0_1px_rgba(139,92,246,0.4)]"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            rows={1}
            placeholder="Think with Tamir..."
            className="flex-1 bg-transparent text-[13px] text-slate-200 placeholder:text-slate-600 outline-none resize-none max-h-24 disabled:opacity-50"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.08) transparent',
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="p-1.5 rounded-lg transition-all disabled:opacity-30 cursor-pointer"
            style={{
              background:
                input.trim() && !sending
                  ? 'rgba(139,92,246,0.7)'
                  : 'rgba(255,255,255,0.06)',
            }}
          >
            <Send
              className="w-3.5 h-3.5"
              style={{
                color:
                  input.trim() && !sending ? '#fff' : '#64748b',
              }}
            />
          </button>
        </div>
      </div>

      {/* Pulse animation keyframes */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes canvasChatPulse {
              0%, 100% { opacity: 0.3; transform: scale(0.85); }
              50% { opacity: 1; transform: scale(1.15); }
            }
          `,
        }}
      />
    </div>
  );
}
