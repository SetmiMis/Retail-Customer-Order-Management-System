'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '../../../../lib/client';
import StepPill from '../../../../components/portal/StepPill';
import Reveal from '../../../../components/fx/Reveal';

interface Row { orderId: string; createdAt: string; stepLabel: string; stepIndex: number; itemCount: number }

export default function MyOrdersPage() {
  const { data, isLoading } = useSWR<{ orders: Row[] }>('/api/portal/orders', fetcher);
  const orders = data?.orders ?? [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="brand-heading" style={{ fontSize: 24, margin: 0 }}>My orders</h1>
        <Link href="/portal/catalog" className="btn primary shine">+ New order</Link>
      </div>

      {isLoading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}</div>
      ) : orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 44 }}>
          <p style={{ color: 'var(--muted)', margin: '0 0 14px' }}>No orders yet.</p>
          <Link href="/portal/catalog" className="btn primary">Place your first order</Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {orders.map((o, i) => (
            <Reveal key={o.orderId} delay={Math.min(i * 0.04, 0.3)}>
              <Link href={`/portal/orders/${o.orderId}`} className="card lift" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{o.orderId}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{o.createdAt} · {o.itemCount} item(s)</div>
                </div>
                <StepPill label={o.stepLabel} index={o.stepIndex} />
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
