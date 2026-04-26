/**
 * POST /onboarding/api/message — Send message in onboarding conversation.
 *
 * Uses warm session pattern for multi-turn onboarding chat.
 * Structured output with ONBOARDING_PHASE_SCHEMA classifies each turn.
 * Handles phase advancement when phase_status === 'phase_complete'.
 *
 * Per D-05: Multi-session via SDK session_id resume + state.json.
 * Per D-03: Chat-only with buttons and structured UI elements.
 */
import { NextRequest, NextResponse } from 'next/server';
import { warmSessions } from '@/lib/warm-session';
import { readOnboardingState, writeOnboardingState, advanceOnboardingPhase } from '@/lib/onboarding/state';
import { getPhaseInfo, ONBOARDING_PHASES } from '@/lib/onboarding/phases';
import { ONBOARDING_PHASE_SCHEMA } from '@/lib/onboarding/schemas';
import { loadSoul } from '@/lib/onboarding/soul-generator';
import { writeFileSync, appendFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { dataPath } from '@/lib/paths';
import { generateId } from '@/lib/id';
import type { ConsultationTurnResult } from '@/a2a/types';
import { triggerMemoryReview } from '@/lib/memory-review';

export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the onboarding soul extension that is appended to the CoS soul template.
 * Provides phase-specific guidance for the conversation.
 */
function buildOnboardingSoulExtension(phaseNumber: number): string {
  const phase = getPhaseInfo(phaseNumber);
  if (!phase) return '';

  const phaseGuidance: Record<number, string> = {
    1: 'Help the founder choose their CoS persona. Present the persona options and run the personality quiz. Use show_persona_grid and show_quiz UI actions.',
    2: 'Extract company information: name, identity, target customer, stage, domain. Use generate_company_dna tool when you have enough information.',
    3: 'Learn about the founder: background, strengths, working style, preferences. Build the founder profile for USER.md.',
    4: 'Ask the founder: do they have existing business documents, code, pitch decks, or data they want to bring in later? Or are they starting completely fresh? This is just a quick decision — do NOT ask them to upload anything now. Files come later in Phase 9. Just capture whether they have stuff to bring or not, and what kind (docs, code, designs, data, etc.).',
    5: 'Inventory existing assets: documents, code, designs, data, contacts. Categorize what they have for later ingestion in Phase 9.',
    6: 'Deep-dive into business model, competitive landscape, strategic priorities. Use enrichCompanyDna to add detail to the DNA.',
    7: 'Guide department structure creation. Help name department heads and define their personalities. Use generate_soul tool for each department head. Trigger show_org_builder UI action.',
    8: 'Walk through a demo task to orient the founder. Suggest 2-3 task options based on earlier context. Founder can skip this phase.',
    9: 'Guide file upload and ingestion. Walk through categories from Phase 5 inventory. Use ingest_document tool for each file. Trigger show_upload and show_category_sidebar UI actions.',
  };

  return `
---
## Onboarding Mode

You are guiding a new founder through company onboarding. Current phase: ${phaseNumber} - ${phase.name}.

### Phase ${phaseNumber}: ${phase.name}
${phase.description}

${phaseGuidance[phaseNumber] || ''}

### Conversation Style
- **ONE question at a time.** Never ask multiple questions in one message. Ask one thing, wait for the answer, then ask the next.
- Talk like a smart friend at a coffee shop, not a form or a survey. No numbered lists of questions.
- Keep messages short — 2-3 sentences max. Be warm, curious, direct.
- React to what they said before asking the next thing. Show you're listening.
- Use markdown naturally (bold for emphasis, not headers/bullets for structure in casual chat).

### Rules
- Use tools (generate_company_dna, generate_soul, ingest_document) to write artifacts as you gather information
- The "response" field is your SPOKEN reply to the founder -- write it as natural conversation, exactly what they see in chat
- The "phase_status" field is a SEPARATE internal classification -- never leak classification logic into the response
- Never mention internal system details (state.json, MCP tools, phases, classification, etc.)
- Address the founder by name once you know it
`;
}

/**
 * Ensure conversation JSONL file exists and return its path.
 */
function ensureConversationFile(state: { conversationFile?: string; sessionId?: string }): string {
  const filePath = state.conversationFile || dataPath('onboarding', 'conversation.jsonl');
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(filePath)) {
    writeFileSync(filePath, '', 'utf-8');
  }
  return filePath;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message, phaseNumber, type } = body as { message?: string; phaseNumber?: number; type?: string };

  // Handle phase advancement signal (no chat message needed)
  if (type === 'phase_complete' && phaseNumber) {
    await advanceOnboardingPhase(phaseNumber);

    // When Phase 7 (org builder) completes, seed agents + init orchestrator
    // so Phase 8 (demo task) can use the real Tamir routing pipeline
    if (phaseNumber === 7) {
      try {
        const { seedAgents } = await import('@/lib/seed-agents');
        await seedAgents();
        const { initOrchestrator } = await import('@/lib/orchestrator');
        await initOrchestrator();
      } catch (err) {
        console.warn('[onboarding] Failed to seed agents for Phase 8 demo:', err);
      }
    }

    const updatedState = readOnboardingState();
    return NextResponse.json({ success: true, state: updatedState });
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  // Read onboarding state
  const state = readOnboardingState();
  if (!state) {
    return NextResponse.json({ error: 'Onboarding state not initialized' }, { status: 400 });
  }

  const currentPhase = phaseNumber || state.currentPhase;
  const phaseInfo = getPhaseInfo(currentPhase);
  if (!phaseInfo) {
    return NextResponse.json({ error: `Invalid phase: ${currentPhase}` }, { status: 400 });
  }

  // Ensure conversation file
  const convFile = ensureConversationFile(state);
  if (!state.conversationFile) {
    state.conversationFile = convFile;
    await writeOnboardingState(state);
  }

  // Session key includes phase number — each phase gets a fresh session with
  // the correct soul extension. When phase changes, old session is abandoned.
  const sessionKey = `onboarding-phase${currentPhase}-${state.sessionId || 'default'}`;

  // Append user message to JSONL
  appendFileSync(convFile, JSON.stringify({
    role: 'user',
    content: message,
    phase: currentPhase,
    ts: new Date().toISOString(),
  }) + '\n', 'utf-8');

  let result: ConsultationTurnResult;

  try {
    const existingSession = warmSessions.getSession(sessionKey);

    if (existingSession) {
      // Push follow-up message to existing warm session
      result = await warmSessions.pushMessage(sessionKey, message);
    } else {
      // Create new warm session for onboarding
      const cosSoul = loadSoul('cos') || loadSoul('tamir');
      const onboardingExtension = buildOnboardingSoulExtension(currentPhase);
      const soulMd = cosSoul + onboardingExtension;

      // Build context for the initial prompt
      const contextParts: string[] = [];
      if (state.founderName) contextParts.push(`Founder name: ${state.founderName}`);
      if (state.companyName) contextParts.push(`Company: ${state.companyName}`);
      if (state.cosPersona) contextParts.push(`Your persona: ${state.cosPersona.name} (${state.cosPersona.id})`);
      contextParts.push(`Current onboarding phase: ${currentPhase} - ${phaseInfo.name}`);
      contextParts.push(`Phase description: ${phaseInfo.description}`);

      // Load conversation history from JSONL so the agent has context from prior turns
      let conversationHistory = '';
      try {
        const raw = readFileSync(convFile, 'utf-8').trim();
        if (raw) {
          const lines = raw.split('\n').filter(Boolean).slice(-20);
          conversationHistory = lines.map((line: string) => {
            try {
              const entry = JSON.parse(line) as { role: string; content?: string; phase?: number };
              const speaker = entry.role === 'user' ? 'Founder' : 'CoS';
              return `${speaker} (phase ${entry.phase || '?'}): ${(entry.content || '').substring(0, 500)}`;
            } catch { return ''; }
          }).filter(Boolean).join('\n');
        }
      } catch { /* no history yet */ }

      const initialPrompt = [
        'You are the Chief of Staff guiding a founder through company onboarding.',
        '',
        '## Context',
        ...contextParts,
        '',
        ...(conversationHistory ? [
          '## Conversation History (from previous session)',
          'The founder has already been through earlier phases. Here is the conversation so far:',
          conversationHistory,
          '',
          'IMPORTANT: Do NOT repeat questions already answered. Continue from where you left off.',
          '',
        ] : []),
        '## Instructions',
        'Respond to the founder naturally. Use the structured output schema to classify the turn.',
      ].join('\n');

      const cosDeskDir = dataPath('departments', 'cos');
      mkdirSync(cosDeskDir, { recursive: true });

      const tmpDelivDir = dataPath('tmp', `onboarding-${Date.now()}`);
      mkdirSync(tmpDelivDir, { recursive: true });
      const tmpManifestPath = join(tmpDelivDir, 'manifest.json');
      writeFileSync(tmpManifestPath, '{}', 'utf-8');

      result = await warmSessions.createSession(sessionKey, {
        agentId: 'tamir', // Use tamir (CoS) agent ID
        department: 'cos',
        soulMd,
        deskDir: cosDeskDir,
        delivDir: tmpDelivDir,
        manifestPath: tmpManifestPath,
        outputFormat: ONBOARDING_PHASE_SCHEMA,
        maxBudgetUsd: 2,
        sessionId: state.sessionId,
        initialPrompt,
        initialMessage: message,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[onboarding/message] warm session failed:', msg);
    return NextResponse.json(
      { error: `Onboarding conversation failed: ${msg}` },
      { status: 500 },
    );
  }

  if (!result?.response) {
    return NextResponse.json(
      { error: 'CoS could not respond. Try rephrasing.' },
      { status: 500 },
    );
  }

  // Cast the result to include onboarding-specific fields
  const onboardingResult = result as ConsultationTurnResult & {
    phase_status?: string;
    artifacts_generated?: string[];
    ui_action?: { type: string; data?: Record<string, unknown> };
  };

  // Append agent response to JSONL
  appendFileSync(convFile, JSON.stringify({
    role: 'agent',
    agentId: 'cos',
    content: onboardingResult.response,
    phase: currentPhase,
    phase_status: onboardingResult.phase_status,
    artifacts_generated: onboardingResult.artifacts_generated,
    ui_action: onboardingResult.ui_action,
    ts: new Date().toISOString(),
  }) + '\n', 'utf-8');

  // Extract and persist founder/company info from artifacts when detected
  const artifacts = onboardingResult.artifacts_generated || [];
  let stateChanged = false;
  for (const artifact of artifacts) {
    const lower = artifact.toLowerCase();
    if (lower.includes('founder_name:') || lower.includes('founder name:')) {
      const name = artifact.split(':').slice(1).join(':').trim();
      if (name && !state.founderName) { state.founderName = name; stateChanged = true; }
    }
    if (lower.includes('company_name:') || lower.includes('company name:') || lower.includes('company:')) {
      const name = artifact.split(':').slice(1).join(':').trim();
      if (name && !state.companyName) { state.companyName = name; stateChanged = true; }
    }
  }
  if (stateChanged) {
    await writeOnboardingState(state);
  }

  // Handle phase_status === 'phase_complete'
  let updatedState = state;
  if (onboardingResult.phase_status === 'phase_complete') {
    // Trigger memory review so onboarding insights are persisted
    try {
      triggerMemoryReview({ taskId: sessionKey, chatFilePath: convFile });
    } catch (memErr) {
      console.warn('[onboarding/message] Memory review trigger failed:', memErr);
    }

    await advanceOnboardingPhase(currentPhase);
    updatedState = readOnboardingState() || state;
  }

  return NextResponse.json({
    sessionKey,
    response: onboardingResult.response,
    phase_status: onboardingResult.phase_status || 'continue',
    artifacts_generated: onboardingResult.artifacts_generated || [],
    ui_action: onboardingResult.ui_action || null,
    state: updatedState,
  });
}
