'use client';

/**
 * OrgBuilder — visual tree-based organizational structure editor.
 *
 * Per UI-SPEC Screen 5: two-region layout (60% SVG tree, 40% detail panel).
 * SVG tree: CEO at top, CoS below, departments as branches, "Add Department" node.
 * Connecting lines: 1px solid rgba(255,255,255,0.12), vertical+horizontal (no diagonals).
 * CoS chat overlay in bottom-right for contextual suggestions.
 * Per D-14/D-15/D-16/D-17: full dynamic organs, tree/hierarchy, CoS pushback, founder naming.
 */

import { useState, useCallback, useMemo } from 'react';
import type { OnboardingDepartment } from '@/lib/onboarding/state';
import OrgNode, { NODE_WIDTH, NODE_HEIGHT } from './OrgNode';
import OrgDetailPanel from './OrgDetailPanel';
import { MessageSquare, X, Check, Plus } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Preset department catalog                                          */
/* ------------------------------------------------------------------ */

interface PresetDepartment {
  id: string;
  name: string;
  defaultHead: string;
  icon: string;
  description: string;
  defaultPersonality: string;
  color: string;
}

const PRESET_DEPARTMENTS: PresetDepartment[] = [
  { id: 'tech', name: 'Technology', defaultHead: 'CTO', icon: '', description: 'Engineering & infrastructure', defaultPersonality: 'Analytical and systematic. Focuses on clean architecture and pragmatic solutions.', color: '#22d3ee' },
  { id: 'marketing', name: 'Marketing', defaultHead: 'CMO', icon: '', description: 'Brand, content & growth', defaultPersonality: 'Creative and data-driven. Balances brand storytelling with measurable outcomes.', color: '#a78bfa' },
  { id: 'operations', name: 'Operations', defaultHead: 'COO', icon: '', description: 'Processes & efficiency', defaultPersonality: 'Organized and process-oriented. Optimizes workflows and removes bottlenecks.', color: '#4ade80' },
  { id: 'research', name: 'Research', defaultHead: 'Head of Research', icon: '', description: 'R&D & domain expertise', defaultPersonality: 'Curious and thorough. Digs deep into problems and surfaces evidence-based insights.', color: '#f472b6' },
  { id: 'finance', name: 'Finance', defaultHead: 'CFO', icon: '', description: 'Budgets & financial planning', defaultPersonality: 'Precise and risk-aware. Ensures financial discipline while supporting growth.', color: '#fbbf24' },
  { id: 'sales', name: 'Sales', defaultHead: 'Head of Sales', icon: '', description: 'Revenue & partnerships', defaultPersonality: 'Persuasive and relationship-focused. Drives revenue through genuine connections.', color: '#fb923c' },
  { id: 'product', name: 'Product', defaultHead: 'Head of Product', icon: '', description: 'Strategy & user experience', defaultPersonality: 'User-obsessed and strategic. Bridges customer needs with technical capability.', color: '#60a5fa' },
  { id: 'hr', name: 'People & Culture', defaultHead: 'Head of People', icon: '', description: 'Hiring & team health', defaultPersonality: 'Empathetic and principled. Champions team wellbeing and organizational growth.', color: '#e879f9' },
];

export interface OrgBuilderProps {
  founderName: string;
  cosName: string;
  cosAvatarPath: string;
  departments: OnboardingDepartment[];
  onAddDepartment: (dept: { name: string; headName: string; personality: string }) => Promise<void>;
  onUpdateDepartment: (deptId: string, updates: Partial<OnboardingDepartment>) => Promise<void>;
  onRemoveDepartment: (deptId: string) => Promise<void>;
  onComplete: () => void;
}

// Layout constants
const CEO_Y = 40;
const COS_Y = 120;
const DEPT_Y = 220;
const NODE_GAP = 200; // 160px node + 40px gap
const LINE_COLOR = 'rgba(255, 255, 255, 0.12)';
const COS_DROP = 30; // vertical drop from CoS before horizontal branching

