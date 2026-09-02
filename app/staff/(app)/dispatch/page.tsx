'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, postJSON } from '../../../../lib/client';
import { ORDER_STATUS } from '../../../../lib/oms/constants';
import { useToast } from '../../../../components/ui/ToastProvider';
import PageHeader from '../../../../components/ui/PageHeader';
import StatusBadge from '../../../../components/ui/StatusBadge';
import { celebrate } from '../../../../lib/fx/confetti';

function Queue() {
  const { data, isLoading } = useSWR<{ orders: Array<{ orderId: string; customerName: string; status: string; createdAt: string }> }>('/api/staff/orders', fetcher);
  const orders = (data?.orders ?? []).filter((o) => o.status === ORDER_STATUS.READY_FOR_DISPATCH || o.status === ORDER_STATUS.DISPATCHED);
  return (
    <div>
      <PageHeader title="Dispatch queue" subtitle={`${orders.length} order(s)`} />
      {isLoading ? <div className="skeleton" style={{ height: 160 }} /> : orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nothing to dispatch.</div>
      ) : (
        <div className="tablecard"><table>
          <thead><tr><th>Order</th><th>Customer</th><th>Created</th><th>Status</th></tr></thead>
          <tbody>{orders.map((o) => (
            <tr key={o.orderId} onClick={() => { location.href = `/staff/dispatch?order=${o.orderId}`; }}>
              <td><strong>{o.orderId}</strong></td><td>{o.customerName}</td><td>{o.createdAt}</td><td><StatusBadge status={o.status} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

function DispatchDetail({ orderId }: { orderId: string }) {
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR<{ ok: boolean; status: string; customerName: string; deliverySnapshot: string; records: Array<{ dispatchId: string; transporter: string; awbLrNo: string; vehicleNo: string; dispatchedBy: string }> }>(`/api/staff/orders/${orderId}/dispatch`, fetcher);
  const [f, setF] = useState({ dispatchDate: '', transporter: '', awbLrNo: '', vehicleNo: '', remarks: '', docDriveUrl: '' });
  const [busy, setBusy] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (!data?.ok) return <div className="card">Order not found.</div>;

  async function dispatch() {
    setBusy('d');
    const r = await postJSON(`/api/staff/orders/${orderId}/dispatch`, { action: 'dispatch', ...f });
    setBusy('');
    if (!r.ok) return toast.error(r.msg || 'Failed.');
    toast.success(r.msg || 'Dispatched.');
    celebrate();
    mutate();
  }
  async function complete() {
    setBusy('c');
    const r = await postJSON(`/api/staff/orders/${orderId}/dispatch`, { action: 'complete' });
    setBusy('');
    r.ok ? (toast.success(r.msg || 'Completed.'), mutate()) : toast.error(r.msg || 'Failed.');
  }

  return (
    <div>
      <Link href="/staff/dispatch" style={{ fontSize: 13, color: 'var(--muted)' }}>← Queue</Link>
      <PageHeader title={`Dispatch — ${orderId}`} subtitle={data.customerName} actions={<Link href={`/staff/orders/${orderId}`} className="btn ghost sm">Order detail</Link>} />

      <div className="card" style={{ fontSize: 13, whiteSpace: 'pre-line', color: 'var(--muted)', marginBottom: 14 }}>{data.deliverySnapshot}</div>

      {data.status === ORDER_STATUS.READY_FOR_DISPATCH ? (
        <div className="card grid gap-2">
          <div className="grid2">
            <div><label>Dispatch date</label><input type="date" value={f.dispatchDate} onChange={set('dispatchDate')} /></div>
            <div><label>Transporter / courier</label><input value={f.transporter} onChange={set('transporter')} /></div>
          </div>
          <div className="grid2">
            <div><label>AWB / LR number</label><input value={f.awbLrNo} onChange={set('awbLrNo')} /></div>
            <div><label>Vehicle number</label><input value={f.vehicleNo} onChange={set('vehicleNo')} /></div>
          </div>
          <div><label>Document URL (optional)</label><input value={f.docDriveUrl} onChange={set('docDriveUrl')} /></div>
          <div><label>Remarks</label><textarea rows={2} value={f.remarks} onChange={set('remarks')} /></div>
          <button className="btn primary" disabled={!!busy} onClick={dispatch}>{busy === 'd' ? 'Dispatching…' : 'Mark dispatched'}</button>
        </div>
      ) : (
        <div className="card">
          <p style={{ color: 'var(--hue-success)', fontWeight: 700 }}>Dispatched.</p>
          {data.records.map((r) => (
            <div key={r.dispatchId} style={{ fontSize: 13, color: 'var(--muted)' }}>
              {[r.transporter, r.awbLrNo, r.vehicleNo].filter(Boolean).join(' · ')} — by {r.dispatchedBy}
            </div>
          ))}
          <button className="btn green sm" style={{ marginTop: 10 }} disabled={!!busy} onClick={complete}>{busy === 'c' ? 'Completing…' : 'Mark completed'}</button>
        </div>
      )}
    </div>
  );
}

function Inner() {
  const order = useSearchParams().get('order');
  return order ? <DispatchDetail orderId={order} /> : <Queue />;
}
export default function DispatchPage() {
  return <Suspense><Inner /></Suspense>;
}
