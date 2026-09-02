'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, postJSON } from '../../../../lib/client';
import { ORDER_STATUS } from '../../../../lib/oms/constants';
import { useToast } from '../../../../components/ui/ToastProvider';
import PageHeader from '../../../../components/ui/PageHeader';
import StatusBadge from '../../../../components/ui/StatusBadge';

function Queue() {
  const { data, isLoading } = useSWR<{ orders: Array<{ orderId: string; customerName: string; status: string; createdAt: string }> }>('/api/staff/orders', fetcher);
  const orders = (data?.orders ?? []).filter((o) => o.status === ORDER_STATUS.FINAL_VERIFICATION);
  return (
    <div>
      <PageHeader title="Final verification" subtitle={`${orders.length} order(s)`} />
      {isLoading ? <div className="skeleton" style={{ height: 160 }} /> : orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nothing to verify.</div>
      ) : (
        <div className="tablecard"><table>
          <thead><tr><th>Order</th><th>Customer</th><th>Created</th><th>Status</th></tr></thead>
          <tbody>{orders.map((o) => (
            <tr key={o.orderId} onClick={() => { location.href = `/staff/verification?order=${o.orderId}`; }}>
              <td><strong>{o.orderId}</strong></td><td>{o.customerName}</td><td>{o.createdAt}</td><td><StatusBadge status={o.status} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

interface Check { key: string; passed: boolean }

function VerifyDetail({ orderId }: { orderId: string }) {
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR<{ ok: boolean; customerName: string; deliverySnapshot: string; items: Array<{ productName: string; orderedQty: number; packedQty: number; unit: string }>; checks: Check[] }>(`/api/staff/orders/${orderId}/verification`, fetcher);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.checks) setChecks(Object.fromEntries(data.checks.map((c) => [c.key, c.passed])));
  }, [data?.checks]);

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (!data?.ok) return <div className="card">Order not found.</div>;

  async function save() {
    setBusy(true);
    const r = await postJSON(`/api/staff/orders/${orderId}/verification`, { checks: data!.checks.map((c) => ({ key: c.key, passed: !!checks[c.key] })) });
    setBusy(false);
    r.ok ? (toast.success(r.msg || 'Saved.'), mutate()) : toast.error(r.msg || 'Failed.');
  }

  const allPass = data.checks.every((c) => checks[c.key]);

  return (
    <div>
      <Link href="/staff/verification" style={{ fontSize: 13, color: 'var(--muted)' }}>← Queue</Link>
      <PageHeader title={`Final verification — ${orderId}`} subtitle={data.customerName} actions={<Link href={`/staff/orders/${orderId}`} className="btn ghost sm">Order detail</Link>} />

      <div className="grid2">
        <div className="card">
          <h4 className="brand-heading" style={{ fontSize: 14, marginTop: 0 }}>Checklist</h4>
          {data.checks.map((c) => (
            <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 14 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={!!checks[c.key]} onChange={(e) => setChecks((p) => ({ ...p, [c.key]: e.target.checked }))} />
              {c.key}
            </label>
          ))}
          <button className="btn primary" style={{ marginTop: 10 }} disabled={busy} onClick={save}>
            {busy ? 'Saving…' : allPass ? 'Verify → ready for dispatch' : 'Save (all 7 must pass)'}
          </button>
        </div>
        <div className="card">
          <h4 className="brand-heading" style={{ fontSize: 14, marginTop: 0 }}>Order</h4>
          <div style={{ fontSize: 13, whiteSpace: 'pre-line', color: 'var(--muted)', marginBottom: 10 }}>{data.deliverySnapshot}</div>
          {data.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
              <span>{it.productName}</span><span style={{ color: 'var(--muted)' }}>packed {it.packedQty}/{it.orderedQty} {it.unit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const order = useSearchParams().get('order');
  return order ? <VerifyDetail orderId={order} /> : <Queue />;
}
export default function VerificationPage() {
  return <Suspense><Inner /></Suspense>;
}
