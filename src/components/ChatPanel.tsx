'use client';

import { useRef, useEffect, useState } from 'react';
import { marked } from 'marked';

export interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  ts: string;
  agentId?: string;
  turnType?: string;
  planMarkdown?: string;
}

export interface RoutingButton {
  agentId: string;
  label: string;
}

export interface ChatPanelProps {
  messages: ChatMessage[];
  routingButtons: RoutingButton[] | null;
  onSend: (message: string) => void;
  onRouteSelect: (agentId: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

const AVATAR_COLORS: Record<string, string> = {
  tamir: '#e94560',
  cto: '#6496ff',
  cmo: '#ff64c8',
  coo: '#64c864',
};

function getAvatarLetter(agentId?: string): string {
  if (!agentId) return '?';
  if (agentId === 'ceo') return 'O';
  return agentId.charAt(0).toUpperCase();
}

function getAvatarColor(agentId?: string): string {
  if (!agentId) return '#666';
  return AVATAR_COLORS[agentId] || '#666';
}

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ChatPanel({
  messages,
  routingButtons,
  onSend,
  onRouteSelect,
  isLoading,
  placeholder,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`msg ${msg.role === 'user' ? 'user' : 'agent'}`}>
            {msg.role === 'agent' && (
              <div
                className="avatar"
                style={{ backgroundColor: getAvatarColor(msg.agentId) }}
              >
                {getAvatarLetter(msg.agentId)}
              </div>
            )}
            <div>
              <div
                className="bubble"
                dangerouslySetInnerHTML={{
                  __html: msg.role === 'agent'
                    ? (marked.parse(msg.content) as string)
                    : msg.content,
                }}
              />
              <div className="text-dim" style={{ fontSize: '9px', marginTop: '4px' }}>
                {formatRelativeTime(msg.ts)}
              </div>
            </div>
          </div>
        ))}

        {/* Routing buttons */}
        {routingButtons && routingButtons.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', marginBottom: '12px' }}>
            {routingButtons.map((btn) => (
              <button
                key={btn.agentId}
                className="btn"
                onClick={() => onRouteSelect(btn.agentId)}
                disabled={isLoading}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="msg agent">
            <div className="avatar" style={{ backgroundColor: '#666' }}>...</div>
            <div className="bubble" style={{ opacity: 0.6 }}>Thinking...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder={placeholder || 'What would you like to get done?'}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          style={{ minHeight: '44px', maxHeight: '120px', resize: 'none' }}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
