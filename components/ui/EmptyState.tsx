export default function EmptyState({
  icon = '🗂️', title, description, actions,
}: {
  icon?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="state-block">
      <div className="state-icon" aria-hidden>{icon}</div>
      <div className="state-title">{title}</div>
      {description && <div className="state-desc">{description}</div>}
      {actions && <div className="state-actions">{actions}</div>}
    </div>
  );
}
