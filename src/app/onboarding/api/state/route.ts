/**
 * GET /onboarding/api/state — Current onboarding state + cookie management.
 *
 * CRITICAL: Guards existing installations by checking isOnboardingActive()
 * BEFORE reading or initializing state.json. Without this guard, an existing
 * installation (company-dna.md present, no state.json) would get a new
 * in_progress state and be forced through onboarding.
 */
import { NextResponse } from 'next/server';
import { isOnboardingActive } from '@/lib/onboarding/detection';
import { readOnboardingState, initOnboardingState } from '@/lib/onboarding/state';

export async function GET() {
  // Step 1: Check if onboarding is active BEFORE touching state
  if (!isOnboardingActive()) {
    // Existing installation — company-dna.md present, onboarding already completed or never needed
    const response = NextResponse.json({ active: false, state: null });
    response.cookies.set('onboarding_complete', 'true', {
      path: '/',
      httpOnly: false,
      maxAge: 365 * 24 * 60 * 60,
    });
    return response;
  }

  // Step 2: Onboarding IS active — read state
  let state = readOnboardingState();

  // Step 3: No state yet (fresh install) — initialize
  if (!state) {
    state = await initOnboardingState();
  }

  // Step 4: If completed, set cookie
  if (state.status === 'completed') {
    const response = NextResponse.json({ active: false, state });
    response.cookies.set('onboarding_complete', 'true', {
      path: '/',
      httpOnly: false,
      maxAge: 365 * 24 * 60 * 60,
    });
    return response;
  }

  // Step 5: Return active state — clear stale cookie if present
  const response = NextResponse.json({
    active: true,
    state,
  });
  response.cookies.delete('onboarding_complete');
  return response;
}
