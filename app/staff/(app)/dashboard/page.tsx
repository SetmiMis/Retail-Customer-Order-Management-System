'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '../../../../lib/client';
import { ORDER_STATUS } from '../../../../lib/oms/constants';
import PageHeader from '../../../../components/ui/PageHeader';
import Reveal from '../../../../components/fx/Reveal';

const S = ORDER_STATUS;
const TONE: Record<string, string> = { issue: 'var(--hue-issue)', pending: 'var(--hue-pending)', processing: 'var(--hue-processing)', accent: 'var(--accent)', success: 'var(--hue-success)' };

interface Data {
  counts: Record<string, number>;
  today: { newOrders: number; confirmed: number; dispatched: number; completed: number };
  attention: Array<{ key: string; tone: string; label: string; count: number; href: string }>;
  ageing: { orders: { bucket: string; count: number }[]; requirements: { bucket: string; count: number }[] };
}

export default function StaffDashboard() {
  const { data, isLoading } = useSWR<{ ok: boolean } & Data>('/api/staff/dashboard', fetcher, { refreshInterval: 30000 });

  if (isLoading || !data) return <div className="skeleton" style={{ height: 320 }} />;

  const pipe = [
    { label: 'Confirmation pending', n: data.counts[S.CONFIRM_PENDING] || 0, tone: 'pending', href: `/staff/confirmations` },
    { label: 'Quantity check', n: (data.counts[S.CONFIRMED] || 0) + (data.counts[S.QTY_CHECK] || 0), tone: 'processing', href: `/staff/quantity-check` },
    { label: 'Requirement pending', n: (data.counts[S.REQUIREMENT_PENDING] || 0) + (data.counts[S.PARTIAL_AVAILABLE] || 0), tone: 'issue', href: `/staff/requirements` },
    { label: 'Ready for packing', n: data.counts[S.READY_FOR_PACKING] || 0, tone: 'accent', href: `/staff/packing` },
    { label: 'Ready for dispatch', n: data.counts[S.READY_FOR_DISPATCH] || 0, tone: 'accent', href: `/staff/dispatch` },
    { label: 'Completed', n: data.counts[S.COMPLETED] || 0, tone: 'success', href: `/staff/orders?status=${encodeURIComponent(S.COMPLETED)}` },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="What needs action, and what's moving through the pipeline." actions={<Link href="/staff/orders/new" className="btn primary sm">+ Create order</Link>} />

      <div className="kpis">
        {[
          { l: 'New orders today', n: data.today.newOrders, t: 'processing' },
          { l: 'Confirmed today', n: data.today.confirmed, t: 'success' },
          { l: 'Dispatched today', n: data.today.dispatched, t: 'accent' },
          { l: 'Completed today', n: data.today.completed, t: 'success' },
        ].map((k, i) => (
          <Reveal key={k.l} delay={i * 0.04}><div className={`stat ${k.t}`}><div className="v">{k.n}</div><div className="l">{k.l}</div></div></Reveal>
        ))}
      </div>

      <h3 className="sectitle" style={{ marginTop: 24 }}>Pipeline</h3>
      <div className="kpis">
        {pipe.map((t, i) => (
          <Reveal key={t.label} delay={i * 0.04}>
            <Link href={t.href} className={`stat ${t.tone}`} style={{ display: 'block', textDecoration: 'none' }}>
              <div className="v">{t.n}</div><div className="l">{t.label}</div>
            </Link>
          </Reveal>
        ))}
      </div>

      {data.attention.length > 0 && (
        <>
          <h3 className="sectitle" style={{ marginTop: 24 }}>Needs attention <Link href="/staff/attention" style={{ fontSize: 12, fontWeight: 600 }}>view all →</Link></h3>
          <div className="grid gap-2">
            {data.attention.slice(0, 5).map((a) => (
              <Link key={a.key} href={a.href} className="attn-row">
                <span className="attn-dot" style={{ background: TONE[a.tone], color: TONE[a.tone] }} />
                <span style={{ flex: 1, fontWeight: 600 }}>{a.label}</span>
                <span className="brand-heading" style={{ fontSize: 18, color: TONE[a.tone] }}>{a.count}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
