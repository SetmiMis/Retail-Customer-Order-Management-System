'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface CartLine {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  qty: number;
}

interface CartCtx {
  lines: CartLine[];
  count: number;
  add: (line: Omit<CartLine, 'qty'>, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  qtyOf: (productId: string) => number;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = 'oms-cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setLines(JSON.parse(raw));
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* ignore */ }
  }, [lines, ready]);

  const add = useCallback((line: Omit<CartLine, 'qty'>, qty = 1) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.productId === line.productId);
      if (i === -1) return [...prev, { ...line, qty: Math.max(1, qty) }];
      const next = [...prev];
      next[i] = { ...next[i], qty: Math.max(1, next[i].qty + qty) };
      return next;
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, qty } : l)),
    );
  }, []);

  const remove = useCallback((productId: string) => setLines((prev) => prev.filter((l) => l.productId !== productId)), []);
  const clear = useCallback(() => setLines([]), []);
  const qtyOf = useCallback((productId: string) => lines.find((l) => l.productId === productId)?.qty ?? 0, [lines]);

  return (
    <Ctx.Provider value={{ lines, count: lines.reduce((n, l) => n + l.qty, 0), add, setQty, remove, clear, qtyOf }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be used within CartProvider');
  return c;
}
