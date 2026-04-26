'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { quizQuestions } from '@/lib/onboarding/persona';

interface PersonalityQuizProps {
  cosName: string;
  onComplete: (answers: Record<string, string>) => void;
}

export default function PersonalityQuiz({ cosName, onComplete }: PersonalityQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const question = quizQuestions[currentIndex];
  const totalQuestions = quizQuestions.length;
  const isLast = currentIndex === totalQuestions - 1;
  const isFirst = currentIndex === 0;

  function handleOptionSelect(optionId: string) {
    setAnswers((prev) => ({ ...prev, [question.id]: optionId }));
  }

  function handleNext() {
    if (!answers[question.id]) return;

    if (isLast) {
      onComplete(answers);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }

  function handleBack() {
    if (!isFirst) {
      setCurrentIndex((prev) => prev - 1);
    }
  }

  const selectedOption = answers[question.id] ?? null;

  return (
    <div className="flex flex-col items-center w-full max-w-[520px] mx-auto px-4">
      <h2
        className="text-white mb-2 text-center"
        style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}
      >
        How Should {cosName} Work With You?
      </h2>

      <p
        className="text-slate-400 mb-6 text-center"
        style={{ fontSize: 11, fontWeight: 600 }}
      >
        Question {currentIndex + 1} of {totalQuestions}
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full"
        >
          <div className="glass-card rounded-xl p-6 mb-4">
            <p
              className="text-white"
              style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.5 }}
            >
              {question.scenario}
            </p>
          </div>

          <div className="flex flex-col gap-2" role="radiogroup" aria-label={question.scenario}>
            {question.options.map((option) => {
              const isSelected = selectedOption === option.id;

              return (
                <button
                  key={option.id}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleOptionSelect(option.id)}
                  className="glass-card rounded-lg text-left cursor-pointer transition-colors w-full"
                  style={{
                    padding: '12px 16px',
                    fontSize: 14,
                    fontWeight: 400,
                    lineHeight: 1.5,
                    color: isSelected ? '#e2e8f0' : '#94a3b8',
                    borderLeft: isSelected ? '3px solid #38bdf8' : '3px solid transparent',
                    backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.1)' : undefined,
                    outline: 'none',
                  }}
                >
                  {option.text}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between w-full mt-6">
        <button
          onClick={handleBack}
          disabled={isFirst}
          className="rounded-lg cursor-pointer transition-colors"
          style={{
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 400,
            color: isFirst ? 'rgba(148, 163, 184, 0.4)' : '#94a3b8',
            background: 'transparent',
            border: 'none',
          }}
        >
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={!selectedOption}
          className="rounded-lg text-white cursor-pointer transition-colors"
          style={{
            backgroundColor: selectedOption ? '#38bdf8' : 'rgba(56, 189, 248, 0.3)',
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 8,
            paddingBottom: 8,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {isLast ? 'Continue to Setup' : 'Next'}
        </button>
      </div>
    </div>
  );
}
