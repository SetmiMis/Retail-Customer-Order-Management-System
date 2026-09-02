import { OMS_SHEETS, ID_PREFIX, ORDER_STATUS, LINE_STATUS } from './constants';
import { readSheet, appendRows, setCells, nextId } from '../sheets/rows';
import { audit, staffActor } from './audit';
import { notify } from './notifications';
import { listOrders, getOrder, itemsFor, orderRow1, pushHistory, _colmaps } from './orders';
import type { Order, ServiceResult } from './types';
import type { StaffSession } from '../auth/session';

const O = OMS_SHEETS.ORDERS;
const OI = OMS_SHEETS.ORDER_ITEMS;
const PK = OMS_SHEETS.PACKING;
const { C, IC } = _colmaps;
// OMS_Packing: PackID,OrderID,LineNo,ProductID,ProductName,ExpectedQty,PackedQty,Verified,PackedByID,PackedByName,PackedAt,Remarks
const PC = { ID: 0, ORDER: 1, LINE: 2, PID: 3, PNAME: 4, EXP: 5, PACKED: 6, VERIFIED: 7, BYID: 8, BYNAME: 9, AT: 10, REMARKS: 11 };

export async function packingQueue(): Promise<Order[]> {
  return (await listOrders()).filter((o) => o.status === ORDER_STATUS.READY_FOR_PACKING || o.status === ORDER_STATUS.PACKING);
}

/** READY_FOR_PACKING → PACKING; seeds one OMS_Packing row per order line (idempotent). */
export async function startPacking(actor: StaffSession, orderId: string): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;
  if (![ORDER_STATUS.READY_FOR_PACKING, ORDER_STATUS.PACKING].includes(order.status as never)) {
    return { ok: false, msg: `Order is "${order.status}", not ready for packing.` };
  }
  const items = await itemsFor(orderId);
  const { rows: pkRows } = await readSheet(PK);
  const existing = new Set(pkRows.filter((r) => String(r[PC.ORDER]).trim() === orderId).map((r) => Number(r[PC.LINE])));
  const toSeed = items.filter((it) => !existing.has(it.lineNo));
  if (toSeed.length) {
    const base = nextId(ID_PREFIX.PACK, pkRows, 0);
    const baseN = Number(base.slice(base.lastIndexOf('-') + 1)) || 1;
    await appendRows(PK, toSeed.map((it, i) => [
      `${ID_PREFIX.PACK}${String(baseN + i).padStart(4, '0')}`,
      orderId, it.lineNo, it.productId, it.productName,
      it.availableQty ?? it.orderedQty, 0, 'FALSE', '', '', '', '',
    ]));
  }
  if (order.status === ORDER_STATUS.READY_FOR_PACKING) {
    await setCells(O, [
      { row1Based: row1, col1Based: C.STATUS + 1, value: ORDER_STATUS.PACKING },
      { row1Based: row1, col1Based: C.UPDATED + 1, value: new Date() },
    ]);
    await pushHistory(orderId, order.status, ORDER_STATUS.PACKING, staffActor(actor), '');
    await audit(staffActor(actor), 'START_PACKING', 'Order', orderId, order.status, ORDER_STATUS.PACKING, '');
  }
  return { ok: true, msg: 'Packing started.' };
}

export interface PackLineInput { lineNo: number; packedQty: number | string; verified: boolean; remarks?: string }

/** Save packed quantities + per-line verified flags. When every line is verified,
 *  the order advances PACKING → FINAL_VERIFICATION. */
export async function savePacking(actor: StaffSession, orderId: string, lines: PackLineInput[]): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;
  if (order.status !== ORDER_STATUS.PACKING) return { ok: false, msg: `Order is "${order.status}", not in packing.` };

  const { rows: pkRows } = await readSheet(PK);
  const { rows: itemRows } = await readSheet(OI);
  const pkCells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
  const oiCells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];

  for (const ln of lines) {
    const pkIdx = pkRows.findIndex((r) => String(r[PC.ORDER]).trim() === orderId && Number(r[PC.LINE]) === Number(ln.lineNo));
    if (pkIdx !== -1) {
      const r1 = pkIdx + 2;
      pkCells.push(
        { row1Based: r1, col1Based: PC.PACKED + 1, value: Math.max(0, Number(ln.packedQty) || 0) },
        { row1Based: r1, col1Based: PC.VERIFIED + 1, value: ln.verified ? 'TRUE' : 'FALSE' },
        { row1Based: r1, col1Based: PC.BYID + 1, value: actor.userId },
        { row1Based: r1, col1Based: PC.BYNAME + 1, value: actor.name },
        { row1Based: r1, col1Based: PC.AT + 1, value: new Date() },
      );
      if (ln.remarks !== undefined) pkCells.push({ row1Based: r1, col1Based: PC.REMARKS + 1, value: String(ln.remarks) });
    }
    const oiIdx = itemRows.findIndex((r) => String(r[IC.ORDER]).trim() === orderId && Number(r[IC.LINE]) === Number(ln.lineNo));
    if (oiIdx !== -1) {
      oiCells.push({ row1Based: oiIdx + 2, col1Based: IC.PACKED + 1, value: Math.max(0, Number(ln.packedQty) || 0) });
      if (ln.verified) oiCells.push({ row1Based: oiIdx + 2, col1Based: IC.STATUS + 1, value: LINE_STATUS.PACKED });
    }
  }
  if (pkCells.length) await setCells(PK, pkCells);
  if (oiCells.length) await setCells(OI, oiCells);

  const { rows: pkFresh } = await readSheet(PK);
  const mine = pkFresh.filter((r) => String(r[PC.ORDER]).trim() === orderId);
  const allVerified = mine.length > 0 && mine.every((r) => String(r[PC.VERIFIED]).toLowerCase() === 'true');

  if (allVerified) {
    await setCells(O, [
      { row1Based: row1, col1Based: C.STATUS + 1, value: ORDER_STATUS.FINAL_VERIFICATION },
      { row1Based: row1, col1Based: C.UPDATED + 1, value: new Date() },
    ]);
    await pushHistory(orderId, ORDER_STATUS.PACKING, ORDER_STATUS.FINAL_VERIFICATION, staffActor(actor), 'Packing complete');
    await notify({ audience: 'Internal', staffRole: 'WAREHOUSE', orderId, type: 'Final Verification', message: `${orderId} packed — ready for final verification.` });
  }
  await audit(staffActor(actor), 'SAVE_PACKING', 'Order', orderId, '', allVerified ? ORDER_STATUS.FINAL_VERIFICATION : ORDER_STATUS.PACKING, `${lines.length} line(s)`);
  return { ok: true, msg: allVerified ? 'Packing complete — moved to final verification.' : 'Packing saved.' };
}

export async function packingView(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) return null;
  const { rows } = await readSheet(PK);
  const pk = rows.filter((r) => String(r[PC.ORDER]).trim() === orderId).map((r) => ({
    lineNo: Number(r[PC.LINE]) || 0,
    productName: String(r[PC.PNAME] ?? ''),
    expectedQty: Number(r[PC.EXP]) || 0,
    packedQty: Number(r[PC.PACKED]) || 0,
    verified: String(r[PC.VERIFIED]).toLowerCase() === 'true',
    remarks: String(r[PC.REMARKS] ?? ''),
  }));
  return { orderId, status: order.status, customerName: order.customerName, lines: pk };
}
