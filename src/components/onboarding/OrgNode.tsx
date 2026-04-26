'use client';

/**
 * OrgNode — individual node rendering for the org builder SVG tree.
 *
 * Renders via SVG <foreignObject> to embed HTML (glass-card styling) inside SVG.
 * Per UI-SPEC Screen 5: 160x48px nodes with glass-card background.
 */

import { Plus } from 'lucide-react';

export interface OrgNodeProps {
  label: string;
  sublabel?: string;
  isSelected?: boolean;
  isAddButton?: boolean;
  avatarPath?: string;
  onClick?: () => void;
  x: number;
  y: number;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 48;

export default function OrgNode({
  label,
  sublabel,
  isSelected = false,
  isAddButton = false,
  avatarPath,
  onClick,
  x,
  y,
}: OrgNodeProps) {
  return (
    <foreignObject
      x={x - NODE_WIDTH / 2}
      y={y - NODE_HEIGHT / 2}
      width={NODE_WIDTH}
      height={NODE_HEIGHT}
      style={{ overflow: 'visible' }}
    >
      <div
        onClick={onClick}
        style={{
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          background: isAddButton ? 'transparent' : 'rgba(10, 18, 40, 0.52)',
          backdropFilter: isAddButton ? 'none' : 'blur(12px) saturate(140%) brightness(1.05)',
          border: isAddButton
            ? '1.5px dashed rgba(255, 255, 255, 0.20)'
            : isSelected
              ? '2px solid #38bdf8'
              : '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          cursor: onClick ? 'pointer' : 'default',
          boxShadow: isSelected
            ? '0 0 0 2px rgba(56, 189, 248, 0.3)'
            : '0 4px 16px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25)',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        }}
      >
        {isAddButton ? (
          <>
            <Plus size={16} color="#38bdf8" />
            <span style={{ fontSize: 14, fontWeight: 400, color: '#38bdf8' }}>
              Add Department
            </span>
          </>
        ) : (
          <>
            {avatarPath && (
              <img
                src={avatarPath}
                alt=""
                style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }}
              />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {label}
              </div>
              {sublabel && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    color: '#94a3b8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {sublabel}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </foreignObject>
  );
}

export { NODE_WIDTH, NODE_HEIGHT };
