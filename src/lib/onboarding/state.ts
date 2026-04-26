/**
 * Onboarding state management — persistent state for the onboarding flow.
 *
 * State is stored as JSON at data/onboarding/state.json.
 * Uses proper-lockfile for atomic writes (same pattern as memory-store.ts).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import * as lockfile from 'proper-lockfile';
import { dataPath } from '../paths';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingPhaseState {
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt?: string;
  completedAt?: string;
  data?: Record<string, unknown>;
}

export interface CosPersona {
  id: 'direct' | 'warm' | 'balanced';
  name: string;
  avatarPath: string;
}

export interface OnboardingDepartment {
  id: string;           // slugified from founder name
  name: string;         // Founder-given name
  headName: string;     // Founder-given head name
  headPersonality?: string;
  agentId: string;      // Derived from headName
  color?: string;
}

export interface OnboardingState {
  status: 'in_progress' | 'completed';
  currentPhase: number;  // 1-9
  phases: Record<number, OnboardingPhaseState>;
  cosPersona?: CosPersona;
  companyPath?: 'upload' | 'creation';
  assetInventory?: {
    categories: Record<string, {
      hasItems: boolean;
      items: string[];
    }>;
  };
  departments?: OnboardingDepartment[];
  sessionId?: string;
  conversationFile?: string;
  founderName?: string;
  companyName?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ONBOARDING_STATE_PATH = dataPath('onboarding', 'state.json');

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

/**
 * Read the onboarding state from disk.
 * Returns null if the state file does not exist.
 */
export function readOnboardingState(): OnboardingState | null {
  try {
    const raw = readFileSync(ONBOARDING_STATE_PATH, 'utf-8');
    if (!raw.trim()) return null;
    return JSON.parse(raw) as OnboardingState;
  } catch {
    return null;
  }
}

/**
 * Write the onboarding state to disk with proper-lockfile for atomic writes.
 * Creates data/onboarding/ directory if missing.
 */
export async function writeOnboardingState(state: OnboardingState): Promise<void> {
  const dir = dirname(ONBOARDING_STATE_PATH);
  mkdirSync(dir, { recursive: true });

  // Ensure file exists for proper-lockfile
  if (!existsSync(ONBOARDING_STATE_PATH)) {
    writeFileSync(ONBOARDING_STATE_PATH, '', 'utf-8');
  }

  const release = await lockfile.lock(ONBOARDING_STATE_PATH, {
    retries: { retries: 3, minTimeout: 100, maxTimeout: 1000 },
    stale: 10000,
  });

  try {
    writeFileSync(ONBOARDING_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } finally {
    await release();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create the initial onboarding state — all 9 phases as not_started,
 * status in_progress, currentPhase 1. Writes to disk and returns.
 */
export async function initOnboardingState(): Promise<OnboardingState> {
  const phases: Record<number, OnboardingPhaseState> = {};
  for (let i = 1; i <= 9; i++) {
    phases[i] = { status: 'not_started' };
  }

  const state: OnboardingState = {
    status: 'in_progress',
    currentPhase: 1,
    phases,
  };

  await writeOnboardingState(state);
  return state;
}

/**
 * Mark phase N as completed, advance currentPhase to N+1.
 * If N is the last phase (9), currentPhase stays at 9.
 */
export async function advanceOnboardingPhase(phase: number): Promise<void> {
  const state = readOnboardingState();
  if (!state) {
    throw new Error('Cannot advance onboarding phase: state not initialized');
  }

  // Mark phase as completed
  state.phases[phase] = {
    ...state.phases[phase],
    status: 'completed',
    completedAt: new Date().toISOString(),
  };

  // Advance to next phase (cap at 9)
  if (phase < 9) {
    state.currentPhase = phase + 1;
  }

  await writeOnboardingState(state);
}
