/**
 * Tests for AgentOrchestrator — Per doc 17 Phase 1.
 * The orchestrator is a pure in-memory Map — no mocking needed.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentOrchestrator, type AgentRegistryEntry } from './orchestrator';

function makeEntry(overrides: Partial<AgentRegistryEntry> = {}): AgentRegistryEntry {
  return {
    agentId: 'test_agent',
    name: 'Test Agent',
    department: 'tech',
    role: 'engineer',
    soulMd: 'You are a test agent.',
    avatarColor: '#000000',
    ...overrides,
  };
}

describe('AgentOrchestrator', () => {
  let orch: AgentOrchestrator;

  beforeEach(() => {
    orch = new AgentOrchestrator();
  });

  describe('register + getAgent', () => {
    it('registers an agent and retrieves it with all fields', () => {
      const entry = makeEntry({ agentId: 'cto', name: 'CTO', department: 'tech', role: 'executive' });
      orch.register(entry);

      const result = orch.getAgent('cto');
      expect(result).toBeDefined();
      expect(result!.agentId).toBe('cto');
      expect(result!.name).toBe('CTO');
      expect(result!.department).toBe('tech');
      expect(result!.role).toBe('executive');
      expect(result!.soulMd).toBe('You are a test agent.');
      expect(result!.avatarColor).toBe('#000000');
    });

    it('returns undefined for unknown agentId', () => {
      expect(orch.getAgent('nonexistent')).toBeUndefined();
    });

    it('overwrites existing agent with same agentId', () => {
      orch.register(makeEntry({ agentId: 'a1', name: 'First' }));
      orch.register(makeEntry({ agentId: 'a1', name: 'Second' }));
      expect(orch.getAgent('a1')!.name).toBe('Second');
    });
  });

  describe('getAllAgents', () => {
    it('returns all registered agents', () => {
      orch.register(makeEntry({ agentId: 'a1' }));
      orch.register(makeEntry({ agentId: 'a2' }));
      orch.register(makeEntry({ agentId: 'a3' }));
      expect(orch.getAllAgents()).toHaveLength(3);
    });

    it('returns empty array when no agents registered', () => {
      expect(orch.getAllAgents()).toEqual([]);
    });
  });

  describe('unregisterAgent', () => {
    it('removes an agent so getAgent returns undefined', () => {
      orch.register(makeEntry({ agentId: 'a1' }));
      orch.unregisterAgent('a1');
      expect(orch.getAgent('a1')).toBeUndefined();
    });

    it('unregistering non-existent agent does not throw', () => {
      expect(() => orch.unregisterAgent('nonexistent')).not.toThrow();
    });
  });

  describe('getEmployeesForDepartment', () => {
    it('returns only agents with isEmployee=true in the department', () => {
      // Executive (not an employee)
      orch.register(makeEntry({ agentId: 'cto', department: 'tech', isEmployee: undefined }));
      // Employee in tech
      orch.register(makeEntry({ agentId: 'eng1', department: 'tech', isEmployee: true, name: 'Engineer 1' }));
      // Employee in tech
      orch.register(makeEntry({ agentId: 'eng2', department: 'tech', isEmployee: true, name: 'Engineer 2' }));
      // Employee in marketing (different dept)
      orch.register(makeEntry({ agentId: 'mkt1', department: 'marketing', isEmployee: true }));

      const techEmployees = orch.getEmployeesForDepartment('tech');
      expect(techEmployees).toHaveLength(2);
      expect(techEmployees.map(e => e.agentId).sort()).toEqual(['eng1', 'eng2']);
    });

    it('returns empty array for unknown department', () => {
      expect(orch.getEmployeesForDepartment('nonexistent')).toEqual([]);
    });

    it('does not return agents with isEmployee=false', () => {
      orch.register(makeEntry({ agentId: 'a1', department: 'tech', isEmployee: false }));
      expect(orch.getEmployeesForDepartment('tech')).toEqual([]);
    });

    it('department filter is exact match (tech != marketing)', () => {
      orch.register(makeEntry({ agentId: 'e1', department: 'tech', isEmployee: true }));
      expect(orch.getEmployeesForDepartment('marketing')).toEqual([]);
    });

    it('per doc 17: isEmployee=true is required to appear in roster', () => {
      // Agent without isEmployee set (executive-style registration)
      orch.register(makeEntry({ agentId: 'cmo', department: 'marketing' }));
      expect(orch.getEmployeesForDepartment('marketing')).toEqual([]);
    });
  });

  describe('getEmployeesForHead', () => {
    it('returns agents with matching parentAgentId', () => {
      orch.register(makeEntry({ agentId: 'emp1', parentAgentId: 'cto', isEmployee: true }));
      orch.register(makeEntry({ agentId: 'emp2', parentAgentId: 'cto', isEmployee: true }));
      orch.register(makeEntry({ agentId: 'emp3', parentAgentId: 'cmo', isEmployee: true }));

      const ctoEmployees = orch.getEmployeesForHead('cto');
      expect(ctoEmployees).toHaveLength(2);
      expect(ctoEmployees.map(e => e.agentId).sort()).toEqual(['emp1', 'emp2']);
    });

    it('returns empty array when no employees for head', () => {
      expect(orch.getEmployeesForHead('nonexistent')).toEqual([]);
    });

    it('does not return the head itself', () => {
      orch.register(makeEntry({ agentId: 'cto', parentAgentId: undefined }));
      orch.register(makeEntry({ agentId: 'emp1', parentAgentId: 'cto' }));
      expect(orch.getEmployeesForHead('cto')).toHaveLength(1);
      expect(orch.getEmployeesForHead('cto')[0].agentId).toBe('emp1');
    });
  });
});
