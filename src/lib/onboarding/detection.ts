/**
 * Onboarding detection — determines if onboarding is active for this instance.
 *
 * Detection logic (per D-07):
 * - If company-dna.md is missing, onboarding is active (fresh install).
 * - If state.json exists and status is not 'completed', onboarding is active.
 * - Otherwise, onboarding is NOT active (completed or existing installation).
 */

import { existsSync } from 'fs';
import { dataPath } from '../paths';
import { readOnboardingState, writeOnboardingState } from './state';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_DNA_PATH = dataPath('vault', 'company-dna.md');

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Check if onboarding is currently active.
 *
 * Returns true when:
 * 1. company-dna.md does not exist (fresh install), OR
 * 2. state.json exists and status is not 'completed'
 *
 * Returns false when:
 * 1. company-dna.md exists AND (no state.json OR state.json status is 'completed')
 */
export function isOnboardingActive(): boolean {
  const hasDna = existsSync(COMPANY_DNA_PATH);
  const state = readOnboardingState();

  // Fresh install — no DNA, no state
  if (!hasDna && !state) {
    return true;
  }

  // State exists and not completed — onboarding in progress
  if (state && state.status !== 'completed') {
    return true;
  }

  // DNA exists — existing installation, onboarding not needed
  // State is completed — onboarding finished
  return false;
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

/**
 * Mark onboarding as complete. Called after Phase 9 finishes (or skip in graduation).
 * Sets state status to 'completed' and persists.
 */
export async function markOnboardingComplete(): Promise<void> {
  const state = readOnboardingState();
  if (!state) {
    // No state to complete — silently return
    return;
  }

  state.status = 'completed';
  await writeOnboardingState(state);
}
