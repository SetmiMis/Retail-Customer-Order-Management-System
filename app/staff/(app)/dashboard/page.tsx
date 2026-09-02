import Link from 'next/link';
import { listOrders } from '../../../../lib/oms/orders';
import { ORDER_STATUS } from '../../../../lib/oms/constants';
import PageHeader from '../../../../components/ui/PageHeader';
import Reveal from '../../../../components/fx/Reveal';

export const dynamic = 'force-dynamic';

const S = ORDER_STATUS;

export default async function StaffDashboard() {
  const orders = await listOrders().catch(() => []);
  const count = (st: string) => orders.filter((o) => o.status === st).length;

  const tiles = [
    { label: 'Confirmation pending', n: count(S.CONFIRM_PENDING), tone: 'pending', href: `/staff/orders?status=${encodeURIComponent(S.CONFIRM_PENDING)}` },
    { label: 'Quantity check', n: count(S.CONFIRMED) + count(S.QTY_CHECK), tone: 'processing', href: `/staff/quantity-check` },
    { label: 'Requirement pending', n: count(S.REQUIREMENT_PENDING) + count(S.PARTIAL_AVAILABLE), tone: 'issue', href: `/staff/requirements` },
    { label: 'Ready for packing', n: count(S.READY_FOR_PACKING), tone: 'processing', href: `/staff/packing` },
    { label: 'Ready for dispatch', n: count(S.READY_FOR_DISPATCH), tone: 'processing', href: `/staff/dispatch` },
    { label: 'Completed', n: count(S.COMPLETED), tone: 'success', href: `/staff/orders?status=${encodeURIComponent(S.COMPLETED)}` },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="What needs action, and what's moving through the pipeline." />
      <div className="kpis">
        {tiles.map((t, i) => (
          <Reveal key={t.label} delay={i * 0.05}>
            <Link href={t.href} className={`stat ${t.tone}`} style={{ display: 'block', textDecoration: 'none' }}>
              <div className="v">{t.n}</div>
              <div className="l">{t.label}</div>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
