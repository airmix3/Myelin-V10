'use client';

import { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';

interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  ts: string;
  agentId?: string;
  turnType?: string;
  planMarkdown?: string;
}

interface WorkspaceChatPanelProps {
  deliverableId: string;
  taskId: string;
  currentActorId: string | null;
  initialMessages: Array<Record<string, unknown>>;
  transitionCounter: number;
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

function findDividerIndex(messages: ChatMessage[]): number {
  // Place divider after the last planning message (turnType: 'plan_ready')
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].turnType === 'plan_ready') return i + 1;
  }
  // Fallback: no divider
  return -1;
}

function getUniqueParticipants(messages: ChatMessage[]): Array<{ id: string; letter: string; color: string }> {
  const seen = new Set<string>();
  const participants: Array<{ id: string; letter: string; color: string }> = [];

  // Always include CEO
  participants.push({ id: 'ceo', letter: 'O', color: 'var(--bg-3)' });
  seen.add('ceo');

  for (const msg of messages) {
    const id = msg.role === 'user' ? 'ceo' : (msg.agentId || 'unknown');
    if (!seen.has(id) && id !== 'unknown') {
      seen.add(id);
      participants.push({
        id,
        letter: getAvatarLetter(id),
        color: getAvatarColor(id),
      });
    }
  }
  return participants;
}

export default function WorkspaceChatPanel({
  deliverableId,
  taskId,
  currentActorId,
  initialMessages,
  transitionCounter,
}: WorkspaceChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages as ChatMessage[]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Re-fetch messages on task:transition SSE events (D-07 dual signal)
  useEffect(() => {
    if (transitionCounter === 0) return; // skip initial render
    const refetch = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/chat`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages ?? []);
        }
      } catch { /* ignore */ }
    };
    refetch();
  }, [transitionCounter, taskId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed, ts: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      const res = await fetch(`/api/deliverables/${deliverableId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      if (data.response) {
        setMessages(prev => [...prev, data.response as ChatMessage]);
      }
    } catch { /* show inline error */ }
    finally { setIsLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const participants = getUniqueParticipants(messages);
  const dividerIndex = findDividerIndex(messages);

  // Agent greeting for empty workspace chat
  const agentName = currentActorId || 'the agent';
  const greeting = messages.length === 0
    ? `I'm ${agentName}, ready to assist. The task is being executed. Ask me anything about progress.`
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Participants */}
      <div className="participants">
        {participants.map(p => (
          <div
            key={p.id}
            className="avatar"
            style={{ backgroundColor: p.color }}
            title={p.id}
          >
            {p.letter}
          </div>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {greeting && (
          <div className="msg agent">
            <div
              className="avatar"
              style={{ backgroundColor: getAvatarColor(currentActorId || undefined) }}
            >
              {getAvatarLetter(currentActorId || undefined)}
            </div>
            <div>
              <div className="bubble ws-bubble">{greeting}</div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {/* Divider between planning and execution */}
            {dividerIndex === i && dividerIndex > 0 && (
              <div className="chat-divider">--- plan approved --- task executing ---</div>
            )}

            {/* System messages: centered, amber, no avatar */}
            {msg.role === 'system' ? (
              <div style={{
                textAlign: 'center',
                color: 'var(--amber)',
                fontSize: '10px',
                padding: '6px 0',
              }}>
                {msg.content}
              </div>
            ) : (
              <div className={`msg ${msg.role === 'user' ? 'user' : 'agent'}`}>
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
                    className="bubble ws-bubble"
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
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="msg agent">
            <div className="avatar" style={{ backgroundColor: '#666' }}>...</div>
            <div className="bubble ws-bubble" style={{ opacity: 0.6 }}>Thinking...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder="Message the agent..."
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
