import { StatusBadge } from '../status-badge';

export default function StatusBadgeExample() {
  return (
    <div className="flex flex-wrap gap-4">
      <StatusBadge status="compliant" />
      <StatusBadge status="non-compliant" />
      <StatusBadge status="in-progress" />
      <StatusBadge status="not-assessed" />
    </div>
  );
}