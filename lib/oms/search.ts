import { OMS_SHEETS } from './constants';
import { readSheet } from '../sheets/rows';
import { listOrders } from './orders';
import { listCustomers } from './customers';
import { allOpenLinks } from './requirementBridge';

export interface SearchHit { label: string; sub: string; href: string }
export interface SearchResults {
  orders: SearchHit[];
  customers: SearchHit[];
  requirements: SearchHit[];
  shipments: SearchHit[];
}

/** One box → order id / customer / phone / requirement id / AWB-LR. Cheap: a few full-tab reads. */
export async function globalSearch(qRaw: string): Promise<SearchResults> {
  const q = qRaw.trim().toLowerCase();
  if (q.length < 2) return { orders: [], customers: [], requirements: [], shipments: [] };
  const has = (v: unknown) => String(v ?? '').toLowerCase().includes(q);

  const [orders, customers, links, disp] = await Promise.all([
    listOrders(),
    listCustomers(),
    allOpenLinks().catch(() => []),
    readSheet(OMS_SHEETS.DISPATCHES).then((s) => s.rows).catch(() => [] as unknown[][]),
  ]);

  return {
    orders: orders
      .filter((o) => has(o.orderId) || has(o.customerName) || has(o.customerRemark))
      .slice(0, 8)
      .map((o) => ({ label: o.orderId, sub: `${o.customerName} · ${o.status}`, href: `/staff/orders/${o.orderId}` })),
    customers: customers
      .filter((c) => has(c.companyName) || has(c.contactName) || has(c.phone) || has(c.email))
      .slice(0, 6)
      .map((c) => ({ label: c.companyName, sub: `${c.contactName} · ${c.phone}`, href: `/staff/orders?customerId=${c.customerId}` })),
    requirements: links
      .filter((l) => has(l.requirementId))
      .slice(0, 6)
      .map((l) => ({ label: l.requirementId, sub: `order ${l.orderId} · ${l.mirroredStatus || 'Submitted'}`, href: `/staff/orders/${l.orderId}` })),
    shipments: disp
      .filter((r) => has(r[4]) || has(r[5])) // AWB / vehicle
      .slice(0, 6)
      .map((r) => ({ label: String(r[4] || r[5]), sub: `order ${String(r[1])} · ${String(r[3] || '')}`, href: `/staff/orders/${String(r[1])}` })),
  };
}
