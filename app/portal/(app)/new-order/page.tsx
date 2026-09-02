'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Trash2, ArrowRight } from 'lucide-react';
import { fetcher, postJSON } from '../../../../lib/client';
import { useCart } from '../../../../components/portal/CartProvider';
import { useToast } from '../../../../components/ui/ToastProvider';

interface Addr { addressId: string; label: string; line1: string; city: string; state: string; pincode: string; isDefault: boolean }

export default function NewOrderPage() {
  const cart = useCart();
  const router = useRouter();
  const toast = useToast();
  const { data: addrData } = useSWR<{ addresses: Addr[] }>('/api/portal/addresses', fetcher);
  const addresses = addrData?.addresses ?? [];
  const [addrId, setAddrId] = useState('');
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);

  const chosen = addrId || addresses.find((a) => a.isDefault)?.addressId || addresses[0]?.addressId || '';

  async function submit() {
    if (!cart.lines.length) return;
    setBusy(true);
    const res = await postJSON('/api/portal/orders', {
      items: cart.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      customerRemark: remark,
      deliveryAddressId: chosen,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.msg || 'Could not place the order.');
      return;
    }
    cart.clear();
    toast.success(`Order ${res.orderId} placed.`);
    router.push(`/portal/orders/${res.orderId}?new=1`);
  }

  if (!cart.lines.length) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <p style={{ color: 'var(--muted)', margin: '0 0 14px' }}>Your order is empty.</p>
        <Link href="/portal/catalog" className="btn primary">Browse the catalogue</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="brand-heading" style={{ fontSize: 24, margin: '0 0 4px' }}>Review your order</h1>
      <p className="tagline" style={{ margin: '0 0 18px' }}>No price here — our team will confirm the rate with you after you submit.</p>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {cart.lines.map((l) => (
          <div key={l.productId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{l.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{l.sku && `SKU ${l.sku} · `}{l.unit}</div>
            </div>
            <div className="qtystep">
              <button onClick={() => cart.setQty(l.productId, l.qty - 1)} aria-label="Decrease">–</button>
              <input value={l.qty} onChange={(e) => cart.setQty(l.productId, Math.max(0, parseInt(e.target.value) || 0))} inputMode="numeric" />
              <button onClick={() => cart.setQty(l.productId, l.qty + 1)} aria-label="Increase">+</button>
            </div>
            <button onClick={() => cart.remove(l.productId)} aria-label="Remove" style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', width: 'auto' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <label htmlFor="addr">Delivery address</label>
        {addresses.length ? (
          <select id="addr" value={chosen} onChange={(e) => setAddrId(e.target.value)}>
            {addresses.map((a) => (
              <option key={a.addressId} value={a.addressId}>
                {a.label} — {a.line1}, {a.city}, {a.state} {a.pincode}{a.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
        ) : (
          <div className="dup-warning" style={{ marginTop: 4 }}>
            No delivery address yet. <Link href="/portal/profile" style={{ color: 'inherit', textDecoration: 'underline' }}>Add one in your profile</Link> — you can still submit and we&apos;ll confirm it with you.
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <label htmlFor="rmk">Remark for our team <span style={{ color: 'var(--muted)' }}>(optional)</span></label>
        <textarea id="rmk" rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. Please arrange urgently." />
      </div>

      <button className="btn primary shine" style={{ width: '100%', marginTop: 18, justifyContent: 'center', padding: 14 }} disabled={busy} onClick={submit}>
        {busy ? 'Placing…' : <>Submit order <ArrowRight size={16} /></>}
      </button>
    </div>
  );
}