export default function OrgBuilder({
  founderName,
  cosName,
  cosAvatarPath,
  departments,
  onAddDepartment,
  onUpdateDepartment,
  onRemoveDepartment,
  onComplete,
}: OrgBuilderProps) {
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | null>(null);
  const [isPresetMode, setIsPresetMode] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [presetDefaults, setPresetDefaults] = useState<{ name: string; headName: string; personality: string } | undefined>(undefined);
  const [cosChatOpen, setCosChatOpen] = useState(false);
  const [cosFeedback, setCosFeedback] = useState<string[]>([]);

  // Calculate SVG dimensions and node positions
  const layout = useMemo(() => {
    const nodeCount = departments.length + 1; // departments + add button
    const totalWidth = nodeCount * NODE_GAP;
    const svgWidth = Math.max(totalWidth + 100, 600);
    const svgHeight = DEPT_Y + NODE_HEIGHT + 60;
    const centerX = svgWidth / 2;
    const startX = centerX - (totalWidth / 2) + NODE_GAP / 2;

    const deptPositions = departments.map((dept, i) => ({
      ...dept,
      x: startX + i * NODE_GAP,
      y: DEPT_Y,
    }));

    const addButtonX = startX + departments.length * NODE_GAP;

    return { svgWidth, svgHeight, centerX, deptPositions, addButtonX };
  }, [departments]);

  const selectedDept = departments.find((d) => d.id === selectedDeptId);

  // Handle adding a department
  const handleAdd = useCallback(async (dept: { name: string; headName: string; personality: string }) => {
    await onAddDepartment(dept);
    setPanelMode(null);
    setSelectedDeptId(null);
    // Request CoS feedback
    fetchCosFeedback(dept.name, dept.headName, dept.personality);
  }, [onAddDepartment]);

  // Handle updating a department
  const handleUpdate = useCallback(async (dept: { name: string; headName: string; personality: string }) => {
    if (!selectedDeptId) return;
    await onUpdateDepartment(selectedDeptId, {
      name: dept.name,
      headName: dept.headName,
      headPersonality: dept.personality,
    });
    setPanelMode(null);
    setSelectedDeptId(null);
  }, [selectedDeptId, onUpdateDepartment]);

  // Handle removing a department
  const handleRemove = useCallback(async () => {
    if (!selectedDeptId) return;
    await onRemoveDepartment(selectedDeptId);
    setPanelMode(null);
    setSelectedDeptId(null);
  }, [selectedDeptId, onRemoveDepartment]);

  // Fetch CoS feedback after department changes (D-16)
  async function fetchCosFeedback(deptName: string, headName: string, personality: string) {
    try {
      const res = await fetch('/onboarding/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'org_feedback',
          phaseNumber: 7,
          data: { departmentName: deptName, headName, personality },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setCosFeedback((prev) => [...prev, data.message]);
          setCosChatOpen(true);
        }
      }
    } catch {
      // Non-critical: CoS feedback is supplementary
    }
  }

  // Click on department node
  function handleDeptClick(deptId: string) {
    setSelectedDeptId(deptId);
    // Check if this is a preset-based department
    const dept = departments.find(d => d.id === deptId);
    const matchesPreset = dept && PRESET_DEPARTMENTS.some(p =>
      p.name.toLowerCase() === dept.name.toLowerCase() || p.id === dept.id
    );
    setIsPresetMode(!!matchesPreset);
    setPanelMode('edit');
  }

  // Click on "Add Department" node — opens preset picker
  function handleAddClick() {
    setSelectedDeptId(null);
    setPanelMode(null);
    setPresetDefaults(undefined);
    setShowPresetPicker(true);
  }

  // Preset card selected — pre-fill and open customization overlay
  function handlePresetSelect(preset: PresetDepartment) {
    setShowPresetPicker(false);
    setPresetDefaults({
      name: preset.name,
      headName: preset.defaultHead,
      personality: preset.defaultPersonality,
    });
    setIsPresetMode(true);
    setPanelMode('create');
  }

  // "Other" / custom department — blank overlay
  function handleCustomDepartment() {
    setShowPresetPicker(false);
    setPresetDefaults(undefined);
    setIsPresetMode(false);
    setPanelMode('create');
  }

  // Check whether a preset is already added
  function isPresetAdded(preset: PresetDepartment): boolean {
    return departments.some(
      (d) =>
        d.id === preset.id ||
        d.name.toLowerCase() === preset.name.toLowerCase()
    );
  }

  // Close detail panel
  function handleClosePanel() {
    setPanelMode(null);
    setSelectedDeptId(null);
    setPresetDefaults(undefined);
  }

  // Build connecting lines for SVG
  function renderLines() {
    const lines: JSX.Element[] = [];

    // CEO to CoS: vertical line
    lines.push(
      <line
        key="ceo-cos"
        x1={layout.centerX}
        y1={CEO_Y + NODE_HEIGHT / 2}
        x2={layout.centerX}
        y2={COS_Y - NODE_HEIGHT / 2}
        stroke={LINE_COLOR}
        strokeWidth={1}
      />
    );

    // CoS to departments: vertical drop, then horizontal, then vertical to each dept
    if (layout.deptPositions.length > 0) {
      const cosBottom = COS_Y + NODE_HEIGHT / 2;
      const branchY = cosBottom + COS_DROP;

      // Vertical drop from CoS
      lines.push(
        <line
          key="cos-drop"
          x1={layout.centerX}
          y1={cosBottom}
          x2={layout.centerX}
          y2={branchY}
          stroke={LINE_COLOR}
          strokeWidth={1}
        />
      );

      // Horizontal span across all departments
      const leftX = layout.deptPositions[0].x;
      const rightX = layout.deptPositions[layout.deptPositions.length - 1].x;

      if (leftX !== rightX) {
        lines.push(
          <line
            key="horizontal"
            x1={Math.min(leftX, layout.centerX)}
            y1={branchY}
            x2={Math.max(rightX, layout.centerX)}
            y2={branchY}
            stroke={LINE_COLOR}
            strokeWidth={1}
          />
        );
      }

      // Vertical drop to each department
      for (const dept of layout.deptPositions) {
        lines.push(
          <line
            key={`dept-drop-${dept.id}`}
            x1={dept.x}
            y1={branchY}
            x2={dept.x}
            y2={DEPT_Y - NODE_HEIGHT / 2}
            stroke={LINE_COLOR}
            strokeWidth={1}
          />
        );
      }
    }

    return lines;
  }

  return (
    <div className="flex w-full h-full min-h-[480px]" style={{ gap: 0 }}>
      {/* SVG tree (full width — detail panel is now an overlay) */}
      <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
        <div className="flex-1 overflow-auto relative">
          <svg
            width="100%"
            height={layout.svgHeight}
            viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
            style={{ display: 'block' }}
          >
            {/* Connecting lines */}
            {renderLines()}

            {/* CEO node */}
            <OrgNode
              x={layout.centerX}
              y={CEO_Y}
              label="CEO"
              sublabel={founderName}
            />

            {/* CoS node */}
            <OrgNode
              x={layout.centerX}
              y={COS_Y}
              label="Chief of Staff"
              sublabel={cosName}
              avatarPath={cosAvatarPath}
            />

            {/* Department nodes */}
            {layout.deptPositions.map((dept) => (
              <OrgNode
                key={dept.id}
                x={dept.x}
                y={dept.y}
                label={dept.name}
                sublabel={dept.headName}
                isSelected={selectedDeptId === dept.id}
                onClick={() => handleDeptClick(dept.id)}
              />
            ))}

            {/* Add Department node */}
            <OrgNode
              x={layout.addButtonX}
              y={DEPT_Y}
              label="Add Department"
              isAddButton
              onClick={handleAddClick}
            />
          </svg>

          {/* Empty state text */}
          {departments.length === 0 && !showPresetPicker && (
            <div
              className="text-center mt-4"
              style={{ fontSize: 14, color: '#94a3b8', maxWidth: 360, margin: '16px auto 0' }}
            >
              Your organization starts here. Add your first department to begin building.
            </div>
          )}

          {/* Preset Department Picker Overlay */}
          {showPresetPicker && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
              onClick={(e) => { if (e.target === e.currentTarget) setShowPresetPicker(false); }}
            >
              <div
                className="rounded-2xl"
                style={{
                  maxWidth: 480,
                  width: '90%',
                  background: 'rgba(12,16,28,0.97)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                    Add Department
                  </span>
                  <button
                    onClick={() => setShowPresetPicker(false)}
                    className="p-1 rounded transition-colors"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Department list */}
                <div className="px-3 pb-3" style={{ maxHeight: 400, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
                  {PRESET_DEPARTMENTS.map((preset) => {
                    const added = isPresetAdded(preset);
                    return (
                      <button
                        key={preset.id}
                        onClick={() => !added && handlePresetSelect(preset)}
                        disabled={added}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                        style={{
                          background: added ? 'transparent' : 'transparent',
                          opacity: added ? 0.35 : 1,
                          cursor: added ? 'default' : 'pointer',
                        }}
                        onMouseEnter={(e) => { if (!added) (e.currentTarget.style.background = 'rgba(255,255,255,0.04)'); }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* Color dot */}
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: added ? 'rgba(255,255,255,0.15)' : preset.color }}
                        />
                        {/* Name + role */}
                        <div className="flex-1 min-w-0">
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                            {preset.name}
                          </span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginLeft: 8 }}>
                            {preset.defaultHead}
                          </span>
                        </div>
                        {/* Description */}
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                          {added ? 'Added' : preset.description}
                        </span>
                      </button>
                    );
                  })}

                  {/* Divider */}
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 12px' }} />

                  {/* Custom option */}
                  <button
                    onClick={handleCustomDepartment}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer"
                    style={{ background: 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0 flex items-center justify-center"
                      style={{ border: '1.5px dashed rgba(255,255,255,0.25)' }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.50)' }}>
                      Custom department...
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Complete button */}
        {departments.length > 0 && (
          <div className="flex justify-center py-4">
            <button
              onClick={onComplete}
              className="px-6 py-2.5 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#38bdf8', fontSize: 14 }}
            >
              Continue
            </button>
          </div>
        )}
      </div>

      {/* Detail Panel (overlay — no longer a side panel) */}
      {panelMode && (
        <OrgDetailPanel
          mode={panelMode}
          isPreset={isPresetMode}
          department={panelMode === 'edit' ? selectedDept : undefined}
          defaults={panelMode === 'create' ? presetDefaults : undefined}
          onSave={panelMode === 'create' ? handleAdd : handleUpdate}
          onRemove={panelMode === 'edit' ? handleRemove : undefined}
          onClose={handleClosePanel}
        />
      )}

      {/* CoS Chat Overlay (bottom-right) */}
      <div className="fixed bottom-6 right-6 z-40" style={{ maxWidth: 320 }}>
        {cosChatOpen && cosFeedback.length > 0 && (
          <div className="glass-card rounded-xl p-4 mb-2" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>{cosName}</span>
              <button
                onClick={() => setCosChatOpen(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Close suggestions"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {cosFeedback.map((msg, i) => (
                <p key={i} style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.5 }}>
                  {msg}
                </p>
              ))}
            </div>
          </div>
        )}
        {!cosChatOpen && cosFeedback.length > 0 && (
          <button
            onClick={() => setCosChatOpen(true)}
            className="glass-card rounded-full p-3 text-sky-400 hover:text-sky-300 transition-colors"
            aria-label="Open CoS suggestions"
          >
            <MessageSquare size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
