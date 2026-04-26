/**
 * Structured output schema for onboarding conversation turns.
 *
 * The CoS uses this schema during onboarding to classify each turn:
 * - response: the CoS message to display to the founder
 * - phase_status: whether the current phase should advance
 * - artifacts_generated: list of artifact paths created/updated this turn
 * - ui_action: optional UI action to trigger (persona grid, quiz, org builder, etc.)
 */

import type { JsonSchemaOutputFormat } from '@anthropic-ai/claude-agent-sdk';

export const ONBOARDING_PHASE_SCHEMA: JsonSchemaOutputFormat = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      response: {
        type: 'string',
        description: 'Your conversational reply to the founder — this is displayed directly in the chat UI. Write naturally as if speaking to them. NEVER put internal analysis, classification summaries, or phase transition notes here.',
      },
      phase_status: {
        type: 'string',
        enum: ['continue', 'phase_complete', 'needs_input'],
        description: 'Internal classification only (never shown to founder). Whether the current phase has enough signal to advance.',
      },
      artifacts_generated: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of artifact paths created/updated this turn',
      },
      ui_action: {
        type: 'object',
        description: 'Optional UI action to trigger',
        properties: {
          type: {
            type: 'string',
            enum: [
              'show_persona_grid',
              'show_quiz',
              'show_org_builder',
              'show_upload',
              'show_demo_task_options',
              'show_category_sidebar',
              'none',
            ],
          },
          data: {
            type: 'object',
            properties: {
              options: {
                type: 'array',
                description: 'Task options for show_demo_task_options. Each option has a short title, a longer description explaining what the agent will do, and the target department.',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Short task title (3-8 words)' },
                    description: { type: 'string', description: 'One sentence explaining what the agent will do and what the founder gets back' },
                    department: { type: 'string', description: 'Target department: tech, marketing, or operations' },
                  },
                  required: ['title', 'description', 'department'],
                  additionalProperties: false,
                },
              },
            },
            additionalProperties: true,
          },
        },
        required: ['type'],
        additionalProperties: false,
      },
    },
    required: ['response', 'phase_status'],
    additionalProperties: false,
  },
};
