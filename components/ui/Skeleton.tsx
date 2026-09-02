import { cn } from '../../lib/utils/cn';

export default function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skeleton', className)} style={{ height: 16, ...style }} />;
}

/** A skeleton shaped like the KPI tile grid, shown while a dashboard-style page loads. */
export function KpiSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="kpis">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi">
          <Skeleton style={{ height: 30, width: '60%', marginBottom: 10 }} />
          <Skeleton style={{ height: 12, width: '80%' }} />
        </div>
      ))}
    </div>
  );
}

/** A skeleton shaped like a data table, shown while a list page loads. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="tablecard">
      <table>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((__, c) => (
                <td key={c}><Skeleton style={{ width: c === 0 ? '70%' : '90%' }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
