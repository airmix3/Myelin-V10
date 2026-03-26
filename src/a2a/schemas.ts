/**
 * JSON Schema objects for SDK outputFormat.
 * Per AGENT-04: SDK structured output for ALL turn routing -- no regex parsing.
 * Per research Pitfall 4: outputFormat takes raw JSON Schema, not zod.
 *
 * These schemas match the TypeScript interfaces in ./types.ts:
 *   ROUTING_SCHEMA -> RoutingResult
 *   AGENT_TURN_SCHEMA -> AgentTurnResult
 */

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
