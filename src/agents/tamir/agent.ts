import { loadSoul } from '@/lib/onboarding/soul-generator';
import cardJson from './card.json';

export interface AgentConfig {
  agentId: string;
  name: string;
  department: string;
  role: 'executive' | 'temp';
  description: string;
  tools: string[];
  skills: string[];
  avatarColor: string;
  soulMd: string;
}

export function getAgentConfig(): AgentConfig {
  return {
    ...cardJson,
    role: cardJson.role as AgentConfig['role'],
    soulMd: loadSoul('tamir', cardJson.department),
  };
}
