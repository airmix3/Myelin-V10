'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { marked } from 'marked';
import CategorySidebar from './CategorySidebar';
import { useSSE } from '@/components/useSSE';

// Configure marked for inline rendering (no wrapping <p> for single lines)
marked.setOptions({ breaks: true });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id?: string;
  role: 'cos' | 'founder';
  content: string;
  timestamp: string;
  /** Optional inline action buttons (e.g., Phase 4 Upload/Build choice) */
  actions?: Array<{ label: string; value: string }>;
}

export interface ChatPhaseProps {
  phaseNumber: number;
  phaseTitle: string;
  cosName: string;
  cosAvatarPath: string;
  founderName?: string;
  onPhaseComplete: () => void;
  showCategorySidebar?: boolean;
  categoryState?: Record<string, boolean>;
  onCategoryUpdate?: (category: string, hasItems: boolean) => void;
}

// ---------------------------------------------------------------------------
// ChatPhase Component
// ---------------------------------------------------------------------------

export default function ChatPhase({
  phaseNumber,
  phaseTitle,
  cosName,
  cosAvatarPath,
  founderName,
  onPhaseComplete,
  showCategorySidebar,
  categoryState,
  onCategoryUpdate,
}: ChatPhaseProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasSentGreeting = useRef(false);
  const streamMsgIdRef = useRef<string | null>(null);
  const sessionKeyRef = useRef<string | null>(null);

  // Auto-scroll on new messages (also scroll during streaming)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // SSE subscription for real-time token streaming
  useSSE({
    'consult:stream': (data) => {
      const id = streamMsgIdRef.current;
      if (!id) return;
      const key = sessionKeyRef.current;
      if (!key || data.conversationId === key) {
        setIsStreaming(true);
        setMessages((prev) =>
          prev.map((m) => m.id === id ? { ...m, content: (m.content || '') + (data.delta as string) } : m)
        );
      }
    },
    'consult:done': (data) => {
      const key = sessionKeyRef.current;
      if (!key || data.conversationId === key) {
        streamMsgIdRef.current = null;
        setIsStreaming(false);
      }
    },
  });

  // Send message to API with SSE streaming support
  const sendMessage = useCallback(
    async (text: string, addAsFounderMessage = true) => {
      setError(null);
      if (addAsFounderMessage && text.trim()) {
        setMessages((prev) => [
          ...prev,
          { role: 'founder', content: text, timestamp: new Date().toISOString() },
        ]);
      }

      setIsLoading(true);

      // Create a placeholder message for streaming tokens
      const streamId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      streamMsgIdRef.current = streamId;
      setMessages((prev) => [
        ...prev,
        { id: streamId, role: 'cos', content: '', timestamp: new Date().toISOString() },
      ]);

      try {
        const res = await fetch('/onboarding/api/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, phaseNumber }),
        });

        if (!res.ok) {
          // Remove the streaming placeholder on error
          streamMsgIdRef.current = null;
          setMessages((prev) => prev.filter((m) => m.id !== streamId));
          throw new Error('API error');
        }

        const data = await res.json();

        // Store sessionKey for future SSE event filtering
        if (data.sessionKey) {
          sessionKeyRef.current = data.sessionKey;
        }

        // Stop streaming and finalize: replace placeholder with authoritative response
        streamMsgIdRef.current = null;
        setIsStreaming(false);

        // Build the finalized CoS message with complete response
        const finalMessage: ChatMessage = {
          id: streamId,
          role: 'cos',
          content: data.response,
          timestamp: new Date().toISOString(),
        };

        // Handle Phase 4 inline action buttons (Upload / Build From Scratch)
        if (data.ui_action?.type === 'show_choice' && data.ui_action.data?.options) {
          finalMessage.actions = (
            data.ui_action.data.options as Array<{ label: string; value: string }>
          );
        }

        // Replace the placeholder with the final message
        setMessages((prev) =>
          prev.map((m) => m.id === streamId ? finalMessage : m)
        );

        // Handle phase completion after a brief delay so founder sees final message
        if (data.phase_status === 'phase_complete') {
          setTimeout(() => {
            onPhaseComplete();
          }, 500);
        }

        // Handle UI action for category sidebar
        if (
          data.ui_action?.type === 'show_category_sidebar' &&
          data.ui_action.data?.categories &&
          onCategoryUpdate
        ) {
          const cats = data.ui_action.data.categories as Record<string, boolean>;
          for (const [cat, hasItems] of Object.entries(cats)) {
            onCategoryUpdate(cat, hasItems);
          }
        }
      } catch {
        // Clean up streaming state on error
        streamMsgIdRef.current = null;
        setIsStreaming(false);
        // Remove placeholder if it's still empty
        setMessages((prev) => prev.filter((m) => m.id !== streamId || m.content));
        setError(
          'Message could not be sent. Check your connection and try again.',
        );
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [phaseNumber, onPhaseComplete, onCategoryUpdate],
  );

  // On mount: send greeting to get CoS first message
  useEffect(() => {
    if (hasSentGreeting.current) return;
    hasSentGreeting.current = true;

    // Send a greeting trigger (API requires non-empty message)
    sendMessage('Hello, I am ready to begin.', false);
  }, [sendMessage]);

  // Handle send
  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    setInputValue('');
    sendMessage(trimmed);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle inline action button clicks (Phase 4)
  const handleActionClick = (value: string) => {
    sendMessage(value);
  };

  return (
    <div className="flex flex-1 min-h-0 gap-0 w-full max-w-[960px] mx-auto">
      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Phase heading */}
        <div className="px-4 py-3">
          <h2
            className="text-white"
            style={{ fontSize: '20px', fontWeight: 600, lineHeight: 1.2 }}
          >
            {phaseTitle}
          </h2>
        </div>

        {/* Chat messages */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          role="log"
          aria-live="polite"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.08) transparent',
          }}
        >
          <div className="max-w-[680px] mx-auto space-y-6">
            <AnimatePresence mode="popLayout">
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id || `${msg.role}-${i}-${msg.timestamp}`}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className={msg.role === 'founder' ? 'flex justify-end' : ''}
                >
                  {msg.role === 'cos' ? (
                    <div className="flex gap-3 items-start max-w-[85%]">
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cosAvatarPath}
                          alt={cosName}
                          className="w-6 h-6"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span
                          className="text-amber-400"
                          style={{ fontSize: '11px', fontWeight: 600 }}
                        >
                          {cosName}
                        </span>
                        <div
                          className="rounded-2xl px-4 py-3 prose prose-invert prose-sm max-w-none"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.09)',
                            fontSize: '14px',
                            fontWeight: 400,
                            lineHeight: 1.6,
                            color: 'rgba(255,255,255,0.85)',
                          }}
                          dangerouslySetInnerHTML={{ __html: marked.parse(msg.content || '') as string }}
                        />
                        {/* Inline action buttons (Phase 4) */}
                        {msg.actions && msg.actions.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {msg.actions.map((action) => (
                              <button
                                key={action.value}
                                onClick={() => handleActionClick(action.value)}
                                disabled={isLoading}
                                className="glass-pill px-4 py-2 text-sm text-sky-400 transition-all hover:brightness-125 disabled:opacity-50 cursor-pointer"
                                style={{
                                  background: 'rgba(56,189,248,0.08)',
                                  border: '1px solid rgba(56,189,248,0.2)',
                                  borderRadius: '999px',
                                  fontSize: '14px',
                                  fontWeight: 400,
                                }}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 items-end max-w-[85%]">
                      <span
                        className="text-sky-400"
                        style={{ fontSize: '11px', fontWeight: 600 }}
                      >
                        {founderName || 'You'}
                      </span>
                      <div
                        className="rounded-2xl px-4 py-3"
                        style={{
                          background: 'rgba(56,189,248,0.08)',
                          border: '1px solid rgba(56,189,248,0.15)',
                          fontSize: '14px',
                          fontWeight: 400,
                          lineHeight: 1.5,
                          color: 'rgba(255,255,255,0.85)',
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator — only shows before streaming starts */}
            <AnimatePresence>
              {isLoading && !isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex gap-3 items-start"
                >
                  <div
                    className="w-8 h-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cosAvatarPath}
                      alt={cosName}
                      className="w-6 h-6"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-amber-400"
                      style={{ fontSize: '11px', fontWeight: 600 }}
                    >
                      {cosName}
                    </span>
                    <div
                      className="px-4 py-3 rounded-2xl flex items-center gap-1.5"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.09)',
                      }}
                    >
                      {[0, 1, 2].map((dotIdx) => (
                        <motion.span
                          key={dotIdx}
                          className="w-1.5 h-1.5 rounded-full bg-amber-400/60"
                          animate={{
                            opacity: [0.3, 1, 0.3],
                            scale: [0.85, 1.15, 0.85],
                          }}
                          transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: dotIdx * 0.18,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Chat input */}
        <div className="shrink-0 px-4 pb-4 pt-2">
          <div className="max-w-[680px] mx-auto">
            <div
              className="glass-deep flex items-end gap-2 rounded-2xl px-4 py-3 transition-all focus-within:shadow-[0_0_0_1px_rgba(56,189,248,0.4),0_0_16px_rgba(56,189,248,0.08)]"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
            >
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                rows={1}
                placeholder="Type a message..."
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none resize-none max-h-32 disabled:opacity-50"
                style={{
                  fontSize: '14px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(255,255,255,0.08) transparent',
                }}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                aria-label="Send message"
                className="p-2 rounded-xl transition-all disabled:opacity-30 cursor-pointer"
                style={{
                  background:
                    inputValue.trim() && !isLoading
                      ? 'rgba(56,189,248,0.85)'
                      : 'rgba(255,255,255,0.06)',
                }}
              >
                <ArrowUp
                  className="w-4 h-4"
                  style={{
                    color:
                      inputValue.trim() && !isLoading ? '#0a0f1a' : '#64748b',
                  }}
                />
              </motion.button>
            </div>

            {/* Error message */}
            {error && (
              <p
                className="mt-2 text-rose-500"
                style={{ fontSize: '11px', fontWeight: 400 }}
              >
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Category sidebar for Phase 5 */}
      {showCategorySidebar && categoryState && (
        <div className="shrink-0" style={{ width: '240px' }}>
          <CategorySidebar
            categories={categoryState}
          />
        </div>
      )}
    </div>
  );
}
