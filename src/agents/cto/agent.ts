import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Agent card metadata
import cardJson from './card.json';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  const soulMd = readFileSync(resolve(__dirname, 'soul.md'), 'utf-8');
  return {
    ...cardJson,
    soulMd,
  };
}

export const agentConfig = getAgentConfig();
