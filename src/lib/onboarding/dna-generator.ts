/**
 * DNA generator — produces company-dna.md from structured conversational input.
 *
 * Per D-06: no template file. DNA is generated from conversation with required field validation.
 * The onboarding conversation (Plan 05) will invoke generateCompanyDna() during Phase 2.
 * Phase 6 deep-dive uses enrichCompanyDna() to add detail.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { dataPath } from '../paths';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DnaInput {
  companyName: string;
  identity: string;
  targetCustomer: string;
  stage: 'idea' | 'pre-revenue' | 'revenue' | 'scaling';
  domain: string;
  // Optional enrichment from Phase 6
  competitiveLandscape?: string;
  technicalArchitecture?: string;
  businessModel?: string;
  budgetPhilosophy?: string;
  workingStyle?: string;
  regulatory?: string;
  founderBackground?: string;
  departments?: string;
}

export const DNA_REQUIRED_FIELDS: (keyof DnaInput)[] = [
  'companyName',
  'identity',
  'targetCustomer',
  'stage',
  'domain',
];

// ---------------------------------------------------------------------------
// Stage labels
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<DnaInput['stage'], string> = {
  idea: 'Idea stage -- exploring the concept, no product yet',
  'pre-revenue': 'Pre-revenue -- building toward first customers',
  revenue: 'Revenue -- generating income, proving the model',
  scaling: 'Scaling -- growth and expansion phase',
};

// ---------------------------------------------------------------------------
// generateCompanyDna
// ---------------------------------------------------------------------------

/**
 * Generate company-dna.md from structured input.
 * Validates required fields, writes to data/vault/company-dna.md.
 */
export function generateCompanyDna(input: DnaInput): string {
  // Validate required fields
  const missing = DNA_REQUIRED_FIELDS.filter(
    (field) => !input[field] || (typeof input[field] === 'string' && (input[field] as string).trim() === ''),
  );
  if (missing.length > 0) {
    throw new Error(`Missing required DNA fields: ${missing.join(', ')}`);
  }

  const sections: string[] = [];

  sections.push(`# ${input.companyName} -- Company DNA`);
  sections.push('');
  sections.push(
    'This is the single source of truth for who we are, what we are building, and how we work. Every agent in the system reads this document.',
  );

  sections.push('');
  sections.push('## Identity');
  sections.push('');
  sections.push(input.identity);

  sections.push('');
  sections.push('## Target Customer');
  sections.push('');
  sections.push(input.targetCustomer);

  sections.push('');
  sections.push('## Stage');
  sections.push('');
  sections.push(STAGE_LABELS[input.stage]);

  sections.push('');
  sections.push('## Domain');
  sections.push('');
  sections.push(input.domain);

  // Optional sections -- only include if provided
  if (input.competitiveLandscape) {
    sections.push('');
    sections.push('## Competitive Landscape');
    sections.push('');
    sections.push(input.competitiveLandscape);
  }

  if (input.technicalArchitecture) {
    sections.push('');
    sections.push('## Technical Architecture');
    sections.push('');
    sections.push(input.technicalArchitecture);
  }

  if (input.businessModel) {
    sections.push('');
    sections.push('## Business Model');
    sections.push('');
    sections.push(input.businessModel);
  }

  if (input.budgetPhilosophy) {
    sections.push('');
    sections.push('## Budget Philosophy');
    sections.push('');
    sections.push(input.budgetPhilosophy);
  }

  if (input.workingStyle) {
    sections.push('');
    sections.push('## Working Style');
    sections.push('');
    sections.push(input.workingStyle);
  }

  if (input.regulatory) {
    sections.push('');
    sections.push('## Regulatory Considerations');
    sections.push('');
    sections.push(input.regulatory);
  }

  if (input.founderBackground) {
    sections.push('');
    sections.push('## Founder Background');
    sections.push('');
    sections.push(input.founderBackground);
  }

  if (input.departments) {
    sections.push('');
    sections.push('## Departments');
    sections.push('');
    sections.push(input.departments);
  }

  const content = sections.join('\n') + '\n';

  // Write to data/vault/company-dna.md
  const outPath = dataPath('vault', 'company-dna.md');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, 'utf-8');

  // Recompile vault catalog
  import('@/lib/catalog').then(m => m.compileVaultCatalog()).catch(() => {});

  return content;
}

// ---------------------------------------------------------------------------
// enrichCompanyDna
// ---------------------------------------------------------------------------

/**
 * Enrich existing DNA with additional sections from Phase 6 deep-dive.
 * Reads existing DNA, merges new sections, and rewrites the file.
 */
export function enrichCompanyDna(additions: Partial<DnaInput>): void {
  const dnaPath = dataPath('vault', 'company-dna.md');

  if (!existsSync(dnaPath)) {
    throw new Error('Cannot enrich DNA: company-dna.md does not exist. Run generateCompanyDna first.');
  }

  let existing = readFileSync(dnaPath, 'utf-8');

  // For each addition, either replace the existing section or append it
  const sectionMap: Record<string, string> = {
    competitiveLandscape: '## Competitive Landscape',
    technicalArchitecture: '## Technical Architecture',
    businessModel: '## Business Model',
    budgetPhilosophy: '## Budget Philosophy',
    workingStyle: '## Working Style',
    regulatory: '## Regulatory Considerations',
    founderBackground: '## Founder Background',
    departments: '## Departments',
  };

  for (const [field, heading] of Object.entries(sectionMap)) {
    const value = additions[field as keyof DnaInput];
    if (!value || typeof value !== 'string') continue;

    const headingPattern = new RegExp(
      `${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n\\n[\\s\\S]*?(?=\\n## |$)`,
    );

    if (headingPattern.test(existing)) {
      // Replace existing section content
      existing = existing.replace(headingPattern, `${heading}\n\n${value}\n`);
    } else {
      // Append new section at the end
      existing = existing.trimEnd() + `\n\n${heading}\n\n${value}\n`;
    }
  }

  writeFileSync(dnaPath, existing, 'utf-8');

  // Recompile vault catalog
  import('@/lib/catalog').then(m => m.compileVaultCatalog()).catch(() => {});
}
