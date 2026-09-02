'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, postJSON, patchJSON } from '../../../../lib/client';
import { useToast } from '../../../../components/ui/ToastProvider';
import PageHeader from '../../../../components/ui/PageHeader';
import Modal from '../../../../components/ui/Modal';
import SearchInput from '../../../../components/ui/SearchInput';

interface P {
  productId: string; sku: string; name: string; category: string; subcategory: string; description: string;
  specifications: string; unit: string; imageUrl: string; availabilityNote: string; pfmsItemId: string; status: string;
}
const BLANK: Partial<P> = { name: '', sku: '', category: '', subcategory: '', description: '', specifications: '', unit: 'Pcs', imageUrl: '', availabilityNote: '', pfmsItemId: '', status: 'Active' };

export default function ProductsPage() {
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR<{ products: P[] }>('/api/staff/products', fetcher);
  const { data: pfms } = useSWR<{ items: Array<{ itemId: string; name: string; sku: string }> }>('/api/staff/pfms-items', fetcher);
  const [edit, setEdit] = useState<Partial<P> | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const products = (data?.products ?? []).filter((p) =>
    !q || [p.name, p.sku, p.category].some((v) => v.toLowerCase().includes(q.toLowerCase())),
  );

  async function save() {
    if (!edit) return;
    setBusy(true);
    const r = edit.productId
      ? await patchJSON(`/api/staff/products/${edit.productId}`, edit)
      : await postJSON('/api/staff/products', edit);
    setBusy(false);
    if (!r.ok) return toast.error(r.msg || 'Failed.');
    toast.success(r.msg || 'Saved.');
    setEdit(null);
    mutate();
  }

  const f = (k: keyof P) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEdit((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Customer catalogue. No price field — map each to a PFMS item so shortages can raise a requirement."
        actions={<button className="btn primary sm" onClick={() => setEdit({ ...BLANK })}>+ Add product</button>}
      />
      <div style={{ maxWidth: 280, marginBottom: 12 }}><SearchInput value={q} onChange={setQ} placeholder="Search products…" /></div>

      {isLoading ? <div className="skeleton" style={{ height: 240 }} /> : (
        <div className="tablecard"><table>
          <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Unit</th><th>PFMS item</th><th>Status</th></tr></thead>
          <tbody>{products.map((p) => (
            <tr key={p.productId} onClick={() => setEdit(p)}>
              <td><strong>{p.name}</strong></td>
              <td>{p.sku || '—'}</td>
              <td>{p.category}{p.subcategory ? ` / ${p.subcategory}` : ''}</td>
              <td>{p.unit}</td>
              <td>{p.pfmsItemId ? <span className="os os-success">{p.pfmsItemId}</span> : <span className="os os-issue">Not mapped</span>}</td>
              <td><span className={`os ${p.status === 'Inactive' ? 'os-neutral' : 'os-process'}`}>{p.status}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}

      {edit && (
        <Modal onClose={() => setEdit(null)}>
          <h3 className="sectitle">{edit.productId ? `Edit — ${edit.name}` : 'New product'}</h3>
          <div className="grid gap-2">
            <div className="grid2">
              <div><label>Name</label><input value={edit.name || ''} onChange={f('name')} /></div>
              <div><label>SKU</label><input value={edit.sku || ''} onChange={f('sku')} /></div>
            </div>
            <div className="grid2">
              <div><label>Category</label><input value={edit.category || ''} onChange={f('category')} /></div>
              <div><label>Subcategory</label><input value={edit.subcategory || ''} onChange={f('subcategory')} /></div>
            </div>
            <div className="grid2">
              <div><label>Unit</label><input value={edit.unit || ''} onChange={f('unit')} /></div>
              <div>
                <label>Status</label>
                <select value={edit.status || 'Active'} onChange={f('status')}><option>Active</option><option>Inactive</option></select>
              </div>
            </div>
            <div><label>Description</label><textarea rows={2} value={edit.description || ''} onChange={f('description')} /></div>
            <div><label>Specifications</label><textarea rows={2} value={edit.specifications || ''} onChange={f('specifications')} /></div>
            <div><label>Image URL</label><input value={edit.imageUrl || ''} onChange={f('imageUrl')} /></div>
            <div><label>Availability note (shown to customer)</label><input value={edit.availabilityNote || ''} onChange={f('availabilityNote')} /></div>
            <div>
              <label>PFMS item (for requirement linking)</label>
              <select value={edit.pfmsItemId || ''} onChange={f('pfmsItemId')}>
                <option value="">— not mapped —</option>
                {(pfms?.items ?? []).map((it) => <option key={it.itemId} value={it.itemId}>{it.itemId} · {it.name}{it.sku ? ` (${it.sku})` : ''}</option>)}
              </select>
            </div>
            <div className="actions" style={{ marginTop: 6 }}>
              <button className="btn primary sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
              <button className="btn ghost sm" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
