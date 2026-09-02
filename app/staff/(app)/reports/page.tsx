'use client';

import useSWR from 'swr';
import { fetcher } from '../../../../lib/client';
import PageHeader from '../../../../components/ui/PageHeader';
import Reveal from '../../../../components/fx/Reveal';

interface Bundle {
  totals: { orders: number; open: number; completed: number; cancelled: number; pending: number };
  byStatus: { label: string; count: number }[];
  bySource: { label: string; count: number }[];
  byMonth: { label: string; count: number }[];
  topCustomers: { name: string; orders: number }[];
  demand: { topProducts: { name: string; qty: number }[]; frequentlyShort: { name: string; times: number }[] };
  requirements: { open: number; satisfied: number; byStatus: { label: string; count: number }[] };
}

function Bar({ rows, unit }: { rows: Array<{ label: string; value: number }>; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="funnel">
      {rows.map((r, i) => (
        <div className="frow" key={r.label + i}>
          <div className="flab" title={r.label}>{r.label}</div>
          <div className="fbar" style={{ width: `${Math.max(8, (r.value / max) * 100)}%` }}>{r.value}{unit ? ` ${unit}` : ''}</div>
        </div>
      ))}
    </div>
  );
}
const asBar = <T,>(rows: T[], label: (r: T) => string, value: (r: T) => number) => rows.map((r) => ({ label: label(r), value: value(r) }));

export default function ReportsPage() {
  const { data, isLoading } = useSWR<{ ok: boolean } & Bundle>('/api/staff/reports', fetcher);

  if (isLoading || !data) return <div className="skeleton" style={{ height: 320 }} />;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Operational only — no revenue, price or margin (rates live outside this system)." />

      <div className="kpis">
        <div className="stat"><div className="v">{data.totals.orders}</div><div className="l">Total orders</div></div>
        <div className="stat processing"><div className="v">{data.totals.open}</div><div className="l">Open</div></div>
        <div className="stat pending"><div className="v">{data.totals.pending}</div><div className="l">Confirmation pending</div></div>
        <div className="stat success"><div className="v">{data.totals.completed}</div><div className="l">Completed</div></div>
        <div className="stat issue"><div className="v">{data.totals.cancelled}</div><div className="l">Cancelled</div></div>
      </div>

      <div className="grid2" style={{ marginTop: 20 }}>
        <Reveal><div className="card"><h4 className="brand-heading" style={{ marginTop: 0, fontSize: 14 }}>Orders by status</h4><Bar rows={asBar(data.byStatus, (r) => r.label, (r) => r.count)} /></div></Reveal>
        <Reveal delay={0.05}><div className="card"><h4 className="brand-heading" style={{ marginTop: 0, fontSize: 14 }}>Orders by source</h4><Bar rows={asBar(data.bySource, (r) => r.label, (r) => r.count)} /></div></Reveal>
        <Reveal delay={0.1}><div className="card"><h4 className="brand-heading" style={{ marginTop: 0, fontSize: 14 }}>Orders by month</h4><Bar rows={asBar(data.byMonth, (r) => r.label, (r) => r.count)} /></div></Reveal>
        <Reveal delay={0.15}><div className="card"><h4 className="brand-heading" style={{ marginTop: 0, fontSize: 14 }}>Top customers</h4><Bar rows={asBar(data.topCustomers, (r) => r.name, (r) => r.orders)} unit="orders" /></div></Reveal>
        <Reveal delay={0.2}><div className="card"><h4 className="brand-heading" style={{ marginTop: 0, fontSize: 14 }}>Product demand (qty ordered)</h4><Bar rows={asBar(data.demand.topProducts, (r) => r.name, (r) => r.qty)} /></div></Reveal>
        <Reveal delay={0.25}><div className="card"><h4 className="brand-heading" style={{ marginTop: 0, fontSize: 14 }}>Frequently unavailable</h4>{data.demand.frequentlyShort.length ? <Bar rows={asBar(data.demand.frequentlyShort, (r) => r.name, (r) => r.times)} unit="×" /> : <p style={{ color: 'var(--muted)', fontSize: 13 }}>None yet.</p>}</div></Reveal>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h4 className="brand-heading" style={{ marginTop: 0, fontSize: 14 }}>Requirements</h4>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14 }}>
          <div><strong style={{ fontSize: 22 }}>{data.requirements.open}</strong><div className="l">Open</div></div>
          <div><strong style={{ fontSize: 22 }}>{data.requirements.satisfied}</strong><div className="l">Satisfied</div></div>
          {data.requirements.byStatus.map((s) => <div key={s.label}><strong style={{ fontSize: 22 }}>{s.count}</strong><div className="l">{s.label}</div></div>)}
        </div>
      </div>
    </div>
  );
}
