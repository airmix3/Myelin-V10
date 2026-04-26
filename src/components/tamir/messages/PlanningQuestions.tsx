'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Send } from 'lucide-react';

export interface PlanningQuestionsProps {
  questions: string[];
  onAnswer?: (answer: string) => void;
}

export default function PlanningQuestions({ questions, onAnswer }: PlanningQuestionsProps) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    const trimmed = answer.trim();
    if (!trimmed || !onAnswer) return;
    onAnswer(trimmed);
    setAnswer('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-1.5 items-start"
    >
      <div className="glass-card rounded-2xl p-4 max-w-[85%] w-full space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: '#38bdf8' }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
            Planning Mode
          </span>
        </div>

        {/* Numbered questions */}
        <div className="space-y-2">
          {questions.map((question, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.25 }}
              className="flex items-start gap-2"
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                style={{
                  background: 'rgba(56,189,248,0.12)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56,189,248,0.2)',
                }}
              >
                {index + 1}
              </span>
              <span className="text-[12px] text-slate-300 leading-relaxed">
                {question}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Answer input */}
        {onAnswer && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer..."
              className="flex-1 px-3 py-2 rounded-lg text-[12px] text-white placeholder-slate-600 outline-none bg-transparent"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!answer.trim()}
              className="p-2 rounded-lg transition-all disabled:opacity-30 cursor-pointer"
              style={{
                background: answer.trim()
                  ? 'rgba(56,189,248,0.2)'
                  : 'rgba(255,255,255,0.04)',
              }}
            >
              <Send
                size={14}
                className={answer.trim() ? 'text-sky-400' : 'text-slate-600'}
              />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
