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
  const orders = (data?.orders ?? []).filter((o) => o.status === ORDER_STATUS.READY_FOR_PACKING || o.status === ORDER_STATUS.PACKING);
  return (
    <div>
      <PageHeader title="Packing queue" subtitle={`${orders.length} order(s)`} />
      {isLoading ? <div className="skeleton" style={{ height: 160 }} /> : orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nothing to pack.</div>
      ) : (
        <div className="tablecard"><table>
          <thead><tr><th>Order</th><th>Customer</th><th>Created</th><th>Status</th></tr></thead>
          <tbody>{orders.map((o) => (
            <tr key={o.orderId} onClick={() => { location.href = `/staff/packing?order=${o.orderId}`; }}>
              <td><strong>{o.orderId}</strong></td><td>{o.customerName}</td><td>{o.createdAt}</td><td><StatusBadge status={o.status} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

interface PLine { lineNo: number; productName: string; expectedQty: number; packedQty: number; verified: boolean }

function PackDetail({ orderId }: { orderId: string }) {
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR<{ ok: boolean; status: string; customerName: string; lines: PLine[] }>(`/api/staff/orders/${orderId}/packing`, fetcher);
  const [rows, setRows] = useState<Record<number, { packedQty: string; verified: boolean }>>({});
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!data?.lines) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(Object.fromEntries(data.lines.map((l) => [l.lineNo, { packedQty: String(l.packedQty || l.expectedQty), verified: l.verified }])));
  }, [data?.lines]);

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (!data?.ok) return <div className="card">Order not found.</div>;

  const needsStart = data.status === ORDER_STATUS.READY_FOR_PACKING;

  async function start() {
    setBusy('start');
    const r = await postJSON(`/api/staff/orders/${orderId}/packing`, { action: 'start' });
    setBusy('');
    r.ok ? mutate() : toast.error(r.msg || 'Failed.');
  }
  async function save() {
    setBusy('save');
    const lines = data!.lines.map((l) => ({ lineNo: l.lineNo, packedQty: Number(rows[l.lineNo]?.packedQty || 0), verified: !!rows[l.lineNo]?.verified }));
    const r = await postJSON(`/api/staff/orders/${orderId}/packing`, { action: 'save', lines });
    setBusy('');
    r.ok ? (toast.success(r.msg || 'Saved.'), mutate()) : toast.error(r.msg || 'Failed.');
  }

  return (
    <div>
      <Link href="/staff/packing" style={{ fontSize: 13, color: 'var(--muted)' }}>← Queue</Link>
      <PageHeader title={`Packing — ${orderId}`} subtitle={data.customerName} actions={<Link href={`/staff/orders/${orderId}`} className="btn ghost sm">Order detail</Link>} />
      {needsStart ? (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <p style={{ color: 'var(--muted)' }}>Start packing to generate the checklist.</p>
          <button className="btn primary" disabled={!!busy} onClick={start}>Start packing</button>
        </div>
      ) : (
        <>
          <div className="tablecard"><table>
            <thead><tr><th>Product</th><th>Expected</th><th>Packed</th><th>Verified</th></tr></thead>
            <tbody>{data.lines.map((l) => (
              <tr key={l.lineNo}>
                <td>{l.productName}</td>
                <td>{l.expectedQty}</td>
                <td><input style={{ width: 80 }} inputMode="numeric" value={rows[l.lineNo]?.packedQty ?? ''} onChange={(e) => setRows((p) => ({ ...p, [l.lineNo]: { ...p[l.lineNo], packedQty: e.target.value } }))} /></td>
                <td><input type="checkbox" style={{ width: 'auto' }} checked={!!rows[l.lineNo]?.verified} onChange={(e) => setRows((p) => ({ ...p, [l.lineNo]: { ...p[l.lineNo], verified: e.target.checked } }))} /></td>
              </tr>
            ))}</tbody>
          </table></div>
          <button className="btn primary" style={{ marginTop: 14 }} disabled={!!busy} onClick={save}>
            {busy === 'save' ? 'Saving…' : 'Save packing (all verified → final verification)'}
          </button>
        </>
      )}
    </div>
  );
}

function Inner() {
  const order = useSearchParams().get('order');
  return order ? <PackDetail orderId={order} /> : <Queue />;
}
export default function PackingPage() {
  return <Suspense><Inner /></Suspense>;
}
