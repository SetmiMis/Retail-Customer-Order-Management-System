'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Plus, Trash2 } from 'lucide-react';
import { fetcher, postJSON } from '../../../../../lib/client';
import { ORDER_SOURCES } from '../../../../../lib/oms/constants';
import { useToast } from '../../../../../components/ui/ToastProvider';
import PageHeader from '../../../../../components/ui/PageHeader';

interface Cust { customerId: string; companyName: string; contactName: string }
interface Prod { productId: string; name: string; sku: string; unit: string; status: string }
interface Line { productId: string; qty: string }

export default function StaffCreateOrder() {
  const router = useRouter();
  const toast = useToast();
  const { data: cData } = useSWR<{ customers: Cust[] }>('/api/staff/customers', fetcher);
  const { data: pData } = useSWR<{ products: Prod[] }>('/api/staff/products', fetcher);
  const products = useMemo(() => (pData?.products ?? []).filter((p) => p.status !== 'Inactive'), [pData]);

  const [customerId, setCustomerId] = useState('');
  const [source, setSource] = useState<string>('WhatsApp');
  const [remark, setRemark] = useState('');
  const [lines, setLines] = useState<Line[]>([{ productId: '', qty: '1' }]);
  const [busy, setBusy] = useState(false);

  const setLine = (i: number, k: keyof Line, v: string) => setLines((p) => p.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  async function submit() {
    const items = lines.filter((l) => l.productId && Number(l.qty) > 0).map((l) => ({ productId: l.productId, qty: Number(l.qty) }));
    if (!customerId) return toast.error('Select a customer.');
    if (!items.length) return toast.error('Add at least one product.');
    setBusy(true);
    const r = await postJSON('/api/staff/orders', { customerId, source, customerRemark: remark, items });
    setBusy(false);
    if (!r.ok) return toast.error(r.msg || 'Failed.');
    toast.success(r.msg || 'Order created.');
    router.push(`/staff/orders/${r.orderId}`);
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <PageHeader title="Create order" subtitle="On behalf of a customer who ordered via phone / WhatsApp / email. No rate — confirmation is recorded later." />
      <div className="card grid gap-2">
        <div className="grid2">
          <div>
            <label>Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— select —</option>
              {(cData?.customers ?? []).map((c) => <option key={c.customerId} value={c.customerId}>{c.companyName} ({c.contactName})</option>)}
            </select>
          </div>
          <div>
            <label>Order source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {ORDER_SOURCES.filter((s) => s !== 'Customer Portal').map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <label style={{ marginTop: 6 }}>Products</label>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={l.productId} onChange={(e) => setLine(i, 'productId', e.target.value)} style={{ flex: 1 }}>
              <option value="">— product —</option>
              {products.map((p) => <option key={p.productId} value={p.productId}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
            </select>
            <input style={{ width: 80 }} inputMode="numeric" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} />
            <button onClick={() => setLines((p) => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', width: 'auto' }}><Trash2 size={16} /></button>
          </div>
        ))}
        <button className="btn ghost sm" onClick={() => setLines((p) => [...p, { productId: '', qty: '1' }])}><Plus size={14} /> Add line</button>

        <div><label>Remark</label><textarea rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. Customer requested urgent delivery. Screenshot on file." /></div>

        <button className="btn primary" style={{ justifyContent: 'center', marginTop: 6 }} disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create order'}</button>
      </div>
    </div>
  );
}
