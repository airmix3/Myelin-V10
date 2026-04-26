/**
 * POST /onboarding/api/persona — Select CoS persona.
 *
 * Accepts a persona selection and optional custom CoS name,
 * updates onboarding state with the chosen persona.
 */
import { NextRequest, NextResponse } from 'next/server';
import { PERSONAS } from '@/lib/onboarding/persona';
import { readOnboardingState, writeOnboardingState } from '@/lib/onboarding/state';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { personaId, cosName } = body as {
    personaId: 'direct' | 'warm' | 'balanced';
    cosName?: string;
  };

  if (!personaId) {
    return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
  }

  // Look up persona from definitions
  const persona = PERSONAS.find((p) => p.id === personaId);
  if (!persona) {
    return NextResponse.json(
      { error: `Unknown persona: ${personaId}` },
      { status: 400 },
    );
  }

  // Read and update onboarding state
  const state = readOnboardingState();
  if (!state) {
    return NextResponse.json(
      { error: 'Onboarding state not initialized' },
      { status: 400 },
    );
  }

  state.cosPersona = {
    id: personaId,
    name: cosName || persona.name,
    avatarPath: persona.avatarPath,
  };

  // Mark Phase 1 as in_progress so resolveScreen knows onboarding has begun
  if (state.phases[1]?.status === 'not_started') {
    state.phases[1] = {
      ...state.phases[1],
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    };
  }

  await writeOnboardingState(state);

  return NextResponse.json({
    success: true,
    persona: state.cosPersona,
  });
}
