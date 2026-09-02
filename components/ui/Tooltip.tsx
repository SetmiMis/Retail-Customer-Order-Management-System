export default function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="tooltip-wrap">
      {children}
      <span className="tooltip-bubble" role="tooltip">{label}</span>
    </span>
  );
}
