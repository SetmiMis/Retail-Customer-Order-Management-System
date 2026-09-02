'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, postJSON } from '../../../../lib/client';
import { useToast } from '../../../../components/ui/ToastProvider';
import PageHeader from '../../../../components/ui/PageHeader';

interface Link_ {
  linkId: string; orderId: string; orderLineNo: number; productId: string; requiredQty: number;
  requirementId: string; mirroredStatus: string; satisfied: boolean; createdAt: string;
}

export default function RequirementsPage() {
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR<{ links: Link_[]; reflect: { updated: number; satisfied: number } }>('/api/staff/requirements', fetcher, { refreshInterval: 45000 });
  const [busy, setBusy] = useState(false);
  const links = data?.links ?? [];

  async function refresh() {
    setBusy(true);
    const r = await postJSON('/api/staff/requirements', {});
    setBusy(false);
    if (!r.ok) return toast.error(r.msg || 'Failed.');
    toast.success(`Reflected — ${r.updated} updated, ${r.satisfied} satisfied, ${(r.ordersAdvanced as string[])?.length || 0} order(s) advanced.`);
    mutate();
  }

  return (
    <div>
      <PageHeader
        title="Requirements"
        subtitle="Customer-order shortfalls handed to Purchase FMS. Status mirrors PFMS; when the item is received the order moves on automatically."
        actions={<button className="btn primary sm" disabled={busy} onClick={refresh}>{busy ? 'Refreshing…' : 'Refresh from Purchase FMS'}</button>}
      />
      {isLoading ? <div className="skeleton" style={{ height: 200 }} /> : links.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No open requirement links.</div>
      ) : (
        <div className="tablecard">
          <table>
            <thead><tr><th>Requirement</th><th>Order</th><th>Line</th><th>Qty</th><th>PFMS status</th><th>Raised</th><th></th></tr></thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.linkId}>
                  <td><strong>{l.requirementId}</strong></td>
                  <td><Link href={`/staff/orders/${l.orderId}`} style={{ color: 'var(--accent)' }}>{l.orderId}</Link></td>
                  <td>Line {l.orderLineNo}</td>
                  <td>{l.requiredQty}</td>
                  <td>{l.mirroredStatus || 'Submitted'}</td>
                  <td>{l.createdAt}</td>
                  <td>{l.satisfied ? <span className="os os-success">Satisfied</span> : <span className="os os-pending">Waiting</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
