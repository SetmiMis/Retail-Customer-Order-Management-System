'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { fetcher } from '../../lib/client';

interface Hit { label: string; sub: string; href: string }
interface Results { orders: Hit[]; customers: Hit[]; requirements: Hit[]; shipments: Hit[] }
const GROUPS: [keyof Results, string][] = [
  ['orders', 'Orders'], ['customers', 'Customers'], ['requirements', 'Requirements'], ['shipments', 'Shipments'],
];

export default function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Results | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(() => {
      fetcher(`/api/staff/search?q=${encodeURIComponent(q)}`).then(setRes).catch(() => setRes(null));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const hits = res ? GROUPS.flatMap(([k]) => res[k]) : [];
  function go(href: string) { setOpen(false); setQ(''); router.push(href); }

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <div className="search-wrap" style={{ width: 220 }}>
        <Search size={13} className="search-icon" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search…"
          style={{ height: 34, fontSize: 13 }}
        />
      </div>
      {open && q.trim().length >= 2 && (
        <div className="dropdown-menu" style={{ right: 0, left: 'auto', width: 320, maxHeight: 380, overflowY: 'auto', top: 'calc(100% + 6px)' }}>
          {hits.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>{res ? 'No matches.' : 'Searching…'}</div>
          ) : (
            GROUPS.map(([k, title]) =>
              res![k].length ? (
                <div key={k}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--muted)', padding: '8px 10px 3px' }}>{title}</div>
                  {res![k].map((h, i) => (
                    <button key={k + i} className="dropdown-item" style={{ display: 'block', textAlign: 'left' }} onClick={() => go(h.href)}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{h.label}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{h.sub}</div>
                    </button>
                  ))}
                </div>
              ) : null,
            )
          )}
        </div>
      )}
    </div>
  );
}
