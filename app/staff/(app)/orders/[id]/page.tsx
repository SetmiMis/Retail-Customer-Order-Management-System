'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, postJSON, patchJSON } from '../../../../../lib/client';
import { useSession } from '../../../../../components/layout/SessionProvider';
import { useToast } from '../../../../../components/ui/ToastProvider';
import StatusBadge from '../../../../../components/ui/StatusBadge';
import { ORDER_STATUS, ROLE_MANAGE, ROLE_ORDER_ENTRY, ATTACHMENT_KINDS } from '../../../../../lib/oms/constants';

const S = ORDER_STATUS;
const EDITABLE_STATUSES: string[] = [S.RECEIVED, S.CONFIRM_PENDING, S.CONFIRMED, S.QTY_CHECK, S.REQUIREMENT_PENDING, S.PARTIAL_AVAILABLE];

interface Item { lineNo: number; productName: string; sku: string; unit: string; orderedQty: number; checkedQty: number | null; availableQty: number | null; shortQty: number; packedQty: number; dispatchedQty: number; lineStatus: string }
interface ReqLink { requirementId: string; orderLineNo: number; mirroredStatus: string; satisfied: boolean; requiredQty: number }
interface Ev { fromStatus: string; toStatus: string; byName: string; at: string; note: string }
interface Order {
  orderId: string; customerName: string; source: string; status: string; confirmStatus: string;
  confirmedBy: string; confirmedAt: string; confirmNote: string; customerRemark: string; deliverySnapshot: string;
  partialPolicy: string; holdReason: string; createdByName: string; createdAt: string; assignedStaff: string;
  items: Item[]; timeline: Ev[]; requirements: ReqLink[];
}

