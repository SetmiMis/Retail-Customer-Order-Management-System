import { OMS_SHEETS, ORDER_STATUS, LINE_STATUS } from './constants';
import { readSheet, appendRow, setCells, updateRow } from '../sheets/rows';
import { audit, staffActor } from './audit';
import { itemsFor, orderRow1, pushHistory, _colmaps } from './orders';
import { openLinksForOrder } from './requirementBridge';
import { productsByIds } from './products';
import type { ServiceResult } from './types';
import type { StaffSession } from '../auth/session';

const OI = OMS_SHEETS.ORDER_ITEMS;
const { C, IC } = _colmaps;

/** Statuses where staff may still change what was ordered (before anything is packed). */
const EDITABLE = [
  ORDER_STATUS.RECEIVED, ORDER_STATUS.CONFIRM_PENDING, ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.QTY_CHECK, ORDER_STATUS.REQUIREMENT_PENDING, ORDER_STATUS.PARTIAL_AVAILABLE,
] as string[];

export interface LineEdit {
  lineNo?: number;      // omit to add a new line
  productId?: string;   // required when adding
  orderedQty: number;   // 0 + remove:true deletes; >0 sets
  remarks?: string;
  remove?: boolean;
}

/**
 * Add / change qty / remove order lines when a customer revises their order.
 * Blocked once packing has started, and a line already handed to a PFMS
 * requirement can't be touched (cancel the requirement in Purchase FMS first).
 * Every change is audited and dropped on the order timeline.
 */
export async function editOrderItems(actor: StaffSession, orderId: string, edits: LineEdit[]): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;
  if (!EDITABLE.includes(order.status)) {
    return { ok: false, msg: `An order in "${order.status}" can no longer be edited — it's past quantity check.` };
  }
  if (!edits?.length) return { ok: false, msg: 'No changes.' };

  const items = await itemsFor(orderId);
  const linkedLines = new Set((await openLinksForOrder(orderId)).filter((l) => !l.satisfied).map((l) => l.orderLineNo));
  const { rows: itemRows } = await readSheet(OI);
  const rowOf = (ln: number) => itemRows.findIndex((r) => String(r[IC.ORDER]).trim() === orderId && Number(r[IC.LINE]) === ln);

  const cells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
  const changes: string[] = [];
  let nextLine = Math.max(0, ...items.map((it) => it.lineNo));

  for (const e of edits) {
    // ---- add ----
    if (!e.lineNo) {
      const pid = String(e.productId || '').trim();
      const qty = Math.max(1, Number(e.orderedQty) || 0);
      if (!pid || qty <= 0) continue;
      const pr = (await productsByIds([pid])).get(pid);
      if (!pr) return { ok: false, msg: `Unknown product: ${pid}` };
      nextLine += 1;
      await appendRow(OI, [
        orderId, nextLine, pr.productId, pr.name, pr.sku, pr.unit,
        qty, '', '', 0, 0, 0, LINE_STATUS.PENDING, String(e.remarks || ''),
      ]);
      changes.push(`+${pr.name} ×${qty}`);
      continue;
    }

    const idx = rowOf(Number(e.lineNo));
    if (idx === -1) continue;
    if (linkedLines.has(Number(e.lineNo))) {
      return { ok: false, code: 'LINKED', msg: `Line ${e.lineNo} has an open requirement — cancel it in Purchase FMS before editing.` };
    }
    const r1 = idx + 2;
    const cur = items.find((it) => it.lineNo === Number(e.lineNo));

    // ---- remove ----
    if (e.remove || Number(e.orderedQty) <= 0) {
      await updateRow(OI, r1, new Array(itemRows[idx].length).fill(''));
      changes.push(`−${cur?.productName || `line ${e.lineNo}`}`);
      continue;
    }

    // ---- change qty / remarks ----
    const qty = Math.max(1, Number(e.orderedQty) || 0);
    if (cur && qty !== cur.orderedQty) {
      cells.push({ row1Based: r1, col1Based: IC.ORDERED + 1, value: qty });
      const avail = cur.availableQty ?? 0;
      if (cur.checkedQty != null) {
        cells.push(
          { row1Based: r1, col1Based: IC.SHORT + 1, value: Math.max(0, qty - avail) },
          { row1Based: r1, col1Based: IC.STATUS + 1, value: avail >= qty ? LINE_STATUS.READY : LINE_STATUS.SHORT },
        );
      }
      changes.push(`${cur.productName} ${cur.orderedQty}→${qty}`);
    }
    if (e.remarks !== undefined) cells.push({ row1Based: r1, col1Based: IC.REMARKS + 1, value: String(e.remarks) });
  }

  if (!changes.length) return { ok: false, msg: 'Nothing changed.' };
  if (cells.length) await setCells(OI, cells);
  await setCells(OMS_SHEETS.ORDERS, [{ row1Based: row1, col1Based: C.UPDATED + 1, value: new Date() }]);
  const note = changes.join(', ').slice(0, 400);
  await pushHistory(orderId, order.status, order.status, staffActor(actor), `Edited: ${note}`);
  await audit(staffActor(actor), 'EDIT_ORDER_ITEMS', 'Order', orderId, '', note, '');
  return { ok: true, msg: `Order updated: ${note}` };
}
