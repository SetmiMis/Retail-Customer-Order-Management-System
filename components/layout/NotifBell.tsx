'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Bell } from 'lucide-react';
import { fetcher, postJSON } from '../../lib/client';

interface Notif { id: string; orderId: string; type: string; message: string; read: boolean; createdAt: string }

/** Polling notification bell. `endpoint` is /api/staff/notifications or /api/portal/notifications. */
export default function NotifBell({ endpoint, hrefBase }: { endpoint: string; hrefBase: string }) {
  const { data, mutate } = useSWR<{ notifications: Notif[] }>(endpoint, fetcher, { refreshInterval: 30000 });
  const [open, setOpen] = useState(false);
  const items = data?.notifications ?? [];
  const unread = items.filter((n) => !n.read);

  async function markAll() {
    if (!unread.length) return;
    await postJSON(endpoint, { ids: unread.map((n) => n.id) });
    mutate();
  }

  return (
    <div className="dropdown" style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ''}`}
        onClick={() => { setOpen((o) => !o); if (!open) markAll(); }}
      >
        <Bell size={16} />
        {unread.length > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 9, background: 'var(--hue-issue)', color: '#fff', fontSize: 10, fontWeight: 800,
            display: 'grid', placeItems: 'center',
          }}>
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' as unknown as number }} onClick={() => setOpen(false)} />
          <div className="dropdown-menu" style={{ width: 320, maxHeight: 420, overflowY: 'auto', zIndex: 'calc(var(--z-dropdown) + 1)' as unknown as number }}>
            <div className="dropdown-sep" style={{ margin: 0 }} />
            {items.length === 0 ? (
              <div style={{ padding: 18, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No notifications.</div>
            ) : (
              items.slice(0, 30).map((n) => (
                <Link
                  key={n.id}
                  href={n.orderId ? `${hrefBase}/${n.orderId}` : hrefBase}
                  className="dropdown-item"
                  style={{ display: 'block', whiteSpace: 'normal', opacity: n.read ? 0.6 : 1 }}
                  onClick={() => setOpen(false)}
                >
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{n.type}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{n.createdAt}</div>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
