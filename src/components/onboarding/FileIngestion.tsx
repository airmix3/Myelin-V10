'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, ArrowUp } from 'lucide-react';
import CategorySidebar from './CategorySidebar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  destination: 'vault' | 'knowledge' | 'sharedlib' | 'asset';
  category: string;
  error?: string;
}

interface ChatMessage {
  role: 'cos' | 'founder';
  content: string;
  timestamp: string;
}

export interface FileIngestionProps {
  categories: Record<string, { hasItems: boolean; items: string[] }>;
  departments: Array<{ id: string; name: string }>;
  cosName: string;
  cosAvatarPath: string;
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Destination badge colors per UI-SPEC
// ---------------------------------------------------------------------------

const DESTINATION_COLORS: Record<string, { bg: string; text: string }> = {
  vault: { bg: 'rgba(56,189,248,0.1)', text: '#38bdf8' },
  knowledge: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b' },
  sharedlib: { bg: 'rgba(16,185,129,0.1)', text: '#10b981' },
  asset: { bg: 'rgba(168,85,247,0.1)', text: '#a855f7' },
};

const DESTINATION_LABELS: Record<string, string> = {
  vault: 'Vault',
  knowledge: 'Knowledge',
  sharedlib: 'SharedLib',
  asset: 'Asset',
};

// Destination cycle order
const DESTINATION_CYCLE: Array<'vault' | 'knowledge' | 'sharedlib' | 'asset'> = [
  'vault',
  'knowledge',
  'sharedlib',
  'asset',
];

// Default destination recommendation based on category
function getDefaultDestination(category: string): 'vault' | 'knowledge' | 'sharedlib' | 'asset' {
  const lower = category.toLowerCase();
  if (lower.includes('brand') || lower.includes('strategy') || lower.includes('document')) return 'vault';
  if (lower.includes('code') || lower.includes('technical') || lower.includes('domain')) return 'knowledge';
  if (lower.includes('customer') || lower.includes('financial') || lower.includes('legal')) return 'sharedlib';
  if (lower.includes('content') || lower.includes('marketing')) return 'asset';
  if (lower.includes('operational')) return 'knowledge';
  return 'vault';
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// FileIngestion Component
// ---------------------------------------------------------------------------

export default function FileIngestion({
  categories,
  departments,
  cosName,
  cosAvatarPath,
  onComplete,
}: FileIngestionProps) {
  const categoryNames = Object.keys(categories);
  const [activeCategory, setActiveCategory] = useState(categoryNames[0] || 'Brand & Identity');
  const [filesByCategory, setFilesByCategory] = useState<Record<string, UploadedFile[]>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasSentGreeting = useRef(false);

  // Build category status for sidebar
  const categoryStatus: Record<string, boolean> = {};
  for (const name of categoryNames) {
    categoryStatus[name] = (filesByCategory[name]?.length ?? 0) > 0;
  }

  // Check if all categories have been reviewed (at least visited / files uploaded for categories with items)
  const allCategoriesReviewed = categoryNames.length > 0;

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length, isChatLoading]);

  // Send greeting on mount
  useEffect(() => {
    if (hasSentGreeting.current) return;
    hasSentGreeting.current = true;

    const greeting: ChatMessage = {
      role: 'cos',
      content: `Let's organize your files. I'll walk you through each category. Select a category on the left, then drag and drop your files into the upload area. I'll help classify them to the right destination.`,
      timestamp: new Date().toISOString(),
    };
    setChatMessages([greeting]);
  }, []);

