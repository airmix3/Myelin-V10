'use client';

import { useEffect, useState } from 'react';

interface ChatItem {
  id: string;
  title: string;
  state: string;
  department: string;
  updatedAt: string;
  agentId: string | null;
  targetAssetTitle?: string;
  targetAssetMode?: string;
}

interface ConversationItem {
  id: string;
  title: string | null;
  updatedAt: string;
  linkedTaskId: string | null;
}

interface ChatSidebarProps {
  isOpen: boolean;
  activeTaskId: string | null;
  activeConversationId?: string | null;
  onSelectChat: (taskId: string) => void;
  onSelectConversation?: (conversationId: string) => void;
  onNewChat: () => void;
  onClose: () => void;
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

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

const DEPT_COLORS: Record<string, string> = {
  tech: '#6496ff',
  marketing: '#ff64c8',
  operations: '#64c864',
};

export default function ChatSidebar({
  isOpen,
  activeTaskId,
  activeConversationId,
  onSelectChat,
  onSelectConversation,
  onNewChat,
  onClose,
}: ChatSidebarProps) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    // Fetch both tasks and conversations in parallel
    fetch('/api/tamir/chats')
      .then((r) => r.json())
      .then((data) => setChats(data.chats || []))
      .catch(() => {});
    fetch('/api/tamir/conversations')
      .then((r) => r.json())
      .then((data) => setConversations(data.conversations || []))
      .catch(() => {});
  }, [isOpen]);

  const handleSelectChat = (taskId: string) => {
    onSelectChat(taskId);
    onClose();
  };

  const handleSelectConversation = (conversationId: string) => {
    if (onSelectConversation) {
      onSelectConversation(conversationId);
    }
    onClose();
  };

  const handleNewChat = () => {
    onNewChat();
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="chat-sidebar-overlay" onClick={onClose} />
      )}

      {/* Sidebar */}
      <div className={`chat-sidebar ${isOpen ? 'chat-sidebar--open' : ''}`}>
        {/* Header */}
        <div className="chat-sidebar-header">
          <span style={{ fontSize: '14px', fontWeight: 600 }}>History</span>
          <button
            className="chat-sidebar-close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            &times;
          </button>
        </div>

        {/* New Chat button */}
        <button className="chat-sidebar-new" onClick={handleNewChat}>
          <span style={{ fontSize: '16px', marginRight: '8px' }}>+</span>
          New Chat
        </button>

        {/* Chat list */}
        <div className="chat-sidebar-list">
          {/* Conversations section */}
          {conversations.length > 0 && (
            <>
              <div style={{
                padding: '8px 16px 4px',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                color: 'var(--text-dim)',
                letterSpacing: '0.5px',
              }}>
                Conversations
              </div>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`chat-item ${conv.id === activeConversationId ? 'active' : ''}`}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <div className="chat-item-title">
                    {truncate(conv.title || 'New conversation', 40)}
                    {conv.linkedTaskId && (
                      <span className="asset-tag" style={{ fontSize: '9px' }}>linked</span>
                    )}
                  </div>
                  <div className="chat-item-meta">
                    <span className="chat-item-time">{formatRelativeTime(conv.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Tasks section */}
          {chats.length > 0 && (
            <>
              <div style={{
                padding: '12px 16px 4px',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                color: 'var(--text-dim)',
                letterSpacing: '0.5px',
              }}>
                Tasks
              </div>
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`chat-item ${chat.id === activeTaskId ? 'active' : ''}`}
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <div className="chat-item-title">
                    {truncate(chat.title, 40)}
                    {chat.targetAssetTitle && (
                      <span className="asset-tag">{chat.targetAssetTitle}</span>
                    )}
                    {!chat.targetAssetTitle && chat.targetAssetMode === 'new-asset' && (
                      <span className="asset-tag new-asset">New Asset</span>
                    )}
                    {!chat.targetAssetTitle && chat.targetAssetMode === 'standalone' && (
                      <span className="asset-tag standalone">Standalone</span>
                    )}
                  </div>
                  <div className="chat-item-meta">
                    <span
                      className="chat-item-dept"
                      style={{ color: DEPT_COLORS[chat.department] || 'var(--text-dim)' }}
                    >
                      {chat.department}
                    </span>
                    <span className="chat-item-time">{formatRelativeTime(chat.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {conversations.length === 0 && chats.length === 0 && (
            <div style={{ padding: '16px', color: 'var(--text-dim)', fontSize: '12px' }}>
              No conversations yet.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
