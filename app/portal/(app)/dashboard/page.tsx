import Link from 'next/link';
import { getCustomer } from '../../../../lib/auth/guard';
import { listCustomerOrders } from '../../../../lib/oms/orders';
import { ORDER_STATUS } from '../../../../lib/oms/constants';
import Reveal from '../../../../components/fx/Reveal';
import StepPill from '../../../../components/portal/StepPill';

export const dynamic = 'force-dynamic';
const S = ORDER_STATUS;

export default async function PortalDashboard() {
  const customer = await getCustomer();
  const orders = customer ? await listCustomerOrders(customer.customerId).catch(() => []) : [];

  const open = orders.filter((o) => ![S.COMPLETED, S.CANCELLED].includes(o.status as never));
  const tiles = [
    { label: 'Pending', n: orders.filter((o) => o.status === S.CONFIRM_PENDING).length, tone: 'pending' },
    { label: 'Preparing', n: orders.filter((o) => [S.CONFIRMED, S.QTY_CHECK, S.REQUIREMENT_PENDING, S.PARTIAL_AVAILABLE, S.READY_FOR_PACKING].includes(o.status as never)).length, tone: 'processing' },
    { label: 'Dispatched', n: orders.filter((o) => o.status === S.DISPATCHED).length, tone: 'processing' },
    { label: 'Completed', n: orders.filter((o) => o.status === S.COMPLETED).length, tone: 'success' },
  ];

  return (
    <div>
      <Reveal>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="tagline" style={{ margin: 0 }}>Welcome back</p>
            <h1 className="brand-heading" style={{ fontSize: 26, margin: '2px 0 0' }}>{customer?.companyName}</h1>
          </div>
          <Link href="/portal/catalog" className="btn primary shine">+ New order</Link>
        </div>
      </Reveal>

      <div className="kpis" style={{ marginTop: 20 }}>
        {tiles.map((t, i) => (
          <Reveal key={t.label} delay={i * 0.05}>
            <div className={`stat ${t.tone}`}>
              <div className="v">{t.n}</div>
              <div className="l">{t.label} orders</div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <h2 className="brand-heading" style={{ fontSize: 18, margin: '28px 0 12px' }}>Recent orders</h2>
      </Reveal>
      {open.length === 0 && orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--muted)', margin: '0 0 14px' }}>You haven&apos;t placed an order yet.</p>
          <Link href="/portal/catalog" className="btn primary">Browse the catalogue</Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {orders.slice(0, 8).map((o) => (
            <Link key={o.orderId} href={`/portal/orders/${o.orderId}`} className="card lift" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{o.orderId}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{o.createdAt} · {o.itemCount} item(s)</div>
              </div>
              <StepPill label={o.stepLabel} index={o.stepIndex} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
