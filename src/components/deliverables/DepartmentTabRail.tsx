'use client';

interface DepartmentTabRailProps {
  departments: string[];
  active: string;
  onSelect: (dept: string) => void;
}

const DEPT_ACTIVE: Record<string, { bg: string; border: string; glow: string }> = {
  tech:       { bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.30)', glow: '0 0 12px rgba(56,189,248,0.10)' },
  marketing:  { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.30)', glow: '0 0 12px rgba(167,139,250,0.10)' },
  operations: { bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.30)', glow: '0 0 12px rgba(52,211,153,0.10)' },
};

export default function DepartmentTabRail({ departments, active, onSelect }: DepartmentTabRailProps) {
  const allTabs = ['all', ...departments];

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl shrink-0"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {allTabs.map((dept) => {
        const isActive = active === dept;
        const label = dept === 'all' ? 'All' : dept.charAt(0).toUpperCase() + dept.slice(1);
        const activeStyle = DEPT_ACTIVE[dept] ?? { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', glow: 'none' };

        return (
          <button
            key={dept}
            onClick={() => onSelect(dept)}
            className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
              isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
            style={isActive ? {
              background: activeStyle.bg,
              border: `1px solid ${activeStyle.border}`,
              boxShadow: activeStyle.glow,
            } : {
              background: 'transparent',
              border: '1px solid transparent',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
