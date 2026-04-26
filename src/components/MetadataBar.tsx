interface MetadataBarProps {
  deliverableId: string;
  creatorId: string | null;
  department: string;
  type: string | null;
  createdAt: string;
  taskDescription: string | null;
}

const DEPT_BADGE_CLASS: Record<string, string> = {
  tech: 'badge-tech',
  marketing: 'badge-marketing',
  operations: 'badge-ops',
};

function shortenId(id: string): string {
  return id.length > 10 ? id.slice(0, 8) + '...' : id;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

export default function MetadataBar({
  deliverableId,
  creatorId,
  department,
  type,
  createdAt,
  taskDescription,
}: MetadataBarProps) {
  return (
    <div className="metadata-bar">
      <span>
        ID: <strong>{shortenId(deliverableId)}</strong>
      </span>
      {creatorId && (
        <span>
          Creator: <strong>{creatorId}</strong>
        </span>
      )}
      <span className={`badge ${DEPT_BADGE_CLASS[department] || ''}`}>
        {department}
      </span>
      {type && (
        <span className="badge badge-pending">
          {type}
        </span>
      )}
      <span>{formatDate(createdAt)}</span>
      {taskDescription && (
        <span style={{ flex: 1, textAlign: 'right' }}>
          {truncate(taskDescription, 80)}
        </span>
      )}
    </div>
  );
}
