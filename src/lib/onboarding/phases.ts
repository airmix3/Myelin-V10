/**
 * Onboarding phase definitions — the 9-phase onboarding sequence.
 *
 * Each phase has a number, name, description, and screen type that
 * determines how the UI renders it.
 */

import type { OnboardingState } from './state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingPhaseInfo {
  number: number;
  name: string;
  description: string;
  screenType: 'welcome' | 'persona' | 'quiz' | 'chat' | 'org_builder' | 'demo_task' | 'file_ingestion' | 'graduation';
}

// ---------------------------------------------------------------------------
// Phase Definitions
// ---------------------------------------------------------------------------

export const ONBOARDING_PHASES: OnboardingPhaseInfo[] = [
  {
    number: 1,
    name: 'Who Is Your Chief of Staff',
    description: 'Choose your Chief of Staff persona and communication style through a personality quiz.',
    screenType: 'persona',
  },
  {
    number: 2,
    name: 'What Is Your Company',
    description: 'Tell your CoS about your company — vision, mission, market, and stage.',
    screenType: 'chat',
  },
  {
    number: 3,
    name: 'Who Are You',
    description: 'Help your CoS understand you as a founder — background, strengths, working style.',
    screenType: 'chat',
  },
  {
    number: 4,
    name: 'Upload or Create',
    description: 'Choose whether to upload an existing business context or create from scratch.',
    screenType: 'chat',
  },
  {
    number: 5,
    name: 'What You Already Have',
    description: 'Inventory your existing assets — documents, code, designs, data, contacts.',
    screenType: 'chat',
  },
  {
    number: 6,
    name: 'Business Deep-Dive',
    description: 'Deep exploration of your business model, competitive landscape, and strategic priorities.',
    screenType: 'chat',
  },
  {
    number: 7,
    name: 'Build Your Organization',
    description: 'Design your department structure and name your department heads.',
    screenType: 'org_builder',
  },
  {
    number: 8,
    name: 'System Orientation',
    description: 'Walk through a demo task to see how the system operates end-to-end.',
    screenType: 'demo_task',
  },
  {
    number: 9,
    name: 'Bring Your Files',
    description: 'Upload documents, code, and reference materials to seed the Vault and Knowledge base.',
    screenType: 'file_ingestion',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get phase info by phase number. Returns undefined if not found.
 */
export function getPhaseInfo(phaseNumber: number): OnboardingPhaseInfo | undefined {
  return ONBOARDING_PHASES.find(p => p.number === phaseNumber);
}

/**
 * Check if a specific phase is complete in the current onboarding state.
 */
export function isPhaseComplete(state: OnboardingState, phaseNumber: number): boolean {
  return state.phases[phaseNumber]?.status === 'completed';
}
