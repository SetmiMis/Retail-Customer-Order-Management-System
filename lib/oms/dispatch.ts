import { OMS_SHEETS, ID_PREFIX, ORDER_STATUS, LINE_STATUS } from './constants';
import { readSheet, appendRow, setCells, nextId } from '../sheets/rows';
import { audit, staffActor } from './audit';
import { notify } from './notifications';
import { listOrders, getOrder, itemsFor, orderRow1, pushHistory, _colmaps } from './orders';
import type { Order, ServiceResult } from './types';
import type { StaffSession } from '../auth/session';

const O = OMS_SHEETS.ORDERS;
const OI = OMS_SHEETS.ORDER_ITEMS;
const D = OMS_SHEETS.DISPATCHES;
const { C, IC } = _colmaps;
// OMS_Dispatches: DispatchID,OrderID,DispatchDate,Transporter,AwbLrNo,VehicleNo,Remarks,DocDriveUrl,DispatchedByID,DispatchedByName,DispatchedAt
const DC = { ID: 0, ORDER: 1, DATE: 2, TRANS: 3, AWB: 4, VEH: 5, REMARKS: 6, DOC: 7, BYID: 8, BYNAME: 9, AT: 10 };

export async function dispatchQueue(): Promise<Order[]> {
  return (await listOrders()).filter((o) => o.status === ORDER_STATUS.READY_FOR_DISPATCH || o.status === ORDER_STATUS.DISPATCHED);
}

export interface DispatchInput {
  dispatchDate?: string;
  transporter?: string;
  awbLrNo?: string;
  vehicleNo?: string;
  remarks?: string;
  docDriveUrl?: string;
}

/** READY_FOR_DISPATCH → DISPATCHED. Freezes DispatchedQty = PackedQty per line,
 *  writes the OMS_Dispatches record, notifies the customer. */
export async function recordDispatch(actor: StaffSession, orderId: string, p: DispatchInput): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;
  if (order.status !== ORDER_STATUS.READY_FOR_DISPATCH) {
    return { ok: false, msg: `Order is "${order.status}", not ready for dispatch.` };
  }
  if (!p.transporter && !p.vehicleNo) return { ok: false, msg: 'Enter a transporter/courier or a vehicle number.' };

  const { rows } = await readSheet(D);
  const id = nextId(ID_PREFIX.DISPATCH, rows, 0);
  const now = new Date();
  await appendRow(D, [
    id, orderId, p.dispatchDate || now, String(p.transporter || '').trim(), String(p.awbLrNo || '').trim(),
    String(p.vehicleNo || '').trim(), String(p.remarks || '').trim(), String(p.docDriveUrl || '').trim(),
    actor.userId, actor.name, now,
  ]);

  const items = await itemsFor(orderId);
  const { rows: itemRows } = await readSheet(OI);
  const cells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
  for (const it of items) {
    const idx = itemRows.findIndex((r) => String(r[IC.ORDER]).trim() === orderId && Number(r[IC.LINE]) === it.lineNo);
    if (idx !== -1) {
      cells.push(
        { row1Based: idx + 2, col1Based: IC.DISPATCHED + 1, value: it.packedQty || it.availableQty || it.orderedQty },
        { row1Based: idx + 2, col1Based: IC.STATUS + 1, value: LINE_STATUS.DISPATCHED },
      );
    }
  }
  if (cells.length) await setCells(OI, cells);

  await setCells(O, [
    { row1Based: row1, col1Based: C.STATUS + 1, value: ORDER_STATUS.DISPATCHED },
    { row1Based: row1, col1Based: C.UPDATED + 1, value: now },
  ]);
  await pushHistory(orderId, order.status, ORDER_STATUS.DISPATCHED, staffActor(actor), [p.transporter, p.awbLrNo].filter(Boolean).join(' · '));
  await audit(staffActor(actor), 'DISPATCH', 'Order', orderId, order.status, ORDER_STATUS.DISPATCHED, id);
  await notify({ audience: 'Customer', customerId: order.customerId, orderId, type: 'Order Dispatched', message: `Your order ${orderId} has been dispatched${p.transporter ? ` via ${p.transporter}` : ''}${p.awbLrNo ? ` (${p.awbLrNo})` : ''}.` });
  return { ok: true, msg: `${orderId} dispatched.`, dispatchId: id };
}

export async function completeOrder(actor: StaffSession, orderId: string): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;
  if (order.status !== ORDER_STATUS.DISPATCHED) return { ok: false, msg: `Order is "${order.status}", not dispatched.` };
  await setCells(O, [
    { row1Based: row1, col1Based: C.STATUS + 1, value: ORDER_STATUS.COMPLETED },
    { row1Based: row1, col1Based: C.UPDATED + 1, value: new Date() },
  ]);
  await pushHistory(orderId, ORDER_STATUS.DISPATCHED, ORDER_STATUS.COMPLETED, staffActor(actor), '');
  await audit(staffActor(actor), 'COMPLETE', 'Order', orderId, ORDER_STATUS.DISPATCHED, ORDER_STATUS.COMPLETED, '');
  await notify({ audience: 'Customer', customerId: order.customerId, orderId, type: 'Order Completed', message: `Your order ${orderId} is complete. Thank you!` });
  return { ok: true, msg: `${orderId} completed.` };
}

export async function dispatchView(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) return null;
  const { rows } = await readSheet(D);
  const records = rows.filter((r) => String(r[DC.ORDER]).trim() === orderId).map((r) => ({
    dispatchId: String(r[DC.ID] ?? ''),
    dispatchDate: String(r[DC.DATE] ?? ''),
    transporter: String(r[DC.TRANS] ?? ''),
    awbLrNo: String(r[DC.AWB] ?? ''),
    vehicleNo: String(r[DC.VEH] ?? ''),
    remarks: String(r[DC.REMARKS] ?? ''),
    docDriveUrl: String(r[DC.DOC] ?? ''),
    dispatchedBy: String(r[DC.BYNAME] ?? ''),
  }));
  return { orderId, status: order.status, customerName: order.customerName, deliverySnapshot: order.deliverySnapshot, items: order.items ?? [], records };
}
