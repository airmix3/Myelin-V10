import { readFileSync } from 'fs';
import { resolve } from 'path';
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
    soulMd: readFileSync(resolve(process.cwd(), 'src/agents/cto/soul.md'), 'utf-8'),
  };
}
