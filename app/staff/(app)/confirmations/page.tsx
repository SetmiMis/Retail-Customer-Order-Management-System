'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, postJSON } from '../../../../lib/client';
import { ORDER_STATUS } from '../../../../lib/oms/constants';
import { useToast } from '../../../../components/ui/ToastProvider';
import PageHeader from '../../../../components/ui/PageHeader';

interface Row { orderId: string; customerName: string; source: string; createdAt: string; customerRemark: string }

export default function ConfirmationsPage() {
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR<{ orders: Row[] }>(`/api/staff/orders?status=${encodeURIComponent(ORDER_STATUS.CONFIRM_PENDING)}`, fetcher);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const orders = data?.orders ?? [];

  async function decide(orderId: string, decision: 'Confirmed' | 'Cancelled') {
    setBusy(orderId + decision);
    const r = await postJSON(`/api/staff/orders/${orderId}/confirm`, { decision, note: notes[orderId] || '' });
    setBusy('');
    r.ok ? (toast.success(r.msg || 'Done.'), mutate()) : toast.error(r.msg || 'Failed.');
  }

  return (
    <div>
      <PageHeader title="Confirmation queue" subtitle="Rate is agreed with the customer outside the system — record the outcome here. The rate itself is never stored." />
      {isLoading ? <div className="skeleton" style={{ height: 200 }} /> : orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No orders awaiting confirmation.</div>
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => (
            <div key={o.orderId} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <Link href={`/staff/orders/${o.orderId}`} style={{ fontWeight: 800, textDecoration: 'none' }}>{o.orderId}</Link>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{o.customerName} · {o.source} · {o.createdAt}</div>
                  {o.customerRemark && <div style={{ fontSize: 12, marginTop: 4 }}>“{o.customerRemark}”</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input placeholder="Confirmation note (e.g. confirmed via WhatsApp)" value={notes[o.orderId] || ''} onChange={(e) => setNotes((p) => ({ ...p, [o.orderId]: e.target.value }))} style={{ flex: 1, minWidth: 200 }} />
                <button className="btn green sm" disabled={!!busy} onClick={() => decide(o.orderId, 'Confirmed')}>Confirmed</button>
                <button className="btn red sm" disabled={!!busy} onClick={() => decide(o.orderId, 'Cancelled')}>Cancel</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
