'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { motion } from 'motion/react';
import { ChevronLeft, RefreshCw, Package, MapPin, MessageSquareText, Truck } from 'lucide-react';
import { fetcher, postJSON } from '../../../../../lib/client';
import { useToast } from '../../../../../components/ui/ToastProvider';
import { celebrate } from '../../../../../lib/fx/confetti';

interface View {
  orderId: string; createdAt: string; status: string; stepLabel: string; stepIndex: number;
  itemCount: number; customerRemark: string; deliverySnapshot: string;
  items: Array<{ productName: string; unit: string; orderedQty: number; dispatchedQty: number }>;
  arrangingItems: boolean;
  dispatch: { transporter: string; awbLrNo: string; vehicleNo: string; date: string } | null;
}

/** 6 customer-facing steps, each with a friendly line. */
const STEPS: Array<{ label: string; blurb: string }> = [
  { label: 'Order received', blurb: "We've got your order. Our team will share the rate with you shortly." },
  { label: 'Order confirmed', blurb: 'Rate agreed — we are now checking availability for your items.' },
  { label: 'Preparing', blurb: 'Your items are being gathered and readied.' },
  { label: 'Packing', blurb: 'Your order is being packed and checked.' },
  { label: 'Dispatched', blurb: 'Your order is on its way.' },
  { label: 'Completed', blurb: 'Delivered. Thank you for ordering with us!' },
];

const ease = [0.16, 1, 0.3, 1] as const;

export default function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const isNew = useSearchParams().get('new') === '1';
  const { data, isLoading } = useSWR<{ ok: boolean; order?: View }>(
    `/api/portal/orders/${id}`,
    fetcher,
    { refreshInterval: 20000 },
  );
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

  if (isLoading) {
    return (
      <div style={{ maxWidth: 620, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div className="skeleton" style={{ height: 150, borderRadius: 'var(--radius)' }} />
        <div className="skeleton" style={{ height: 260, borderRadius: 'var(--radius)' }} />
      </div>
    );
  }
  if (!o) {
    return (
      <div className="card" style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center', padding: 44 }}>
        <p style={{ color: 'var(--muted)', margin: '0 0 14px' }}>We couldn&apos;t find that order.</p>
        <Link href="/portal/orders" className="btn primary">Back to my orders</Link>
      </div>
    );
  }

  const cancelled = o.status === 'Cancelled' || o.stepIndex < 0;
  const current = STEPS[o.stepIndex] ?? STEPS[0];
  const pct = cancelled ? 0 : Math.round((o.stepIndex / (STEPS.length - 1)) * 100);

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Link
        href="/portal/orders"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}
      >
        <ChevronLeft size={15} /> My orders
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', margin: '10px 0 18px' }}>
        <div>
          <h1 className="brand-heading" style={{ fontSize: 24, margin: 0, letterSpacing: '0.3px' }}>{o.orderId}</h1>
          <p className="tagline" style={{ margin: '3px 0 0' }}>Placed {o.createdAt} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}</p>
        </div>
        <button className="btn ghost sm" onClick={reorder}>
          <RefreshCw size={14} /> Re-order
        </button>
      </div>

      {/* Status hero */}
      <motion.div
        className="otrack-hero"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        style={cancelled ? { background: 'color-mix(in srgb, var(--hue-issue) 10%, var(--card))' } : undefined}
      >
        <div className="eyebrow" style={cancelled ? { color: 'var(--hue-issue)' } : undefined}>
          {cancelled ? 'Cancelled' : `Step ${o.stepIndex + 1} of ${STEPS.length}`}
        </div>
        <h2>{cancelled ? 'This order was cancelled' : current.label}</h2>
        <p>
          {cancelled
            ? 'If this looks wrong, please get in touch and we will sort it out.'
            : current.blurb}
        </p>

        {!cancelled && (
          <div className="otrack-meter" aria-label={`${pct}% complete`}>
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(pct, 6)}%` }}
              transition={{ duration: 0.7, ease, delay: 0.15 }}
            />
          </div>
        )}

        {o.arrangingItems && !cancelled && (
          <div className="otrack-arranging">
            <span aria-hidden>⏳</span>
            <span>Some items are currently being arranged. We&apos;ll move your order forward as soon as they&apos;re available.</span>
          </div>
        )}
      </motion.div>

      {/* Vertical timeline */}
      {!cancelled && (
        <div className="card" style={{ marginTop: 14 }}>
          <ol className="vtl">
            {STEPS.map((s, i) => {
              const state = i < o.stepIndex ? 'done' : i === o.stepIndex ? 'current' : '';
              return (
                <li key={s.label} className={state}>
                  <span className="node" aria-hidden>{i < o.stepIndex ? '✓' : i + 1}</span>
                  <div className="lbl">{s.label}</div>
                  {(state === 'current') && <div className="sub">{s.blurb}</div>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Items */}
      <SectionHeading icon={<Package size={15} />} text={`Items (${o.itemCount})`} />
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {o.items.map((it, i) => (
          <div
            key={i}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              padding: '13px 16px', borderBottom: i < o.items.length - 1 ? '1px solid var(--line)' : 'none',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>{it.productName}</span>
            <span style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>
              {it.dispatchedQty > 0 && it.dispatchedQty < it.orderedQty
                ? `${it.dispatchedQty} of ${it.orderedQty} ${it.unit} dispatched`
                : `${it.orderedQty} ${it.unit}`}
            </span>
          </div>
        ))}
      </div>

      {o.dispatch && (o.dispatch.transporter || o.dispatch.awbLrNo || o.dispatch.vehicleNo) && (
        <>
          <SectionHeading icon={<Truck size={15} />} text="Shipment" />
          <div className="card" style={{ fontSize: 13, color: 'var(--muted)', display: 'grid', gap: 4 }}>
            {o.dispatch.date && <div><b style={{ color: 'var(--ink)' }}>Dispatched</b> {o.dispatch.date}</div>}
            {o.dispatch.transporter && <div><b style={{ color: 'var(--ink)' }}>Via</b> {o.dispatch.transporter}</div>}
            {o.dispatch.awbLrNo && <div><b style={{ color: 'var(--ink)' }}>Tracking / LR</b> {o.dispatch.awbLrNo}</div>}
            {o.dispatch.vehicleNo && <div><b style={{ color: 'var(--ink)' }}>Vehicle</b> {o.dispatch.vehicleNo}</div>}
          </div>
        </>
      )}

      {o.deliverySnapshot && (
        <>
          <SectionHeading icon={<MapPin size={15} />} text="Delivery" />
          <div className="card" style={{ fontSize: 13, whiteSpace: 'pre-line', color: 'var(--muted)', lineHeight: 1.6 }}>
            {o.deliverySnapshot}
          </div>
        </>
      )}

      {o.customerRemark && (
        <>
          <SectionHeading icon={<MessageSquareText size={15} />} text="Your remark" />
          <div className="card" style={{ fontSize: 13, color: 'var(--muted)' }}>“{o.customerRemark}”</div>
        </>
      )}

      <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--muted)', margin: '22px 0 0' }}>
        Rate for this order is confirmed separately by our team — no price is shown here.
      </p>
    </div>
  );
}

function SectionHeading({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <h2
      className="brand-heading"
      style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, margin: '24px 0 10px', color: 'var(--ink)' }}
    >
      <span style={{ color: 'var(--accent)' }}>{icon}</span>
      {text}
    </h2>
  );
}
