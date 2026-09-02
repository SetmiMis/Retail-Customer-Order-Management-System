'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '../../../../lib/client';
import PageHeader from '../../../../components/ui/PageHeader';
import Reveal from '../../../../components/fx/Reveal';

const TONE_COLOR: Record<string, string> = {
  issue: 'var(--hue-issue)', pending: 'var(--hue-pending)', processing: 'var(--hue-processing)',
  accent: 'var(--accent)', success: 'var(--hue-success)',
};

interface Attn { key: string; tone: string; label: string; count: number; href: string }

export default function AttentionPage() {
  const { data, isLoading } = useSWR<{ attention: Attn[]; ageing: { orders: { bucket: string; count: number }[]; requirements: { bucket: string; count: number }[] } }>('/api/staff/dashboard', fetcher, { refreshInterval: 30000 });
  const attention = data?.attention ?? [];

  return (
    <div>
      <PageHeader title="Needs attention" subtitle="Everything currently waiting on someone. Click to jump straight in." />
      {isLoading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : attention.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>All clear — nothing is waiting. 🎉</div>
      ) : (
        <div className="grid gap-2">
          {attention.map((a, i) => (
            <Reveal key={a.key} delay={i * 0.04}>
              <Link href={a.href} className="attn-row">
                <span className="attn-dot" style={{ background: TONE_COLOR[a.tone] || 'var(--accent)', color: TONE_COLOR[a.tone] }} />
                <span style={{ flex: 1, fontWeight: 600 }}>{a.label}</span>
                <span className="brand-heading" style={{ fontSize: 20, color: TONE_COLOR[a.tone] }}>{a.count}</span>
              </Link>
            </Reveal>
          ))}
        </div>
      )}

      {data?.ageing && (
        <>
          <h3 className="sectitle" style={{ marginTop: 26 }}>Order ageing</h3>
          <div className="kpis">
            {data.ageing.orders.map((b) => (
              <div key={b.bucket} className={`stat ${b.count ? 'pending' : 'neutral'}`}><div className="v">{b.count}</div><div className="l">Orders pending {b.bucket}</div></div>
            ))}
          </div>
          <h3 className="sectitle" style={{ marginTop: 22 }}>Requirement ageing</h3>
          <div className="kpis">
            {data.ageing.requirements.map((b) => (
              <div key={b.bucket} className={`stat ${b.count ? 'issue' : 'neutral'}`}><div className="v">{b.count}</div><div className="l">Requirements {b.bucket}</div></div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
