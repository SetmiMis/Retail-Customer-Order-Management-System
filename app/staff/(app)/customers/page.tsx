'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, patchJSON } from '../../../../lib/client';
import { useToast } from '../../../../components/ui/ToastProvider';
import PageHeader from '../../../../components/ui/PageHeader';
import SearchInput from '../../../../components/ui/SearchInput';

interface C { customerId: string; companyName: string; contactName: string; phone: string; email: string; gst: string; status: string; createdAt: string; lastLoginAt: string }

export default function CustomersPage() {
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR<{ customers: C[] }>('/api/staff/customers', fetcher);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const rows = (data?.customers ?? []).filter((c) =>
    !q || [c.companyName, c.contactName, c.phone, c.email].some((v) => v.toLowerCase().includes(q.toLowerCase())),
  );

  async function toggle(c: C) {
    setBusy(c.customerId);
    const r = await patchJSON(`/api/staff/customers/${c.customerId}`, { status: c.status === 'Active' ? 'Inactive' : 'Active' });
    setBusy('');
    r.ok ? (toast.success(r.msg || 'Updated.'), mutate()) : toast.error(r.msg || 'Failed.');
  }

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${rows.length} customer(s)`} />
      <div style={{ maxWidth: 280, marginBottom: 12 }}><SearchInput value={q} onChange={setQ} placeholder="Search customers…" /></div>
      {isLoading ? <div className="skeleton" style={{ height: 240 }} /> : (
        <div className="tablecard"><table>
          <thead><tr><th>Company</th><th>Contact</th><th>Phone</th><th>Email</th><th>GST</th><th>Status</th><th></th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.customerId}>
              <td><Link href={`/staff/orders?customerId=${c.customerId}`} style={{ color: 'var(--accent)', fontWeight: 700 }}>{c.companyName}</Link></td>
              <td>{c.contactName}</td>
              <td>{c.phone}</td>
              <td>{c.email}</td>
              <td>{c.gst || '—'}</td>
              <td><span className={`os ${c.status === 'Active' ? 'os-success' : 'os-neutral'}`}>{c.status}</span></td>
              <td><button className="btn ghost sm" disabled={busy === c.customerId} onClick={() => toggle(c)}>{c.status === 'Active' ? 'Deactivate' : 'Activate'}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
