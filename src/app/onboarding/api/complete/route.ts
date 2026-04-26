/**
 * POST /onboarding/api/complete — Finalize onboarding.
 *
 * Marks onboarding as complete, sets the onboarding_complete cookie,
 * seeds dynamic agents from onboarding state, and initializes the orchestrator.
 *
 * Per D-20: No re-onboarding. This endpoint runs once.
 * Per D-18: Phase 8 can be skipped.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readOnboardingState } from '@/lib/onboarding/state';
import { markOnboardingComplete } from '@/lib/onboarding/detection';
import { seedDynamicAgent } from '@/lib/seed-agents';
import { initOrchestrator } from '@/lib/orchestrator';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'onboarding-complete' });

export async function POST(_request: NextRequest) {
  const state = readOnboardingState();
  if (!state) {
    return NextResponse.json(
      { error: 'Onboarding state not found' },
      { status: 400 },
    );
  }

  // Verify phases are complete (Phase 8 can be skipped per D-18)
  const requiredPhases = [1, 2, 3, 4, 5, 6, 7, 9];
  const incompletePhases = requiredPhases.filter(
    (n) => state.phases[n]?.status !== 'completed',
  );

  if (incompletePhases.length > 0) {
    return NextResponse.json(
      {
        error: `Incomplete phases: ${incompletePhases.join(', ')}`,
        incompletePhases,
      },
      { status: 400 },
    );
  }

  try {
    // Seed dynamic agents from onboarding state
    if (state.departments && state.departments.length > 0) {
      for (const dept of state.departments) {
        await seedDynamicAgent({
          agentId: dept.agentId,
          name: dept.headName,
          department: dept.id,
          budgetLimit: 25.0,
          role: 'executive',
        });
        log.info({ agentId: dept.agentId, department: dept.id }, 'Seeded dynamic department agent');
      }
    }

    // Initialize orchestrator to register all agents (including newly created ones)
    await initOrchestrator();
    log.info('Orchestrator initialized with all agents after onboarding');

    // Mark onboarding as complete (sets status to 'completed' in state.json)
    await markOnboardingComplete();

    // Set cookie and return
    const response = NextResponse.json({
      success: true,
      redirectTo: '/',
    });

    response.cookies.set('onboarding_complete', 'true', {
      path: '/',
      httpOnly: false,
      maxAge: 365 * 24 * 60 * 60,
    });

    log.info('Onboarding completed successfully');
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, 'Onboarding completion failed');
    return NextResponse.json(
      { error: `Completion failed: ${msg}` },
      { status: 500 },
    );
  }
}
