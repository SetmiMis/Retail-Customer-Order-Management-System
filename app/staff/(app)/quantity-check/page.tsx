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

const CHECK_STATES = [ORDER_STATUS.CONFIRMED, ORDER_STATUS.QTY_CHECK, ORDER_STATUS.REQUIREMENT_PENDING, ORDER_STATUS.PARTIAL_AVAILABLE] as string[];

interface QLine { lineNo: number; productName: string; unit: string; orderedQty: number; checkedQty: number | null; availableQty: number | null; shortQty: number; lineStatus: string; requirementId: string; requirementStatus: string; requirementSatisfied: boolean }

function Queue() {
  const { data, isLoading } = useSWR<{ orders: Array<{ orderId: string; customerName: string; status: string; createdAt: string }> }>('/api/staff/orders', fetcher);
  const orders = (data?.orders ?? []).filter((o) => CHECK_STATES.includes(o.status));
  return (
    <div>
      <PageHeader title="Quantity check" subtitle={`${orders.length} order(s) awaiting or in check`} />
      {isLoading ? <div className="skeleton" style={{ height: 180 }} /> : orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nothing to check right now.</div>
      ) : (
        <div className="tablecard">
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Created</th><th>Status</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderId} onClick={() => { location.href = `/staff/quantity-check?order=${o.orderId}`; }}>
                  <td><strong>{o.orderId}</strong></td><td>{o.customerName}</td><td>{o.createdAt}</td><td><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CheckGrid({ orderId }: { orderId: string }) {
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR<{ ok: boolean; status: string; partialPolicy: string; lines: QLine[] }>(`/api/staff/orders/${orderId}/quantity-check`, fetcher);
  const [rows, setRows] = useState<Record<number, { checkedQty: string; availableQty: string; remarks: string }>>({});
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!data?.lines) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(Object.fromEntries(data.lines.map((l) => [l.lineNo, {
      checkedQty: String(l.checkedQty ?? ''),
      availableQty: String(l.availableQty ?? ''),
      remarks: '',
    }])));
  }, [data?.lines]);

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 220 }} /></div>;
  if (!data?.ok) return <div className="card">Order not found.</div>;

  const set = (ln: number, k: 'checkedQty' | 'availableQty' | 'remarks', v: string) =>
    setRows((p) => ({ ...p, [ln]: { ...p[ln], [k]: v } }));

  async function save() {
    setBusy('save');
    const lines = (data!.lines).map((l) => ({
      lineNo: l.lineNo,
      checkedQty: Number(rows[l.lineNo]?.checkedQty || 0),
      availableQty: Number(rows[l.lineNo]?.availableQty || 0),
      remarks: rows[l.lineNo]?.remarks || '',
    }));
    const r = await postJSON(`/api/staff/orders/${orderId}/quantity-check`, { lines });
    setBusy('');
    r.ok ? (toast.success(r.msg || 'Saved.'), mutate()) : toast.error(r.msg || 'Failed.');
  }

  async function raise() {
    const lineNos = Object.entries(sel).filter(([, v]) => v).map(([k]) => Number(k));
    if (!lineNos.length) return toast.error('Select the short line(s) first.');
    setBusy('raise');
    const r = await postJSON(`/api/staff/orders/${orderId}/raise-requirement`, { lineNos });
    setBusy('');
    if (!r.ok) return toast.error(r.msg || 'Failed.');
    toast.success(r.msg || 'Requirement raised.');
    setSel({});
    mutate();
  }

  const anyShort = data.lines.some((l) => l.shortQty > 0 && !l.requirementId);

  return (
    <div>
      <Link href="/staff/quantity-check" style={{ fontSize: 13, color: 'var(--muted)' }}>← Queue</Link>
      <PageHeader
        title={`Quantity check — ${orderId}`}
        subtitle={`Policy: ${data.partialPolicy}. Original ordered quantity is never changed.`}
        actions={<Link href={`/staff/orders/${orderId}`} className="btn ghost sm">Order detail</Link>}
      />
      <div className="tablecard">
        <table>
          <thead><tr><th className="checkbox-cell"></th><th>Product</th><th>Ordered</th><th>Checked</th><th>Available</th><th>Short</th><th>Remarks</th><th>Requirement</th></tr></thead>
          <tbody>
            {data.lines.map((l) => {
              const av = Number(rows[l.lineNo]?.availableQty || 0);
              const short = Math.max(0, l.orderedQty - av);
              return (
                <tr key={l.lineNo}>
                  <td className="checkbox-cell">
                    {short > 0 && !l.requirementId && (
                      <input type="checkbox" style={{ width: 'auto' }} checked={!!sel[l.lineNo]} onChange={(e) => setSel((p) => ({ ...p, [l.lineNo]: e.target.checked }))} />
                    )}
                  </td>
                  <td>{l.productName}<div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.unit}</div></td>
                  <td><strong>{l.orderedQty}</strong></td>
                  <td><input style={{ width: 80 }} inputMode="numeric" value={rows[l.lineNo]?.checkedQty ?? ''} onChange={(e) => set(l.lineNo, 'checkedQty', e.target.value)} /></td>
                  <td><input style={{ width: 80 }} inputMode="numeric" value={rows[l.lineNo]?.availableQty ?? ''} onChange={(e) => set(l.lineNo, 'availableQty', e.target.value)} /></td>
                  <td style={{ color: short ? 'var(--red)' : 'var(--muted)' }}>{short || '—'}</td>
                  <td><input style={{ width: 140 }} value={rows[l.lineNo]?.remarks ?? ''} onChange={(e) => set(l.lineNo, 'remarks', e.target.value)} /></td>
                  <td>{l.requirementId ? <span className="os os-pending">{l.requirementId} · {l.requirementStatus || 'Submitted'}</span> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="actions" style={{ marginTop: 14 }}>
        <button className="btn primary" disabled={!!busy} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save quantity check'}</button>
        {anyShort && <button className="btn ghost" disabled={!!busy} onClick={raise}>{busy === 'raise' ? 'Raising…' : 'Raise requirement for selected short line(s)'}</button>}
      </div>
    </div>
  );
}

function Inner() {
  const order = useSearchParams().get('order');
  return order ? <CheckGrid orderId={order} /> : <Queue />;
}

export default function QuantityCheckPage() {
  return <Suspense><Inner /></Suspense>;
}
