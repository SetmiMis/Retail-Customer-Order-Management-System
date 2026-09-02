/** Customer-safe status pill — shows the collapsed step label only, never the
 *  internal workflow state. Hue tracks progress. */
const HUE = ['os-process', 'os-process', 'os-pending', 'os-accent', 'os-success', 'os-success'];

export default function StepPill({ label, index }: { label: string; index: number }) {
  if (index < 0) return <span className="os os-issue">{label || 'Cancelled'}</span>;
  return <span className={`os ${HUE[index] ?? 'os-neutral'}`}>{label}</span>;
}
