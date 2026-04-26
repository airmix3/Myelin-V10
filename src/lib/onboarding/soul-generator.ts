/**
 * Soul generator — template/generated layer split.
 *
 * Soul files have two layers:
 *   Template layer (soul-template.md): universal functional behavior (routing, tools, escalation).
 *   Generated layer (soul-generated.md): per-company personality, tone, domain context.
 *
 * loadSoul() merges both layers at runtime.
 * generateCosSoul() and generateSoul() write the generated layer during onboarding.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { dataPath } from '../paths';
import type { QuizResults } from './persona';
import { PERSONAS } from './persona';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Resolve a path relative to the project root (src/agents/...) */
function agentSrcPath(...segments: string[]): string {
  return resolve(process.cwd(), 'src', 'agents', ...segments);
}

// ---------------------------------------------------------------------------
// loadSoul — merge template + generated layers
// ---------------------------------------------------------------------------

/**
 * Load the merged soul for an agent.
 *
 * Resolution order for the template layer:
 *   1. src/agents/{agentId}/soul-template.md  (agent-specific template)
 *   2. src/agents/{department}/soul-template.md  (department template, e.g. cos/)
 *   3. src/agents/_dept-head-template/soul-template.md  (generic dept head template)
 *
 * Generated layer:
 *   data/agents/{agentId}/soul-generated.md
 *
 * Returns merged content (template + generated) separated by a horizontal rule.
 * Falls back to whichever layer exists if only one is present.
 */
export function loadSoul(agentId: string, department?: string): string {
  let template: string | undefined;
  let generated: string | undefined;

  // Try agent-specific template first
  const specificTemplatePath = agentSrcPath(agentId, 'soul-template.md');
  if (existsSync(specificTemplatePath)) {
    template = readFileSync(specificTemplatePath, 'utf-8');
  }

  // Try department-specific template (e.g. src/agents/cos/soul-template.md)
  if (!template && department) {
    const deptTemplatePath = agentSrcPath(department, 'soul-template.md');
    if (existsSync(deptTemplatePath)) {
      template = readFileSync(deptTemplatePath, 'utf-8');
    }
  }

  // Fall back to generic dept head template
  if (!template) {
    const genericTemplatePath = agentSrcPath('_dept-head-template', 'soul-template.md');
    if (existsSync(genericTemplatePath)) {
      template = readFileSync(genericTemplatePath, 'utf-8');
    }
  }

  // Try generated layer
  const generatedPath = dataPath('agents', agentId, 'soul-generated.md');
  if (existsSync(generatedPath)) {
    generated = readFileSync(generatedPath, 'utf-8');
  }

  if (template && generated) {
    return template + '\n\n---\n\n' + generated;
  }
  if (template) return template;
  if (generated) return generated;

  return '';
}

// ---------------------------------------------------------------------------
// generateCosSoul — generate CoS personality layer
// ---------------------------------------------------------------------------

/**
 * Generate the CoS personality soul content from persona + quiz results.
 * Writes to data/agents/cos/soul-generated.md.
 */
export function generateCosSoul(
  personaId: string,
  founderName: string,
  companyName: string,
  quizResults: QuizResults,
): string {
  const persona = PERSONAS.find((p) => p.id === personaId);
  if (!persona) {
    throw new Error(`Unknown persona id: ${personaId}`);
  }

  const content = `# ${persona.name} -- Chief of Staff at ${companyName}

## Personality and Tone

${persona.personalityTraits}

## Founder Context

You report directly to ${founderName}, the CEO and founder. Your role is the connective tissue of the company: you route work to the right department, manage planning flow, monitor system health, and ensure nothing falls through the cracks.

${founderName} built this system so they can focus on strategy while the agents handle execution. You are the layer between the founder's intent and the company's execution.

## Communication Preferences

- **Style:** ${quizResults.communicationStyle}
- **Pushback level:** ${quizResults.pushbackLevel}
- **Detail preference:** ${quizResults.detailPreference}
- **Autonomy preference:** ${quizResults.autonomyPreference}

These preferences were established during onboarding. Respect them as defaults but adapt when context demands it -- a crisis requires directness regardless of the founder's usual preference for detailed explanations.
`;

  const outPath = dataPath('agents', 'cos', 'soul-generated.md');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, 'utf-8');

  return content;
}

// ---------------------------------------------------------------------------
// generateSoul — generate department head personality layer
// ---------------------------------------------------------------------------

export interface DeptHeadSoulConfig {
  departmentName: string;
  headName: string;
  headPersonality: string;
  companyName: string;
  founderName: string;
  domainContext: string;
}

/**
 * Generate a department head soul personality section.
 * Writes to data/agents/{agentId}/soul-generated.md.
 */
export function generateSoul(agentId: string, config: DeptHeadSoulConfig): string {
  const content = `# ${config.headName} -- Head of ${config.departmentName} at ${config.companyName}

## Personality and Tone

${config.headPersonality}

## Company Context

You report to ${config.founderName}, the CEO and founder of ${config.companyName}. You own all deliverables within the ${config.departmentName} department.

## Domain Expertise

${config.domainContext}
`;

  const outPath = dataPath('agents', agentId, 'soul-generated.md');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, 'utf-8');

  return content;
}
