/**
 * JSON Schema objects for SDK outputFormat.
 * Per AGENT-04: SDK structured output for ALL turn routing -- no regex parsing.
 * Per research Pitfall 4: outputFormat takes raw JSON Schema, not zod.
 *
 * These schemas match the TypeScript interfaces in ./types.ts:
 *   ROUTING_SCHEMA -> RoutingResult
 *   AGENT_TURN_SCHEMA -> AgentTurnResult
 *
 * Static schemas remain as type references and fallbacks.
 * Use buildDynamicRoutingSchema() / buildDynamicConsultationSchema() at invocation
 * time to get schemas with DB-derived department enums.
 */

import { getActiveDepartments } from '@/lib/departments';

export const ROUTING_SCHEMA = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      department: {
        type: 'string',
        enum: ['tech', 'marketing', 'operations'],
        description: 'Which department should handle this task',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score 0-1 for the routing decision',
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of why this department was chosen',
      },
      suggested_title: {
        type: 'string',
        description: 'A concise title for the task (under 80 characters)',
      },
    },
    required: ['department', 'confidence', 'reasoning', 'suggested_title'],
    additionalProperties: false,
  },
};

export const CONSULTATION_TURN_SCHEMA = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      response: {
        type: 'string',
        description: 'Tamir conversational response to the CEO. Natural, thoughtful, not robotic.',
      },
      classification: {
        type: 'string',
        enum: ['chat', 'task_detected'],
        description: 'Default to "chat". Only use "task_detected" when the CEO explicitly delegates work to an agent (e.g. "let\'s have the CTO do X", "assign this to marketing"). Discussing problems, asking advice, or mentioning work is NOT task_detected.',
      },
      detected_task: {
        type: 'object',
        description: 'Present only when classification is task_detected. Describes the detected task.',
        properties: {
          title: { type: 'string', description: 'Short task title' },
          department: { type: 'string', enum: ['tech', 'marketing', 'operations'] },
          confidence: { type: 'number', description: '0-1 confidence that this is a real task' },
        },
        required: ['title', 'department', 'confidence'],
      },
    },
    required: ['response', 'classification'],
    additionalProperties: false,
  },
};

/**
 * Build routing schema with department enum derived from DB at runtime.
 */
export async function buildDynamicRoutingSchema(): Promise<typeof ROUTING_SCHEMA> {
  const depts = await getActiveDepartments();
  return {
    type: 'json_schema' as const,
    schema: {
      type: 'object',
      properties: {
        department: {
          type: 'string',
          enum: depts,
          description: 'Which department should handle this task',
        },
        confidence: {
          type: 'number',
          description: 'Confidence score 0-1 for the routing decision',
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation of why this department was chosen',
        },
        suggested_title: {
          type: 'string',
          description: 'A concise title for the task (under 80 characters)',
        },
      },
      required: ['department', 'confidence', 'reasoning', 'suggested_title'],
      additionalProperties: false,
    },
  };
}

/**
 * Build consultation turn schema with department enum derived from DB at runtime.
 */
export async function buildDynamicConsultationSchema(): Promise<typeof CONSULTATION_TURN_SCHEMA> {
  const depts = await getActiveDepartments();
  return {
    type: 'json_schema' as const,
    schema: {
      type: 'object',
      properties: {
        response: {
          type: 'string',
          description: 'Tamir conversational response to the CEO. Natural, thoughtful, not robotic.',
        },
        classification: {
          type: 'string',
          enum: ['chat', 'task_detected'],
          description: 'Default to "chat". Only use "task_detected" when the CEO explicitly delegates work to an agent (e.g. "let\'s have the CTO do X", "assign this to marketing"). Discussing problems, asking advice, or mentioning work is NOT task_detected.',
        },
        detected_task: {
          type: 'object',
          description: 'Present only when classification is task_detected. Describes the detected task.',
          properties: {
            title: { type: 'string', description: 'Short task title' },
            department: { type: 'string', enum: depts },
            confidence: { type: 'number', description: '0-1 confidence that this is a real task' },
          },
          required: ['title', 'department', 'confidence'],
        },
      },
      required: ['response', 'classification'],
      additionalProperties: false,
    },
  };
}

export const AGENT_TURN_SCHEMA = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      turn_type: {
        type: 'string',
        enum: ['question', 'clarification', 'plan_ready', 'plan_update', 'done'],
        description: 'Type of this conversational turn',
      },
      message: {
        type: 'string',
        description: 'The agent message to display to the user',
      },
      plan_markdown: {
        type: 'string',
        description: 'Full plan in markdown format. Present when turn_type is plan_ready or plan_update.',
      },
    },
    required: ['turn_type', 'message'],
    additionalProperties: false,
  },
};
