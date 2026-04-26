'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { PERSONAS } from '@/lib/onboarding/persona';

interface PersonaSelectorProps {
  onSelect: (personaId: string) => void;
}

export default function PersonaSelector({ onSelect }: PersonaSelectorProps) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleSelect(personaId: string) {
    setSelected(personaId);
    onSelect(personaId);
  }

  return (
    <div className="flex flex-col items-center w-full max-w-[640px] mx-auto px-4">
      <h2
        className="text-white mb-2 text-center"
        style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}
      >
        Who Should Run Your Company?
      </h2>

      <p
        className="text-slate-400 mb-8 text-center"
        style={{ fontSize: 14, fontWeight: 400 }}
      >
        Choose your Chief of Staff
      </p>

      <div
        role="radiogroup"
        aria-label="Chief of Staff persona selection"
        className="flex flex-wrap justify-center gap-4"
      >
        {PERSONAS.map((persona) => {
          const isSelected = selected === persona.id;

          return (
            <motion.button
              key={persona.id}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${persona.name} - ${persona.tagline}`}
              onClick={() => handleSelect(persona.id)}
              className="glass-card rounded-xl cursor-pointer flex flex-col items-center text-center"
              style={{
                width: 180,
                padding: 24,
                outline: 'none',
              }}
              animate={{
                scale: isSelected ? 1.02 : 1,
                boxShadow: isSelected
                  ? '0 0 0 2px #38bdf8, 0 4px 16px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25)'
                  : '0 4px 16px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25)',
              }}
              transition={{ duration: 0.15, type: 'spring', stiffness: 300, damping: 25 }}
            >
              <img
                src={persona.avatarPath}
                alt={`${persona.name} avatar`}
                width={80}
                height={80}
                className="mb-3 rounded-full"
              />

              <span
                className="text-white block mb-1"
                style={{ fontSize: 14, fontWeight: 400 }}
              >
                {persona.name}
              </span>

              <span
                className="text-slate-400 block"
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                {persona.tagline}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
