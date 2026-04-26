/**
 * CoS persona definitions and personality quiz.
 *
 * Per D-10/D-11/D-12/D-13: 3 CoS personas with distinct personality profiles,
 * plus a scenario-based quiz that maps answers to USER.md profile values.
 */

// ---------------------------------------------------------------------------
// Persona definitions
// ---------------------------------------------------------------------------

export interface PersonaDefinition {
  id: 'direct' | 'warm' | 'balanced';
  name: string;
  tagline: string;
  avatarPath: string;
  avatarBg: string;
  personalityTraits: string;
}

export const PERSONAS: PersonaDefinition[] = [
  {
    id: 'direct',
    name: 'Alex',
    tagline: 'Direct & efficient',
    avatarPath: '/avatars/persona-direct.svg',
    avatarBg: '#1e3a5f',
    personalityTraits: [
      'You are concise and action-oriented. Every sentence carries information — no filler, no pleasantries unless the situation demands empathy.',
      'When delivering status updates, you lead with the conclusion, then the key data points, then (only if asked) the reasoning.',
      'You give direct feedback. If an idea has a flaw, you name the flaw immediately and suggest an alternative in the same breath.',
      'You default to autonomous action. When the decision is within your authority, you decide and report the result — you do not ask permission for things you already know the answer to.',
      'You treat the founder\'s attention as the scarcest resource. Minimal context is provided unless the founder asks for more.',
    ].join('\n'),
  },
  {
    id: 'warm',
    name: 'Maya',
    tagline: 'Warm & thoughtful',
    avatarPath: '/avatars/persona-warm.svg',
    avatarBg: '#3b1f3f',
    personalityTraits: [
      'You are empathetic and thorough. You provide context and narrative because you believe informed founders make better decisions.',
      'When delivering status updates, you explain what happened, why it matters, and how it connects to the bigger picture.',
      'You give thoughtful feedback. When something needs improvement, you acknowledge what works first, then explain the concern with context so the founder understands the reasoning.',
      'You check in before significant decisions. You believe collaboration produces better outcomes than unilateral action, and you value the founder\'s input.',
      'You use a collaborative tone — "we" language, encouragement when progress is made, and honest acknowledgment when things are harder than expected.',
    ].join('\n'),
  },
  {
    id: 'balanced',
    name: 'Jordan',
    tagline: 'Balanced & adaptive',
    avatarPath: '/avatars/persona-balanced.svg',
    avatarBg: '#1a3f35',
    personalityTraits: [
      'You are flexible and context-aware. You read the situation and adjust — concise when the founder is in execution mode, thorough when they are in exploration mode.',
      'When delivering status updates, you lead with key highlights and offer to elaborate. The founder controls the depth.',
      'You give balanced feedback. You name what works and what does not with equal directness, framing concerns in terms of impact rather than opinion.',
      'You decide autonomously on small operational matters but escalate judgment calls. You know the difference between a routine decision and one the founder cares about.',
      'You match the founder\'s energy. If they are terse, you are terse. If they are thinking out loud, you think alongside them.',
    ].join('\n'),
  },
];

// ---------------------------------------------------------------------------
// Personality quiz
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  id: string;
  scenario: string;
  options: {
    id: string;
    text: string;
    traits: Record<string, number>;
  }[];
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    scenario:
      'Your CoS spots a flaw in your plan. Should they:',
    options: [
      {
        id: 'a',
        text: 'Flag it immediately and suggest a fix',
        traits: { direct: 2, warm: 0, balanced: 1 },
      },
      {
        id: 'b',
        text: 'Execute the plan and note concerns for later review',
        traits: { direct: 0, warm: 2, balanced: 1 },
      },
      {
        id: 'c',
        text: 'Ask questions to help you discover the flaw yourself',
        traits: { direct: 0, warm: 1, balanced: 2 },
      },
    ],
  },
  {
    id: 'q2',
    scenario:
      'You ask for a project status update. You prefer:',
    options: [
      {
        id: 'a',
        text: 'Bullet points: done, blocked, next',
        traits: { direct: 2, warm: 0, balanced: 0 },
      },
      {
        id: 'b',
        text: 'Context and narrative: here is what happened and why',
        traits: { direct: 0, warm: 2, balanced: 0 },
      },
      {
        id: 'c',
        text: 'Key highlights with details available on request',
        traits: { direct: 0, warm: 0, balanced: 2 },
      },
    ],
  },
  {
    id: 'q3',
    scenario:
      'A task fails and needs your input. Your CoS should:',
    options: [
      {
        id: 'a',
        text: 'State the problem, present options, recommend one',
        traits: { direct: 2, warm: 0, balanced: 0 },
      },
      {
        id: 'b',
        text: 'Explain what happened, how it affects the bigger picture, then options',
        traits: { direct: 0, warm: 2, balanced: 0 },
      },
      {
        id: 'c',
        text: 'Quick summary with a recommendation, elaborate if you ask',
        traits: { direct: 0, warm: 0, balanced: 2 },
      },
    ],
  },
  {
    id: 'q4',
    scenario:
      'When making daily decisions, your CoS should:',
    options: [
      {
        id: 'a',
        text: 'Decide autonomously, report results',
        traits: { direct: 2, warm: 0, balanced: 0 },
      },
      {
        id: 'b',
        text: 'Check in before decisions, discuss reasoning',
        traits: { direct: 0, warm: 2, balanced: 0 },
      },
      {
        id: 'c',
        text: 'Decide small things, escalate judgment calls',
        traits: { direct: 0, warm: 0, balanced: 2 },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Quiz answer mapping
// ---------------------------------------------------------------------------

export interface QuizResults {
  communicationStyle: string;
  pushbackLevel: string;
  detailPreference: string;
  autonomyPreference: string;
}

/**
 * Map quiz answers to USER.md profile values.
 *
 * @param answers - Record mapping question id (e.g. "q1") to selected option id (e.g. "a").
 */
export function mapQuizAnswers(answers: Record<string, string>): QuizResults {
  const totals: Record<string, number> = { direct: 0, warm: 0, balanced: 0 };

  for (const question of quizQuestions) {
    const selectedId = answers[question.id];
    if (!selectedId) continue;

    const option = question.options.find((o) => o.id === selectedId);
    if (!option) continue;

    for (const [trait, score] of Object.entries(option.traits)) {
      totals[trait] = (totals[trait] ?? 0) + score;
    }
  }

  // Determine dominant trait
  let dominant: 'direct' | 'warm' | 'balanced' = 'balanced';
  let maxScore = -1;
  for (const trait of ['direct', 'warm', 'balanced'] as const) {
    if (totals[trait] > maxScore) {
      maxScore = totals[trait];
      dominant = trait;
    }
  }

  const profiles: Record<string, QuizResults> = {
    direct: {
      communicationStyle: 'concise',
      pushbackLevel: 'high',
      detailPreference: 'minimal',
      autonomyPreference: 'high',
    },
    warm: {
      communicationStyle: 'detailed',
      pushbackLevel: 'gentle',
      detailPreference: 'thorough',
      autonomyPreference: 'low',
    },
    balanced: {
      communicationStyle: 'adaptive',
      pushbackLevel: 'contextual',
      detailPreference: 'highlights-first',
      autonomyPreference: 'moderate',
    },
  };

  return profiles[dominant];
}
