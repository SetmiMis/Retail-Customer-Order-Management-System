'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { motion } from 'motion/react';
import { ShoppingCart, Plus, Check } from 'lucide-react';
import { fetcher } from '../../../../lib/client';
import { useCart } from '../../../../components/portal/CartProvider';
import SearchInput from '../../../../components/ui/SearchInput';
import Skeleton from '../../../../components/ui/Skeleton';

interface P {
  productId: string; sku: string; name: string; category: string; subcategory: string;
  description: string; specifications: string; unit: string; imageUrl: string; availabilityNote: string;
}

export default function CatalogPage() {
  const [q, setQ] = useState('');
  const { data, isLoading } = useSWR<{ products: P[] }>(`/api/portal/catalog?q=${encodeURIComponent(q)}`, fetcher);
  const cart = useCart();
  const products = data?.products ?? [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="brand-heading" style={{ fontSize: 24, margin: 0 }}>Catalogue</h1>
          <p className="tagline" style={{ margin: '2px 0 0' }}>Rate not shown — our team confirms it with you directly.</p>
        </div>
        <div style={{ minWidth: 240 }}>
          <SearchInput value={q} onChange={setQ} placeholder="Search products, SKU, category…" />
        </div>
      </div>

      {isLoading ? (
        <div className="cat-grid">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} style={{ height: 240 }} />)}
        </div>
      ) : products.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No products match “{q}”.</div>
      ) : (
        <div className="cat-grid">
          {products.map((p, i) => {
            const inCart = cart.qtyOf(p.productId);
            return (
              <motion.div
                key={p.productId}
                className="prod-card"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3) }}
              >
                <div className="prod-thumb">
                  {p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <ShoppingCart size={30} style={{ opacity: 0.5, color: 'var(--accent)' }} />}
                </div>
                <div className="prod-body">
                  <div className="prod-name">{p.name}</div>
                  <div className="prod-meta">
                    {p.sku && <>SKU {p.sku} · </>}{p.category}{p.subcategory ? ` / ${p.subcategory}` : ''} · {p.unit}
                  </div>
                  {p.description && <div className="prod-meta" style={{ opacity: 0.85 }}>{p.description}</div>}
                  <div className="rate-note">Price confirmed separately by our team</div>
                  <div style={{ marginTop: 'auto', paddingTop: 10 }}>
                    {inCart ? (
                      <div className="qtystep">
                        <button onClick={() => cart.setQty(p.productId, inCart - 1)} aria-label="Decrease">–</button>
                        <input
                          value={inCart}
                          onChange={(e) => cart.setQty(p.productId, Math.max(0, parseInt(e.target.value) || 0))}
                          inputMode="numeric"
                        />
                        <button onClick={() => cart.setQty(p.productId, inCart + 1)} aria-label="Increase">+</button>
                      </div>
                    ) : (
                      <button
                        className="btn sm shine"
                        onClick={() => cart.add({ productId: p.productId, name: p.name, sku: p.sku, unit: p.unit }, 1)}
                      >
                        <Plus size={14} /> Add
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {cart.count > 0 && (
        <Link href="/portal/new-order" className="cart-fab">
          <Check size={16} /> Review order · {cart.count}
        </Link>
      )}
    </div>
  );
}
