'use client';

import { useEffect, useState, useCallback } from 'react';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import WelcomeScreen from '@/components/onboarding/WelcomeScreen';
import PersonaSelector from '@/components/onboarding/PersonaSelector';
import PersonalityQuiz from '@/components/onboarding/PersonalityQuiz';
import ChatPhase from '@/components/onboarding/ChatPhase';
import OrgBuilder from '@/components/onboarding/OrgBuilder';
import DemoTask from '@/components/onboarding/DemoTask';
import FileIngestion from '@/components/onboarding/FileIngestion';
import GraduationScreen from '@/components/onboarding/GraduationScreen';
import { PERSONAS } from '@/lib/onboarding/persona';
import { getPhaseInfo } from '@/lib/onboarding/phases';
import type { OnboardingDepartment } from '@/lib/onboarding/state';

// Screen type union covering all onboarding screens
type Screen =
  | 'loading'
  | 'redirecting'
  | 'welcome'
  | 'persona'
  | 'quiz'
  | 'chat'
  | 'org_builder'
  | 'demo_task'
  | 'file_ingestion'
  | 'graduation';

interface OnboardingApiState {
  status: string;
  currentPhase: number;
  phases: Record<number, { status: string; data?: Record<string, unknown> }>;
  cosPersona?: { id: string; name: string; avatarPath: string };
  companyName?: string;
  founderName?: string;
  assetInventory?: {
    categories: Record<string, { hasItems: boolean; items: string[] }>;
  };
}

interface StateResponse {
  active: boolean;
  state: OnboardingApiState | null;
}

