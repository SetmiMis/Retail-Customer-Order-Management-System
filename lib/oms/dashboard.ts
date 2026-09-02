import { ORDER_STATUS } from './constants';
import { listOrders } from './orders';
import { allOpenLinks } from './requirementBridge';
import { parseSheetDate } from '../shared/format';

const S = ORDER_STATUS;

function hoursSince(dateStr: string): number {
  const d = parseSheetDate(dateStr);
  if (!d) return 0;
  return (Date.now() - d.getTime()) / 36e5;
}

export interface DashboardData {
  counts: Record<string, number>;
  today: { newOrders: number; confirmed: number; dispatched: number; completed: number };
  attention: Array<{ key: string; tone: string; label: string; count: number; href: string }>;
  ageing: {
    orders: Array<{ bucket: string; count: number }>;
    requirements: Array<{ bucket: string; count: number }>;
  };
  openRequirementLinks: number;
}

export async function getDashboard(): Promise<DashboardData> {
  const orders = await listOrders();
  const links = await allOpenLinks().catch(() => []);
  const c = (st: string) => orders.filter((o) => o.status === st).length;

  const counts = Object.fromEntries(Object.values(S).map((st) => [st, c(st)]));

  const isToday = (d: string) => {
    const dt = parseSheetDate(d);
    if (!dt) return false;
    const n = new Date();
    return dt.getFullYear() === n.getFullYear() && dt.getMonth() === n.getMonth() && dt.getDate() === n.getDate();
  };

  const today = {
    newOrders: orders.filter((o) => isToday(o.createdAt)).length,
    confirmed: orders.filter((o) => o.confirmStatus === 'Confirmed' && isToday(o.confirmedAt)).length,
    dispatched: orders.filter((o) => o.status === S.DISPATCHED && isToday(o.updatedAt)).length,
    completed: orders.filter((o) => o.status === S.COMPLETED && isToday(o.updatedAt)).length,
  };

  const attention = [
    { key: 'req', tone: 'issue', label: 'Orders waiting on a requirement', count: c(S.REQUIREMENT_PENDING) + c(S.PARTIAL_AVAILABLE), href: '/staff/requirements' },
    { key: 'confirm', tone: 'pending', label: 'Orders waiting for customer confirmation', count: c(S.CONFIRM_PENDING), href: `/staff/confirmations` },
    { key: 'qty', tone: 'processing', label: 'Orders awaiting quantity check', count: c(S.CONFIRMED) + c(S.QTY_CHECK), href: '/staff/quantity-check' },
    { key: 'pack', tone: 'accent', label: 'Orders ready for packing', count: c(S.READY_FOR_PACKING), href: '/staff/packing' },
    { key: 'verify', tone: 'processing', label: 'Orders in final verification', count: c(S.FINAL_VERIFICATION), href: '/staff/verification' },
    { key: 'dispatch', tone: 'accent', label: 'Orders ready for dispatch', count: c(S.READY_FOR_DISPATCH), href: '/staff/dispatch' },
    { key: 'hold', tone: 'pending', label: 'Orders on hold', count: c(S.ON_HOLD), href: `/staff/orders?status=${encodeURIComponent(S.ON_HOLD)}` },
  ].filter((a) => a.count > 0);

  const openish = orders.filter((o) => ![S.COMPLETED, S.CANCELLED, S.DRAFT].includes(o.status as never));
  const bucket = (arr: number[], h: number) => arr.filter((x) => x > h).length;
  const orderAges = openish.map((o) => hoursSince(o.createdAt));
  const linkAges = links.map((l) => hoursSince(l.createdAt));

  return {
    counts,
    today,
    attention,
    ageing: {
      orders: [
        { bucket: '> 24 h', count: bucket(orderAges, 24) },
        { bucket: '> 48 h', count: bucket(orderAges, 48) },
        { bucket: '> 72 h', count: bucket(orderAges, 72) },
      ],
      requirements: [
        { bucket: '> 1 day', count: bucket(linkAges, 24) },
        { bucket: '> 3 days', count: bucket(linkAges, 72) },
        { bucket: '> 7 days', count: bucket(linkAges, 168) },
      ],
    },
    openRequirementLinks: links.length,
  };
}
