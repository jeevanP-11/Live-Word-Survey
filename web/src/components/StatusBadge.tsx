interface StatusBadgeProps {
  status: 'active' | 'closed';
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const isActive = status === 'active';
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wide ${
        isActive ? 'border-signal/50 text-signal' : 'border-mute/50 text-mute'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${isActive ? 'bg-signal pulse-dot' : 'bg-mute'}`}
        aria-hidden="true"
      />
      {isActive ? 'Live' : 'Closed'}
    </span>
  );
}