export default function StaffOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role } = useSession();
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR<{ ok: boolean; order?: Order }>(`/api/staff/orders/${id}`, fetcher);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [editItems, setEditItems] = useState(false);
  const o = data?.order;

  async function act(url: string, body: unknown, label: string) {
    setBusy(label);
    const r = await postJSON(url, body);
    setBusy('');
    if (!r.ok) return toast.error(r.msg || 'Action failed.');
    toast.success(r.msg || 'Done.');
    setNote('');
    mutate();
  }

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (!o) return <div className="card" style={{ padding: 40 }}>Order not found. <Link href="/staff/orders" style={{ color: 'var(--accent)' }}>All orders</Link></div>;

  const canManage = ROLE_MANAGE.includes(role);
  const canConfirm = ['ADMIN', 'MANAGER', 'SALES'].includes(role);
  const canWh = ['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(role);
  const canDispatch = ['ADMIN', 'MANAGER', 'DISPATCH'].includes(role);

  return (
    <div>
      <Link href="/staff/orders" style={{ fontSize: 13, color: 'var(--muted)' }}>← All orders</Link>
      <div className="crm-header" style={{ marginTop: 8 }}>
        <div className="crm-left">
          <div className="crm-avatar">{(o.customerName || 'C').slice(0, 2).toUpperCase()}</div>
          <div className="crm-title">
            <h2>{o.orderId}</h2>
            <div className="crm-sub">{o.customerName} · {o.source} · by {o.createdByName} · {o.createdAt}</div>
          </div>
        </div>
        <StatusBadge status={o.status} />
      </div>

      {/* Contextual action bar */}
      <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {(o.status === S.CONFIRM_PENDING || o.status === S.RECEIVED) && canConfirm && (
          <>
            <input placeholder="Confirmation note (e.g. confirmed on WhatsApp)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <button className="btn green sm" disabled={!!busy} onClick={() => act(`/api/staff/orders/${id}/confirm`, { decision: 'Confirmed', note }, 'confirm')}>Mark confirmed</button>
            <button className="btn red sm" disabled={!!busy} onClick={() => act(`/api/staff/orders/${id}/confirm`, { decision: 'Cancelled', note }, 'cancel')}>Not confirmed</button>
          </>
        )}
        {(o.status === S.CONFIRMED || o.status === S.QTY_CHECK) && canWh && (
          <Link href={`/staff/quantity-check?order=${id}`} className="btn primary sm">Run quantity check →</Link>
        )}
        {(o.status === S.REQUIREMENT_PENDING || o.status === S.PARTIAL_AVAILABLE) && (
          <>
            <Link href={`/staff/quantity-check?order=${id}`} className="btn ghost sm">Quantity check</Link>
            <button className="btn primary sm" disabled={!!busy} onClick={() => act('/api/staff/requirements', {}, 'reflect')}>Refresh requirement status</button>
            {canDispatch && o.items.some((it) => it.dispatchedQty === 0 && ['Ready', 'Available', 'Packed'].includes(it.lineStatus)) && (
              <Link href={`/staff/dispatch?order=${id}`} className="btn ghost sm">Dispatch ready lines →</Link>
            )}
          </>
        )}
        {o.status === S.READY_FOR_PACKING && canWh && (
          <button className="btn primary sm" disabled={!!busy} onClick={() => act(`/api/staff/orders/${id}/packing`, { action: 'start' }, 'pack')}>Start packing</button>
        )}
        {o.status === S.PACKING && canWh && <Link href={`/staff/packing?order=${id}`} className="btn primary sm">Continue packing →</Link>}
        {o.status === S.FINAL_VERIFICATION && canWh && <Link href={`/staff/verification?order=${id}`} className="btn primary sm">Final verification →</Link>}
        {o.status === S.READY_FOR_DISPATCH && canDispatch && <Link href={`/staff/dispatch?order=${id}`} className="btn primary sm">Dispatch →</Link>}
        {o.status === S.DISPATCHED && canDispatch && (
          <button className="btn green sm" disabled={!!busy} onClick={() => act(`/api/staff/orders/${id}/dispatch`, { action: 'complete' }, 'complete')}>Mark completed</button>
        )}
        {canManage && ![S.COMPLETED, S.CANCELLED].includes(o.status as never) && (
          <>
            {o.status === S.ON_HOLD
              ? <button className="btn ghost sm" disabled={!!busy} onClick={() => act(`/api/staff/orders/${id}/transition`, { action: 'resume' }, 'resume')}>Resume</button>
              : <button className="btn ghost sm" disabled={!!busy} onClick={() => act(`/api/staff/orders/${id}/transition`, { action: 'hold', reason: note || 'On hold' }, 'hold')}>Hold</button>}
            <button className="btn ghost sm" disabled={!!busy} onClick={() => act(`/api/staff/orders/${id}/transition`, { action: 'cancel', reason: note || 'Cancelled by manager' }, 'cancelo')} style={{ color: 'var(--red)' }}>Cancel order</button>
            <button className="btn ghost sm" disabled={!!busy} onClick={() => act(`/api/staff/orders/${id}/transition`, { action: 'partialPolicy', policy: o.partialPolicy.startsWith('Wait') ? 'Allow partial dispatch' : 'Wait for complete order' }, 'pp')}>
              Policy: {o.partialPolicy.startsWith('Wait') ? 'Wait' : 'Allow partial'}
            </button>
          </>
        )}
        {o.holdReason && <span className="pill" style={{ color: 'var(--hue-pending)' }}>On hold: {o.holdReason}</span>}
      </div>

      <div className="info-grid">
        <div className="info-card">
          <h4>Customer</h4>
          <div className="detrow"><span className="k">Name</span><span className="v">{o.customerName}</span></div>
          <div className="detrow"><span className="k">Confirmation</span><span className="v">{o.confirmStatus}{o.confirmedBy && ` · ${o.confirmedBy}`}</span></div>
          {o.confirmNote && <div className="detrow"><span className="k">Note</span><span className="v">{o.confirmNote}</span></div>}
          {o.assignedStaff && <div className="detrow"><span className="k">Assigned</span><span className="v">{o.assignedStaff}</span></div>}
        </div>
        <div className="info-card">
          <h4>Delivery</h4>
          <div style={{ fontSize: 13, whiteSpace: 'pre-line', color: 'var(--muted)' }}>{o.deliverySnapshot || '—'}</div>
          {o.customerRemark && <div className="detrow" style={{ marginTop: 8 }}><span className="k">Remark</span><span className="v">{o.customerRemark}</span></div>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22 }}>
        <h3 className="sectitle" style={{ margin: 0 }}>Items</h3>
        {ROLE_ORDER_ENTRY.includes(role) && EDITABLE_STATUSES.includes(o.status) && (
          <button className="btn ghost sm" onClick={() => setEditItems((v) => !v)}>{editItems ? 'Close' : 'Edit items'}</button>
        )}
      </div>
      {editItems && <ItemsEditor orderId={id} items={o.items} onDone={() => { setEditItems(false); mutate(); }} />}
      <div className="tablecard" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th>Product</th><th>Ordered</th><th>Checked</th><th>Available</th><th>Short</th><th>Packed</th><th>Line</th></tr></thead>
          <tbody>
            {o.items.map((it) => (
              <tr key={it.lineNo}>
                <td>{it.productName}<div style={{ fontSize: 11, color: 'var(--muted)' }}>{it.sku} · {it.unit}</div></td>
                <td><strong>{it.orderedQty}</strong></td>
                <td>{it.checkedQty ?? '—'}</td>
                <td>{it.availableQty ?? '—'}</td>
                <td style={{ color: it.shortQty ? 'var(--red)' : undefined }}>{it.shortQty || '—'}</td>
                <td>{it.packedQty || '—'}</td>
                <td><span className={`os ${it.lineStatus === 'Ready' || it.lineStatus === 'Available' ? 'os-success' : it.lineStatus === 'Short' ? 'os-issue' : it.lineStatus === 'Requirement' ? 'os-pending' : 'os-neutral'}`}>{it.lineStatus}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {o.requirements?.length > 0 && (
        <>
          <h3 className="sectitle" style={{ marginTop: 22 }}>Linked requirements (Purchase FMS)</h3>
          <div className="tablecard">
            <table>
              <thead><tr><th>Requirement</th><th>Order line</th><th>Qty</th><th>PFMS status</th><th></th></tr></thead>
              <tbody>
                {o.requirements.map((r) => (
                  <tr key={r.requirementId + r.orderLineNo}>
                    <td><strong>{r.requirementId}</strong></td>
                    <td>Line {r.orderLineNo}</td>
                    <td>{r.requiredQty}</td>
                    <td>{r.mirroredStatus || 'Submitted'}</td>
                    <td>{r.satisfied ? <span className="os os-success">Satisfied</span> : <span className="os os-pending">Waiting</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className="sectitle" style={{ marginTop: 22 }}>Attachments</h3>
      <Attachments orderId={id} />

      <h3 className="sectitle" style={{ marginTop: 22 }}>Timeline</h3>
      <ul className="pfms-timeline">
        {[...o.timeline].reverse().map((e, i) => (
          <li key={i}>
            <div className="tl-act">{e.toStatus || 'Created'}{e.fromStatus && ` (from ${e.fromStatus})`}</div>
            <div className="tl-meta">{e.byName} · {e.at}{e.note && ` · ${e.note}`}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Att { attId: string; kind: string; fileName: string; driveUrl: string; note: string; uploadedByName: string; uploadedAt: string }

function Attachments({ orderId }: { orderId: string }) {
  const toast = useToast();
  const { data, mutate } = useSWR<{ attachments: Att[] }>(`/api/staff/orders/${orderId}/attachments`, fetcher);
  const [kind, setKind] = useState<string>('WhatsApp Screenshot');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const atts = data?.attachments ?? [];

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    fd.append('note', note);
    const res = await fetch(`/api/staff/orders/${orderId}/attachments`, { method: 'POST', body: fd });
    const body = await res.json().catch(() => ({ ok: false, msg: 'Upload failed.' }));
    setBusy(false);
    e.target.value = '';
    if (!body.ok) return toast.error(body.msg || 'Upload failed.');
    toast.success('Attachment added.');
    setNote('');
    mutate();
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 'auto' }}>
          {ATTACHMENT_KINDS.map((k) => <option key={k}>{k}</option>)}
        </select>
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
          {busy ? 'Uploading…' : 'Upload file'}
          <input type="file" hidden accept="image/*,application/pdf,text/plain" onChange={upload} disabled={busy} />
        </label>
      </div>
      {atts.length > 0 && (
        <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
          {atts.map((a) => (
            <a key={a.attId} href={a.driveUrl} target="_blank" rel="noreferrer" className="detrow" style={{ textDecoration: 'none' }}>
              <span className="k">{a.kind}</span>
              <span className="v">{a.fileName}{a.note && ` — ${a.note}`}<div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.uploadedByName} · {a.uploadedAt}</div></span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemsEditor({ orderId, items, onDone }: { orderId: string; items: Item[]; onDone: () => void }) {
  const toast = useToast();
  const { data: pData } = useSWR<{ products: Array<{ productId: string; name: string; sku: string; status: string }> }>('/api/staff/products', fetcher);
  const products = (pData?.products ?? []).filter((p) => p.status !== 'Inactive');
  const [qty, setQty] = useState<Record<number, string>>(() => Object.fromEntries(items.map((it) => [it.lineNo, String(it.orderedQty)])));
  const [removed, setRemoved] = useState<Record<number, boolean>>({});
  const [adds, setAdds] = useState<Array<{ productId: string; qty: string }>>([]);
  const [busy, setBusy] = useState(false);

  async function save() {
    const edits = [
      ...items
        .filter((it) => removed[it.lineNo] || Number(qty[it.lineNo]) !== it.orderedQty)
        .map((it) => ({ lineNo: it.lineNo, orderedQty: Number(qty[it.lineNo]) || 0, remove: !!removed[it.lineNo] })),
      ...adds.filter((a) => a.productId && Number(a.qty) > 0).map((a) => ({ productId: a.productId, orderedQty: Number(a.qty) })),
    ];
    if (!edits.length) return toast.error('No changes.');
    setBusy(true);
    const r = await patchJSON(`/api/staff/orders/${orderId}/items`, { edits });
    setBusy(false);
    if (!r.ok) return toast.error(r.msg || 'Failed.');
    toast.success(r.msg || 'Order updated.');
    onDone();
  }

  return (
    <div className="card" style={{ marginTop: 10 }}>
      {items.map((it) => (
        <div key={it.lineNo} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', opacity: removed[it.lineNo] ? 0.4 : 1 }}>
          <span style={{ flex: 1, fontSize: 13 }}>{it.productName} <span style={{ color: 'var(--muted)' }}>· {it.unit}</span></span>
          <input style={{ width: 76 }} inputMode="numeric" value={qty[it.lineNo] ?? ''} disabled={removed[it.lineNo]}
            onChange={(e) => setQty((q) => ({ ...q, [it.lineNo]: e.target.value }))} />
          <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => setRemoved((r) => ({ ...r, [it.lineNo]: !r[it.lineNo] }))}>
            {removed[it.lineNo] ? 'Keep' : 'Remove'}
          </button>
        </div>
      ))}
      {adds.map((a, i) => (
        <div key={`a${i}`} style={{ display: 'flex', gap: 10, padding: '6px 0', alignItems: 'center' }}>
          <select style={{ flex: 1 }} value={a.productId} onChange={(e) => setAdds((x) => x.map((y, j) => (j === i ? { ...y, productId: e.target.value } : y)))}>
            <option value="">— add product —</option>
            {products.map((p) => <option key={p.productId} value={p.productId}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
          </select>
          <input style={{ width: 76 }} inputMode="numeric" value={a.qty} onChange={(e) => setAdds((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))} />
        </div>
      ))}
      <div className="actions" style={{ marginTop: 8 }}>
        <button className="btn ghost sm" onClick={() => setAdds((x) => [...x, { productId: '', qty: '1' }])}>+ Add line</button>
        <button className="btn primary sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0' }}>Lines already sent to a requirement can&apos;t be changed here.</p>
    </div>
  );
}
