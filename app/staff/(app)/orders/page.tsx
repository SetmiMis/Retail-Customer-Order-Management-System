'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '../../../../lib/client';
import { ORDER_STATUS, ORDER_SOURCES } from '../../../../lib/oms/constants';
import StatusBadge from '../../../../components/ui/StatusBadge';
import PageHeader from '../../../../components/ui/PageHeader';
import SearchInput from '../../../../components/ui/SearchInput';

interface Row { orderId: string; customerName: string; source: string; status: string; createdAt: string; confirmStatus: string }

function OrdersInner() {
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get('status') || '');
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');

  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (source) qs.set('source', source);
  if (q) qs.set('q', q);
  const { data, isLoading } = useSWR<{ orders: Row[] }>(`/api/staff/orders?${qs}`, fetcher);
  const orders = data?.orders ?? [];

  return (
    <div>
      <PageHeader title="All orders" subtitle={`${orders.length} order(s)`} actions={<Link href="/staff/orders/new" className="btn primary sm">+ Create order</Link>} />
      <div className="filters" style={{ marginBottom: 14 }}>
        <div><label>Search</label><SearchInput value={q} onChange={setQ} placeholder="Order ID, customer, remark…" /></div>
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {Object.values(ORDER_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            {ORDER_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="skeleton" style={{ height: 240 }} />
      ) : orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No orders match.</div>
      ) : (
        <div className="tablecard">
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Source</th><th>Created</th><th>Confirm</th><th>Status</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderId} onClick={() => { location.href = `/staff/orders/${o.orderId}`; }}>
                  <td><strong>{o.orderId}</strong></td>
                  <td>{o.customerName}</td>
                  <td>{o.source}</td>
                  <td>{o.createdAt}</td>
                  <td>{o.confirmStatus}</td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function StaffOrdersPage() {
  return <Suspense><OrdersInner /></Suspense>;
}
