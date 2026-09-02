import { OMS_SHEETS, ORDER_STATUS } from './constants';
import { readSheet, readSheets } from '../sheets/rows';
import { listOrders } from './orders';
import { allOpenLinks } from './requirementBridge';
import { parseSheetDate, monthKey } from '../shared/format';

const S = ORDER_STATUS;

export interface ReportBundle {
  totals: { orders: number; open: number; completed: number; cancelled: number; pending: number };
  byStatus: Array<{ label: string; count: number }>;
  bySource: Array<{ label: string; count: number }>;
  byMonth: Array<{ label: string; count: number }>;
  topCustomers: Array<{ name: string; orders: number }>;
  demand: { topProducts: Array<{ name: string; qty: number }>; frequentlyShort: Array<{ name: string; times: number }> };
  requirements: { open: number; satisfied: number; byStatus: Array<{ label: string; count: number }> };
}

export async function getReports(range?: { from?: string; to?: string }): Promise<ReportBundle> {
  let orders = await listOrders();
  if (range?.from) {
    const f = new Date(range.from);
    orders = orders.filter((o) => (parseSheetDate(o.createdAt) ?? new Date(0)) >= f);
  }
  if (range?.to) {
    const t = new Date(range.to + 'T23:59:59');
    orders = orders.filter((o) => (parseSheetDate(o.createdAt) ?? new Date(0)) <= t);
  }

  const tally = (fn: (o: (typeof orders)[number]) => string) => {
    const m = new Map<string, number>();
    for (const o of orders) {
      const k = fn(o) || '—';
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  };

  const { [OMS_SHEETS.ORDER_ITEMS]: oiS, [OMS_SHEETS.QTY_CHECKS]: qcS } = await readSheets([OMS_SHEETS.ORDER_ITEMS, OMS_SHEETS.QTY_CHECKS]);
  const orderIds = new Set(orders.map((o) => o.orderId));

  // demand — total ordered qty per product name
  const demandMap = new Map<string, number>();
  for (const r of oiS.rows) {
    if (!orderIds.has(String(r[0]).trim())) continue;
    const name = String(r[3] ?? '').trim();
    if (!name) continue;
    demandMap.set(name, (demandMap.get(name) || 0) + (Number(r[6]) || 0));
  }
  const topProducts = [...demandMap.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 12);

  // frequently short — count QC rows where ShortQty > 0 per product
  const shortMap = new Map<string, number>();
  for (const r of qcS.rows) {
    if ((Number(r[7]) || 0) <= 0) continue; // ShortQty col
    const pid = String(r[3] ?? '').trim();
    const name = [...oiS.rows].find((x) => String(x[2]).trim() === pid)?.[3];
    const key = String(name ?? pid).trim();
    if (key) shortMap.set(key, (shortMap.get(key) || 0) + 1);
  }
  const frequentlyShort = [...shortMap.entries()].map(([name, times]) => ({ name, times })).sort((a, b) => b.times - a.times).slice(0, 10);

  const links = await allOpenLinks().catch(() => []);
  const { rows: reqLinkRows } = await readSheet(OMS_SHEETS.REQ_LINKS);
  const satisfied = reqLinkRows.filter((r) => String(r[9]).toLowerCase() === 'true').length; // Satisfied col
  const reqStatus = new Map<string, number>();
  for (const r of reqLinkRows) {
    const st = String(r[8] ?? '').trim() || 'Submitted'; // MirroredStatus
    reqStatus.set(st, (reqStatus.get(st) || 0) + 1);
  }

  return {
    totals: {
      orders: orders.length,
      open: orders.filter((o) => ![S.COMPLETED, S.CANCELLED].includes(o.status as never)).length,
      completed: orders.filter((o) => o.status === S.COMPLETED).length,
      cancelled: orders.filter((o) => o.status === S.CANCELLED).length,
      pending: orders.filter((o) => o.status === S.CONFIRM_PENDING).length,
    },
    byStatus: tally((o) => o.status),
    bySource: tally((o) => o.source),
    byMonth: tally((o) => monthKey(o.createdAt)).sort((a, b) => a.label.localeCompare(b.label)),
    topCustomers: (() => {
      const m = new Map<string, number>();
      for (const o of orders) m.set(o.customerName, (m.get(o.customerName) || 0) + 1);
      return [...m.entries()].map(([name, orders]) => ({ name, orders })).sort((a, b) => b.orders - a.orders).slice(0, 10);
    })(),
    demand: { topProducts, frequentlyShort },
    requirements: {
      open: links.length,
      satisfied,
      byStatus: [...reqStatus.entries()].map(([label, count]) => ({ label, count })),
    },
  };
}
