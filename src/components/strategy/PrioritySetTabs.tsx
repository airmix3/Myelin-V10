'use client';

interface PrioritySet {
  id: string;
  name: string;
  color: string | null;
  directionIds: string[];
}

interface PrioritySetTabsProps {
  sets: PrioritySet[];
  activeSetId: string | null;
  onSetSelect: (setId: string | null) => void;
}

export default function PrioritySetTabs({
  sets,
  activeSetId,
  onSetSelect,
}: PrioritySetTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {/* "All" tab -- always first */}
      <button
        onClick={() => onSetSelect(null)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
          activeSetId === null
            ? 'glass-deep text-white border-b-2 border-purple-500'
            : 'text-white/50 hover:text-white/70'
        }`}
      >
        All
      </button>

      {sets.map((set) => {
        const isActive = activeSetId === set.id;
        const dotColor = set.color || '#8b5cf6';

        return (
          <button
            key={set.id}
            onClick={() => onSetSelect(set.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              isActive
                ? 'glass-deep text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
            style={isActive ? { borderBottom: `2px solid ${dotColor}` } : undefined}
          >
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: dotColor }}
            />
            {set.name}
          </button>
        );
      })}

      {/* Manage Sets placeholder */}
      <button
        disabled
        className="text-xs text-white/30 px-2 py-1 whitespace-nowrap cursor-not-allowed"
        title="Coming soon"
      >
        Manage Sets
      </button>
    </div>
  );
}
