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
  const orders = (data?.orders ?? []).filter((o) =>
    o.status === ORDER_STATUS.READY_FOR_DISPATCH || o.status === ORDER_STATUS.DISPATCHED || o.status === ORDER_STATUS.PARTIAL_AVAILABLE);
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

interface DLine { lineNo: number; productName: string; unit: string; orderedQty: number; packedQty: number; availableQty: number | null; dispatchedQty: number; lineStatus: string }
const SHIPPABLE = ['Ready', 'Available', 'Packed'];

function DispatchDetail({ orderId }: { orderId: string }) {
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR<{ ok: boolean; status: string; customerName: string; deliverySnapshot: string; items: DLine[]; records: Array<{ dispatchId: string; transporter: string; awbLrNo: string; vehicleNo: string; dispatchedBy: string }> }>(`/api/staff/orders/${orderId}/dispatch`, fetcher);
  const [f, setF] = useState({ dispatchDate: '', transporter: '', awbLrNo: '', vehicleNo: '', remarks: '', docDriveUrl: '' });
  const [sel, setSel] = useState<Record<number, boolean> | null>(null);
  const [busy, setBusy] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (!data?.ok) return <div className="card">Order not found.</div>;

  const items = data.items ?? [];
  const shippable = items.filter((it) => it.dispatchedQty === 0 && SHIPPABLE.includes(it.lineStatus));
  const picked = sel ?? Object.fromEntries(shippable.map((it) => [it.lineNo, true]));
  const chosen = shippable.filter((it) => picked[it.lineNo]);
  const canDispatch = shippable.length > 0
    && (data.status === ORDER_STATUS.READY_FOR_DISPATCH || data.status === ORDER_STATUS.PARTIAL_AVAILABLE);

  async function dispatch() {
    if (!chosen.length) return toast.error('Select at least one line.');
    setBusy('d');
    const r = await postJSON(`/api/staff/orders/${orderId}/dispatch`, {
      action: 'dispatch', ...f,
      lineNos: chosen.length === shippable.length ? undefined : chosen.map((it) => it.lineNo),
    });
    setBusy('');
    if (!r.ok) return toast.error(r.msg || 'Failed.');
    toast.success(r.msg || 'Dispatched.');
    celebrate();
    setSel(null);
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

      {items.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h4 className="brand-heading" style={{ marginTop: 0, fontSize: 13 }}>Lines</h4>
          {items.map((it) => {
            const done = it.dispatchedQty > 0;
            const ship = !done && SHIPPABLE.includes(it.lineStatus);
            return (
              <div key={it.lineNo} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13, opacity: done ? 0.5 : 1 }}>
                {canDispatch && ship ? (
                  <input type="checkbox" style={{ width: 'auto' }} checked={!!picked[it.lineNo]}
                    onChange={(e) => setSel({ ...picked, [it.lineNo]: e.target.checked })} />
                ) : <span style={{ width: 13 }} />}
                <span style={{ flex: 1 }}>{it.productName}</span>
                <span style={{ color: 'var(--muted)' }}>
                  {done ? `${it.dispatchedQty} ${it.unit} shipped` : ship ? `${it.packedQty || it.availableQty || it.orderedQty} ${it.unit} ready` : `waiting (${it.lineStatus})`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {canDispatch ? (
        <div className="card grid gap-2">
          {shippable.length < items.length && (
            <p style={{ fontSize: 12, color: 'var(--hue-pending)', margin: 0 }}>
              Partial dispatch — {chosen.length} of {items.length} lines. The rest ship once their requirement is received.
            </p>
          )}
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
          <button className="btn primary" disabled={!!busy} onClick={dispatch}>
            {busy === 'd' ? 'Dispatching…' : chosen.length < shippable.length || shippable.length < items.length ? `Dispatch ${chosen.length} line(s)` : 'Mark dispatched'}
          </button>
        </div>
      ) : (
        <div className="card">
          <p style={{ color: 'var(--hue-success)', fontWeight: 700 }}>{data.status === ORDER_STATUS.DISPATCHED ? 'Dispatched.' : data.status}</p>
          {data.records.map((r) => (
            <div key={r.dispatchId} style={{ fontSize: 13, color: 'var(--muted)' }}>
              {[r.transporter, r.awbLrNo, r.vehicleNo].filter(Boolean).join(' · ')} — by {r.dispatchedBy}
            </div>
          ))}
          {data.status === ORDER_STATUS.DISPATCHED && (
            <button className="btn green sm" style={{ marginTop: 10 }} disabled={!!busy} onClick={complete}>{busy === 'c' ? 'Completing…' : 'Mark completed'}</button>
          )}
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