  // Send category context to CoS on category switch
  const handleCategorySwitch = useCallback(
    async (category: string) => {
      setActiveCategory(category);

      // Get CoS guidance for this category
      setIsChatLoading(true);
      try {
        const res = await fetch('/onboarding/api/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `I'm looking at the "${category}" category for file uploads. What files should go here?`,
            phaseNumber: 9,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.response) {
            setChatMessages((prev) => [
              ...prev,
              {
                role: 'cos',
                content: data.response,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        }
      } catch {
        // Non-critical
      } finally {
        setIsChatLoading(false);
      }
    },
    [],
  );

  // Handle file upload
  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setIsUploading(true);
      const defaultDest = getDefaultDestination(activeCategory);
      const defaultDept = departments[0]?.id || 'global';

      const newFiles: UploadedFile[] = [];

      for (const file of Array.from(files)) {
        const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const dest = defaultDest;

        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('category', activeCategory);
          formData.append('destination', dest);
          if (['knowledge', 'sharedlib'].includes(dest)) {
            formData.append('department', defaultDept);
          }

          const res = await fetch('/onboarding/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({ error: 'Upload failed' }));
            newFiles.push({
              id: fileId,
              name: file.name,
              size: file.size,
              destination: dest,
              category: activeCategory,
              error: `${file.name} could not be uploaded. ${data.error || 'Unknown error'}. Try again or skip this file.`,
            });
          } else {
            newFiles.push({
              id: fileId,
              name: file.name,
              size: file.size,
              destination: dest,
              category: activeCategory,
            });
          }
        } catch {
          newFiles.push({
            id: fileId,
            name: file.name,
            size: file.size,
            destination: dest,
            category: activeCategory,
            error: `${file.name} could not be uploaded. Network error. Try again or skip this file.`,
          });
        }
      }

      setFilesByCategory((prev) => ({
        ...prev,
        [activeCategory]: [...(prev[activeCategory] || []), ...newFiles],
      }));

      setIsUploading(false);
    },
    [activeCategory, departments],
  );

  // Drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  // File input change
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cycle destination on badge click
  const handleCycleDestination = (fileId: string, category: string) => {
    setFilesByCategory((prev) => {
      const files = prev[category] || [];
      return {
        ...prev,
        [category]: files.map((f) => {
          if (f.id !== fileId) return f;
          const currentIdx = DESTINATION_CYCLE.indexOf(f.destination);
          const nextIdx = (currentIdx + 1) % DESTINATION_CYCLE.length;
          return { ...f, destination: DESTINATION_CYCLE[nextIdx] };
        }),
      };
    });
  };

  // Remove file from list (non-destructive per UI-SPEC)
  const handleRemoveFile = (fileId: string, category: string) => {
    setFilesByCategory((prev) => ({
      ...prev,
      [category]: (prev[category] || []).filter((f) => f.id !== fileId),
    }));
  };

  // Chat send
  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isChatLoading) return;

    setChatInput('');
    setChatMessages((prev) => [
      ...prev,
      { role: 'founder', content: trimmed, timestamp: new Date().toISOString() },
    ]);

    setIsChatLoading(true);
    try {
      const res = await fetch('/onboarding/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, phaseNumber: 9 }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.response) {
          setChatMessages((prev) => [
            ...prev,
            { role: 'cos', content: data.response, timestamp: new Date().toISOString() },
          ]);
        }
      }
    } catch {
      // Non-critical
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  const currentFiles = filesByCategory[activeCategory] || [];

  return (
    <div className="flex flex-1 min-h-0 gap-4 w-full">
      {/* Left sidebar: Category navigation (240px) */}
      <div className="shrink-0" style={{ width: '240px' }}>
        <CategorySidebar
          categories={categoryStatus}
          activeCategory={activeCategory}
          onCategoryClick={handleCategorySwitch}
        />
      </div>

      {/* Center: Upload area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Category heading */}
        <h2
          className="text-white shrink-0 mb-4"
          style={{ fontSize: '20px', fontWeight: 600, lineHeight: 1.2 }}
        >
          {activeCategory}
        </h2>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all"
          style={{
            minHeight: '120px',
            border: isDragging
              ? '2px dashed #38bdf8'
              : '2px dashed rgba(255,255,255,0.2)',
            background: isDragging
              ? 'rgba(56,189,248,0.05)'
              : 'transparent',
            borderRadius: '12px',
          }}
        >
          <Upload
            className="w-8 h-8"
            style={{ color: isDragging ? '#38bdf8' : '#64748b' }}
          />
          <span
            style={{
              fontSize: '14px',
              fontWeight: 400,
              color: '#94a3b8',
            }}
          >
            {isUploading
              ? 'Uploading...'
              : 'Drag files here or click to browse'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Uploaded files list */}
        <div className="flex-1 overflow-y-auto mt-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
          <AnimatePresence mode="popLayout">
            {currentFiles.map((file) => (
              <motion.div
                key={file.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-3 py-2 px-3 rounded-lg mb-1"
                style={{
                  background: file.error
                    ? 'rgba(244,63,94,0.05)'
                    : 'rgba(255,255,255,0.03)',
                  border: file.error
                    ? '1px solid rgba(244,63,94,0.15)'
                    : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Filename + size */}
                <div className="flex-1 min-w-0">
                  <div
                    className="truncate"
                    style={{
                      fontSize: '14px',
                      fontWeight: 400,
                      color: file.error ? '#f43f5e' : 'rgba(255,255,255,0.85)',
                    }}
                  >
                    {file.name}
                  </div>
                  {file.error ? (
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 400,
                        color: '#f43f5e',
                      }}
                    >
                      {file.error}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 400,
                        color: '#94a3b8',
                      }}
                    >
                      {formatSize(file.size)}
                    </div>
                  )}
                </div>

                {/* Destination badge (clickable to cycle) */}
                {!file.error && (
                  <button
                    onClick={() => handleCycleDestination(file.id, activeCategory)}
                    className="shrink-0 px-2.5 py-1 rounded-full cursor-pointer transition-all hover:brightness-125"
                    style={{
                      background: DESTINATION_COLORS[file.destination]?.bg || DESTINATION_COLORS.vault.bg,
                      color: DESTINATION_COLORS[file.destination]?.text || DESTINATION_COLORS.vault.text,
                      fontSize: '11px',
                      fontWeight: 600,
                      border: 'none',
                    }}
                    title="Click to change destination"
                  >
                    {DESTINATION_LABELS[file.destination] || 'Vault'}
                  </button>
                )}

                {/* Remove button */}
                <button
                  onClick={() => handleRemoveFile(file.id, activeCategory)}
                  className="shrink-0 p-1 rounded cursor-pointer transition-all hover:brightness-125"
                  style={{ color: '#64748b' }}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Complete Onboarding button */}
        {allCategoriesReviewed && (
          <div className="shrink-0 pt-4">
            <button
              onClick={onComplete}
              className="w-full py-3 rounded-xl cursor-pointer transition-all hover:brightness-110"
              style={{
                background: '#38bdf8',
                color: '#0a0f1a',
                fontSize: '16px',
                fontWeight: 600,
                border: 'none',
              }}
            >
              Complete Onboarding
            </button>
          </div>
        )}
      </div>

      {/* Right panel: CoS chat (320px) */}
      <div
        className="shrink-0 flex flex-col glass-panel"
        style={{
          width: '320px',
          background: 'rgba(10,18,40,0.52)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
        }}
      >
        {/* Chat header */}
        <div
          className="px-4 py-3 shrink-0"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cosAvatarPath} alt={cosName} className="w-4 h-4" />
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#f59e0b',
              }}
            >
              {cosName}
            </span>
          </div>
        </div>

        {/* Chat messages */}
        <div
          className="flex-1 overflow-y-auto px-3 py-3"
          role="log"
          aria-live="polite"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.08) transparent',
          }}
        >
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={`chat-${i}-${msg.timestamp}`}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={msg.role === 'founder' ? 'flex justify-end' : ''}
                >
                  <div
                    className="rounded-xl px-3 py-2"
                    style={{
                      maxWidth: '90%',
                      background:
                        msg.role === 'cos'
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(56,189,248,0.08)',
                      border:
                        msg.role === 'cos'
                          ? '1px solid rgba(255,255,255,0.09)'
                          : '1px solid rgba(56,189,248,0.15)',
                      fontSize: '13px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                      color: 'rgba(255,255,255,0.85)',
                    }}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            <AnimatePresence>
              {isChatLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-1 px-3 py-2"
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
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Chat input */}
        <div className="shrink-0 px-3 pb-3 pt-1">
          <div
            className="flex items-end gap-2 rounded-xl px-3 py-2"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              disabled={isChatLoading}
              rows={1}
              placeholder="Ask about files..."
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none resize-none max-h-20 disabled:opacity-50"
              style={{ fontSize: '13px' }}
            />
            <button
              onClick={handleChatSend}
              disabled={isChatLoading || !chatInput.trim()}
              aria-label="Send message"
              className="p-1.5 rounded-lg transition-all disabled:opacity-30 cursor-pointer"
              style={{
                background:
                  chatInput.trim() && !isChatLoading
                    ? 'rgba(56,189,248,0.85)'
                    : 'rgba(255,255,255,0.06)',
              }}
            >
              <ArrowUp
                className="w-3.5 h-3.5"
                style={{
                  color:
                    chatInput.trim() && !isChatLoading ? '#0a0f1a' : '#64748b',
                }}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
