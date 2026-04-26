'use client';

import {
  Palette,
  FileText,
  Code,
  Megaphone,
  Scale,
  Users,
  Settings,
  Brain,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategorySidebarProps {
  categories: Record<string, boolean>; // category name -> has items
  activeCategory?: string;
  onCategoryClick?: (category: string) => void;
}

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

interface CategoryDef {
  name: string;
  icon: LucideIcon;
}

const CATEGORY_DEFS: CategoryDef[] = [
  { name: 'Brand & Identity', icon: Palette },
  { name: 'Documents & Strategy', icon: FileText },
  { name: 'Code & Technical', icon: Code },
  { name: 'Content & Marketing', icon: Megaphone },
  { name: 'Financial & Legal', icon: Scale },
  { name: 'Customer & Market', icon: Users },
  { name: 'Operational', icon: Settings },
  { name: 'Domain Knowledge', icon: Brain },
];

// ---------------------------------------------------------------------------
// CategorySidebar Component
// ---------------------------------------------------------------------------

export default function CategorySidebar({
  categories,
  activeCategory,
  onCategoryClick,
}: CategorySidebarProps) {
  return (
    <div
      className="glass-panel h-full flex flex-col py-4"
      style={{
        background: 'rgba(10,18,40,0.52)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
      }}
    >
      <div
        className="px-4 pb-3"
        style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}
      >
        ASSET CATEGORIES
      </div>

      <div className="flex flex-col gap-0.5">
        {CATEGORY_DEFS.map((cat) => {
          const Icon = cat.icon;
          const hasItems = categories[cat.name] === true;
          const isActive = activeCategory === cat.name;

          return (
            <button
              key={cat.name}
              onClick={() => onCategoryClick?.(cat.name)}
              className="flex items-center gap-3 px-4 py-2.5 text-left transition-all hover:brightness-125 cursor-pointer"
              style={{
                borderLeft: isActive
                  ? '3px solid #38bdf8'
                  : '3px solid transparent',
                background: isActive
                  ? 'rgba(56,189,248,0.06)'
                  : 'transparent',
              }}
            >
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: isActive ? '#38bdf8' : '#94a3b8' }}
              />
              <span
                className="flex-1 truncate"
                style={{
                  fontSize: '11px',
                  fontWeight: 400,
                  color: isActive ? '#e2e8f0' : '#94a3b8',
                }}
              >
                {cat.name}
              </span>
              {/* Status indicator */}
              {hasItems ? (
                <Check
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: '#10b981' }}
                />
              ) : (
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{
                    border: '1.5px solid rgba(255,255,255,0.2)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
