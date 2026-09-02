'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';
import { fetcher, postJSON } from '../../../../../lib/client';
import { useToast } from '../../../../../components/ui/ToastProvider';
import { celebrate } from '../../../../../lib/fx/confetti';

const STEPS = ['Order Received', 'Order Confirmed', 'Preparing', 'Packing', 'Dispatched', 'Completed'];

interface View {
  orderId: string; createdAt: string; status: string; stepLabel: string; stepIndex: number;
  itemCount: number; customerRemark: string; deliverySnapshot: string;
  items: Array<{ productName: string; unit: string; orderedQty: number }>;
  arrangingItems: boolean;
}

export default function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const isNew = useSearchParams().get('new') === '1';
  const { data, isLoading } = useSWR<{ ok: boolean; order?: View }>(`/api/portal/orders/${id}`, fetcher, { refreshInterval: 20000 });
  const o = data?.order;

  useEffect(() => {
    if (isNew) celebrate();
  }, [isNew]);

  async function reorder() {
    const res = await postJSON(`/api/portal/orders/${id}/reorder`);
    if (!res.ok) return toast.error(res.msg || 'Could not re-order.');
    toast.success(`New order ${res.orderId} placed.`);
    router.push(`/portal/orders/${res.orderId}?new=1`);
  }

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 160 }} /></div>;
  if (!o) return <div className="card" style={{ padding: 40, textAlign: 'center' }}>Order not found. <Link href="/portal/orders" style={{ color: 'var(--accent)' }}>Back to my orders</Link></div>;

  const cancelled = o.status === 'Cancelled';

  return (
    <div style={{ maxWidth: 680 }}>
      <Link href="/portal/orders" style={{ fontSize: 13, color: 'var(--muted)' }}>← My orders</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', margin: '8px 0 20px' }}>
        <div>
          <h1 className="brand-heading" style={{ fontSize: 24, margin: 0 }}>{o.orderId}</h1>
          <p className="tagline" style={{ margin: '2px 0 0' }}>{o.createdAt} · {o.itemCount} item(s)</p>
        </div>
        <button className="btn ghost sm" onClick={reorder}><RefreshCw size={14} /> Re-order</button>
      </div>

      {cancelled ? (
        <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontWeight: 700 }}>This order was cancelled.</div>
      ) : (
        <div className="card">
          <div className="stepper">
            {STEPS.map((label, i) => {
              const state = i < o.stepIndex ? 'done' : i === o.stepIndex ? 'active' : '';
              return (
                <div key={label} className={`step ${state}`}>
                  <div className="bar" />
                  <div className="dot">{i < o.stepIndex ? '✓' : i + 1}</div>
                  <div className="cap">{label}</div>
                </div>
              );
            })}
          </div>
          {o.arrangingItems && (
            <p style={{ marginTop: 18, fontSize: 13, color: 'var(--hue-pending)', fontWeight: 600 }}>
              Some items are currently being arranged. We&apos;ll move your order forward as soon as they&apos;re available.
            </p>
          )}
        </div>
      )}

      <h2 className="brand-heading" style={{ fontSize: 16, margin: '24px 0 10px' }}>Items</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {o.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < o.items.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <span style={{ fontWeight: 600 }}>{it.productName}</span>
            <span style={{ color: 'var(--muted)' }}>{it.orderedQty} {it.unit}</span>
          </div>
        ))}
      </div>

      {o.customerRemark && (
        <>
          <h2 className="brand-heading" style={{ fontSize: 16, margin: '24px 0 8px' }}>Your remark</h2>
          <div className="card" style={{ fontSize: 13 }}>{o.customerRemark}</div>
        </>
      )}
      {o.deliverySnapshot && (
        <>
          <h2 className="brand-heading" style={{ fontSize: 16, margin: '24px 0 8px' }}>Delivery</h2>
          <div className="card" style={{ fontSize: 13, whiteSpace: 'pre-line' }}>{o.deliverySnapshot}</div>
        </>
      )}
    </div>
  );
}
