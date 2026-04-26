'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, Mic, MessageSquare, Zap, FileText, Search } from 'lucide-react';

export type ChatMode = 'Chat' | 'Act' | 'Brief' | 'Investigate';

export default function ChatInput({
  onSend,
  disabled,
  placeholder,
  onModeChange,
  workflowMode = 'consultation',
  onNewTask,
  newTaskDisabled,
}: {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onModeChange?: (mode: ChatMode) => void;
  workflowMode?: 'consultation' | 'task';
  onNewTask?: () => void;
  newTaskDisabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const [activeMode, setActiveMode] = useState<ChatMode>('Chat');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const modeIcons: Record<ChatMode, React.ReactNode> = {
    Chat: <MessageSquare className="w-3.5 h-3.5" />,
    Act: <Zap className="w-3.5 h-3.5" />,
    Brief: <FileText className="w-3.5 h-3.5" />,
    Investigate: <Search className="w-3.5 h-3.5" />,
  };

  const modePlaceholders: Record<ChatMode, string> = {
    Chat: 'Message Tamir...',
    Act: 'Tell Tamir what to do...',
    Brief: 'Ask for a briefing...',
    Investigate: 'What should I look into?',
  };

  return (
    <div className="shrink-0 px-6 pb-5 pt-2">
      <div className="max-w-3xl mx-auto">
        {/* Action mode tabs — above input, matching V2 mock */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-1">
            {(['Chat', 'Act', 'Brief', 'Investigate'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => { setActiveMode(mode); onModeChange?.(mode); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                  activeMode === mode
                    ? 'text-amber-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                style={activeMode === mode ? { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' } : { background: 'transparent', border: '1px solid transparent' }}
              >
                {modeIcons[mode]}
                {mode}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{
                background: workflowMode === 'consultation' ? 'rgba(245,158,11,0.10)' : 'rgba(56,189,248,0.12)',
                border: workflowMode === 'consultation'
                  ? '1px solid rgba(245,158,11,0.22)'
                  : '1px solid rgba(56,189,248,0.24)',
                color: workflowMode === 'consultation' ? '#fcd34d' : '#7dd3fc',
              }}
            >
              {workflowMode}
            </span>

            {onNewTask && (
              <button
                onClick={onNewTask}
                disabled={newTaskDisabled}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40 cursor-pointer"
                style={{
                  background: 'rgba(56,189,248,0.12)',
                  border: '1px solid rgba(56,189,248,0.22)',
                  color: '#7dd3fc',
                }}
              >
                New Task
              </button>
            )}
          </div>
        </div>

        <div
          className="flex items-end gap-2 rounded-2xl px-4 py-3 transition-all focus-within:shadow-[0_0_0_1px_rgba(245,158,11,0.4),0_0_16px_rgba(245,158,11,0.08)]"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            placeholder={placeholder ?? modePlaceholders[activeMode]}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none resize-none max-h-32 disabled:opacity-50"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
          />
          <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
          <button className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg">
            <Mic className="w-4 h-4" />
          </button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="p-2 rounded-xl transition-all disabled:opacity-30 cursor-pointer"
            style={{
              background: value.trim() && !disabled
                ? 'rgba(245,158,11,0.85)'
                : 'rgba(255,255,255,0.06)',
            }}
          >
            <Send className="w-4 h-4" style={{ color: value.trim() && !disabled ? '#0a0f1a' : '#64748b' }} />
          </motion.button>
          </div>
        </div>

        {/* Context line — matching V2 mock */}
        <div className="text-[11px] text-slate-600 mt-2 text-center">
          Tamir has context on 9 missions, 4 escalations, 12 vault entries
        </div>
      </div>
    </div>
  );
}