export default function OnboardingPage() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [cosName, setCosName] = useState('');
  const [cosAvatarPath, setCosAvatarPath] = useState('/avatars/persona-balanced.svg');
  const [founderName, setFounderName] = useState<string | undefined>();
  const [stateData, setStateData] = useState<OnboardingApiState | null>(null);
  const [categoryState, setCategoryState] = useState<Record<string, boolean>>({
    'Brand & Identity': false,
    'Documents & Strategy': false,
    'Code & Technical': false,
    'Content & Marketing': false,
    'Financial & Legal': false,
    'Customer & Market': false,
    'Operational': false,
    'Domain Knowledge': false,
  });
  const [departments, setDepartments] = useState<OnboardingDepartment[]>([]);

  // Derive completed phases from state
  const deriveCompletedPhases = useCallback((state: OnboardingApiState): number[] => {
    const completed: number[] = [];
    for (const [phase, info] of Object.entries(state.phases)) {
      if (info.status === 'completed') {
        completed.push(Number(phase));
      }
    }
    return completed;
  }, []);

  // Determine which screen to show based on state
  const resolveScreen = useCallback((state: OnboardingApiState): Screen => {
    const phase = state.currentPhase;

    if (phase === 0) {
      return 'welcome';
    }

    if (phase === 1) {
      if (!state.cosPersona) return 'persona';
      // Check if quiz is done (Phase 1 data includes quiz results)
      const phase1Data = state.phases[1]?.data;
      if (!phase1Data?.quizCompleted) return 'quiz';
      return 'chat'; // Phase 1 complete, moving to next
    }

    if (phase >= 2 && phase <= 6) return 'chat';
    if (phase === 7) return 'org_builder';
    if (phase === 8) return 'demo_task';
    if (phase === 9) {
      // If phase 9 is completed, show graduation
      if (state.phases[9]?.status === 'completed') return 'graduation';
      return 'file_ingestion';
    }

    if (state.status === 'completed') return 'graduation';

    return 'chat';
  }, []);

  // Fetch state on mount
  useEffect(() => {
    async function fetchState() {
      try {
        const res = await fetch('/onboarding/api/state');
        if (!res.ok) throw new Error('Failed to fetch onboarding state');
        const data: StateResponse = await res.json();

        // CRITICAL: existing installation guard
        if (data.active === false) {
          setScreen('redirecting');
          window.location.href = '/';
          return;
        }

        if (!data.state) {
          // Fresh onboarding, no state yet
          setCurrentPhase(0);
          setCompletedPhases([]);
          setScreen('welcome');
          return;
        }

        // We have active onboarding state
        setStateData(data.state);
        setCurrentPhase(data.state.currentPhase);
        setCompletedPhases(deriveCompletedPhases(data.state));

        if (data.state.cosPersona) {
          setCosName(data.state.cosPersona.name);
          setCosAvatarPath(data.state.cosPersona.avatarPath || '/avatars/persona-balanced.svg');
        }

        if (data.state.founderName) {
          setFounderName(data.state.founderName);
        }

        // Restore category state from Phase 5 asset inventory if present
        if (data.state.assetInventory?.categories) {
          const restored: Record<string, boolean> = {};
          for (const [cat, info] of Object.entries(data.state.assetInventory.categories)) {
            restored[cat] = (info as { hasItems: boolean }).hasItems;
          }
          setCategoryState((prev) => ({ ...prev, ...restored }));
        }

        // Restore departments
        if ((data.state as Record<string, unknown>).departments) {
          setDepartments((data.state as Record<string, unknown>).departments as OnboardingDepartment[]);
        }

        setScreen(resolveScreen(data.state));
      } catch {
        // On error, show welcome screen as fallback for new installations
        setScreen('welcome');
      }
    }

    fetchState();
  }, [deriveCompletedPhases, resolveScreen]);

  // Handle welcome screen start
  async function handleStart() {
    setCurrentPhase(1);
    setScreen('persona');
  }

  // Handle persona selection
  async function handlePersonaSelect(personaId: string) {
    const persona = PERSONAS.find((p) => p.id === personaId);
    if (!persona) return;

    setCosName(persona.name);
    setCosAvatarPath(persona.avatarPath);

    try {
      await fetch('/onboarding/api/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId }),
      });
    } catch {
      // Continue anyway -- state will sync on next load
    }

    setScreen('quiz');
  }

  // Handle quiz completion
  async function handleQuizComplete(answers: Record<string, string>) {
    try {
      await fetch('/onboarding/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quiz_complete',
          answers,
        }),
      });
    } catch {
      // Continue anyway
    }

    // Mark Phase 1 as completed in persistent state
    try {
      await fetch('/onboarding/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'phase_complete', phaseNumber: 1 }),
      });
    } catch {
      // State will sync on next load
    }

    setCompletedPhases((prev) => [...prev, 1]);
    setCurrentPhase(2);
    setScreen('chat');
  }

  // Handle phase complete from ChatPhase (phases 2-6)
  async function handlePhaseComplete() {
    try {
      const res = await fetch('/onboarding/api/state');
      if (!res.ok) throw new Error('Failed to fetch state');
      const data: StateResponse = await res.json();

      if (data.state) {
        setStateData(data.state);
        setCurrentPhase(data.state.currentPhase);
        setCompletedPhases(deriveCompletedPhases(data.state));

        if (data.state.founderName) {
          setFounderName(data.state.founderName);
        }

        // Restore category state from asset inventory
        if (data.state.assetInventory?.categories) {
          const restored: Record<string, boolean> = {};
          for (const [cat, info] of Object.entries(data.state.assetInventory.categories)) {
            restored[cat] = (info as { hasItems: boolean }).hasItems;
          }
          setCategoryState((prev) => ({ ...prev, ...restored }));
        }

        // Restore departments
        if ((data.state as Record<string, unknown>).departments) {
          setDepartments((data.state as Record<string, unknown>).departments as OnboardingDepartment[]);
        }

        setScreen(resolveScreen(data.state));
      }
    } catch {
      // Fallback: advance phase manually
      setCompletedPhases((prev) => [...prev, currentPhase]);
      const nextPhase = currentPhase + 1;
      setCurrentPhase(nextPhase);
      if (nextPhase === 7) setScreen('org_builder');
      else if (nextPhase <= 6) setScreen('chat');
    }
  }

  // Handle category update from ChatPhase (Phase 5)
  function handleCategoryUpdate(category: string, hasItems: boolean) {
    setCategoryState((prev) => ({ ...prev, [category]: hasItems }));
  }

  // Department CRUD handlers for OrgBuilder
  async function handleAddDepartment(dept: { name: string; headName: string; personality: string }) {
    const res = await fetch('/onboarding/api/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dept),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.department) {
        setDepartments((prev) => [...prev, data.department as OnboardingDepartment]);
      }
    }
  }

  async function handleUpdateDepartment(deptId: string, updates: Partial<OnboardingDepartment>) {
    const res = await fetch('/onboarding/api/org', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentId: deptId, ...updates }),
    });
    if (res.ok) {
      setDepartments((prev) =>
        prev.map((d) => (d.id === deptId ? { ...d, ...updates } : d))
      );
    }
  }

  async function handleRemoveDepartment(deptId: string) {
    const res = await fetch('/onboarding/api/org', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentId: deptId }),
    });
    if (res.ok) {
      setDepartments((prev) => prev.filter((d) => d.id !== deptId));
    }
  }

  async function handleOrgComplete() {
    // Advance to phase 8
    try {
      await fetch('/onboarding/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'phase_complete', phaseNumber: 7 }),
      });
    } catch {
      // Continue anyway
    }
    setCompletedPhases((prev) => [...prev, 7]);
    setCurrentPhase(8);
    setScreen('demo_task');
  }

  // Handle file ingestion complete -- advance to graduation
  async function handleFileIngestionComplete() {
    try {
      await fetch('/onboarding/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'phase_complete', phaseNumber: 9 }),
      });
    } catch {
      // Continue anyway
    }
    setCompletedPhases((prev) => [...prev, 9]);
    setScreen('graduation');
  }

  // Calculate files ingested from state
  const filesIngested = stateData?.assetInventory?.categories
    ? Object.values(stateData.assetInventory.categories).reduce(
        (sum, cat) => sum + (cat.items?.length || 0),
        0,
      )
    : 0;

  // Render loading / redirecting states
  if (screen === 'loading' || screen === 'redirecting') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500 text-sm">
          {screen === 'redirecting' ? 'Redirecting...' : 'Loading...'}
        </div>
      </div>
    );
  }

  // Determine phase number for shell (welcome = 0, the rest map to phases)
  const shellPhase = screen === 'welcome' ? 0 : currentPhase;

  return (
    <OnboardingShell currentPhase={shellPhase} completedPhases={completedPhases}>
      {screen === 'welcome' && (
        <WelcomeScreen onStart={handleStart} />
      )}

      {screen === 'persona' && (
        <PersonaSelector onSelect={handlePersonaSelect} />
      )}

      {screen === 'quiz' && (
        <PersonalityQuiz cosName={cosName} onComplete={handleQuizComplete} />
      )}

      {screen === 'chat' && (
        <ChatPhase
          phaseNumber={currentPhase}
          phaseTitle={getPhaseInfo(currentPhase)?.name || ''}
          cosName={cosName || 'Chief of Staff'}
          cosAvatarPath={cosAvatarPath}
          founderName={founderName}
          onPhaseComplete={handlePhaseComplete}
          showCategorySidebar={currentPhase === 5}
          categoryState={currentPhase === 5 ? categoryState : undefined}
          onCategoryUpdate={currentPhase === 5 ? handleCategoryUpdate : undefined}
        />
      )}

      {screen === 'org_builder' && (
        <OrgBuilder
          founderName={founderName || 'Founder'}
          cosName={cosName || 'Chief of Staff'}
          cosAvatarPath={cosAvatarPath}
          departments={departments}
          onAddDepartment={handleAddDepartment}
          onUpdateDepartment={handleUpdateDepartment}
          onRemoveDepartment={handleRemoveDepartment}
          onComplete={handleOrgComplete}
        />
      )}

      {screen === 'demo_task' && (
        <DemoTask
          cosName={cosName || 'Chief of Staff'}
          completedPhases={completedPhases}
          onTaskSelected={(taskDescription) => {
            // Task selection handled inside DemoTask via router.push
            // This callback can be used for tracking if needed
          }}
          onSkip={async () => {
            // Skip Phase 8 -- advance directly to Phase 9
            try {
              await fetch('/onboarding/api/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'phase_complete', phaseNumber: 8 }),
              });
            } catch {
              // Continue anyway
            }
            setCompletedPhases((prev) => [...prev, 8]);
            setCurrentPhase(9);
            setScreen('file_ingestion');
          }}
          onComplete={async () => {
            // Demo task completed -- advance to Phase 9
            try {
              await fetch('/onboarding/api/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'phase_complete', phaseNumber: 8 }),
              });
            } catch {
              // Continue anyway
            }
            setCompletedPhases((prev) => [...prev, 8]);
            setCurrentPhase(9);
            setScreen('file_ingestion');
          }}
        />
      )}

      {screen === 'file_ingestion' && (
        <FileIngestion
          categories={
            stateData?.assetInventory?.categories || {
              'Brand & Identity': { hasItems: false, items: [] },
              'Documents & Strategy': { hasItems: false, items: [] },
              'Code & Technical': { hasItems: false, items: [] },
              'Content & Marketing': { hasItems: false, items: [] },
              'Financial & Legal': { hasItems: false, items: [] },
              'Customer & Market': { hasItems: false, items: [] },
              'Operational': { hasItems: false, items: [] },
              'Domain Knowledge': { hasItems: false, items: [] },
            }
          }
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          cosName={cosName || 'Chief of Staff'}
          cosAvatarPath={cosAvatarPath}
          onComplete={handleFileIngestionComplete}
        />
      )}

      {screen === 'graduation' && (
        <GraduationScreen
          companyName={stateData?.companyName || 'Your Company'}
          departmentCount={departments.length}
          departmentNames={departments.map((d) => d.name)}
          filesIngested={filesIngested}
          cosName={cosName || 'Chief of Staff'}
          onEnterCortex={() => {
            // GraduationScreen handles POST to /onboarding/api/complete and redirect internally
          }}
        />
      )}
    </OnboardingShell>
  );
}
