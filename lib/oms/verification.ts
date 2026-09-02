import { OMS_SHEETS, ID_PREFIX, ORDER_STATUS, VERIFICATION_CHECKS } from './constants';
import { readSheet, appendRows, setCells, nextId } from '../sheets/rows';
import { audit, staffActor } from './audit';
import { notify } from './notifications';
import { listOrders, getOrder, orderRow1, pushHistory, _colmaps } from './orders';
import type { Order, ServiceResult } from './types';
import type { StaffSession } from '../auth/session';

const O = OMS_SHEETS.ORDERS;
const FV = OMS_SHEETS.VERIFICATION;
const { C } = _colmaps;
// OMS_FinalVerification: VerID,OrderID,CheckKey,Passed,VerifiedByID,VerifiedByName,VerifiedAt,Note
const VC = { ID: 0, ORDER: 1, KEY: 2, PASSED: 3, BYID: 4, BYNAME: 5, AT: 6, NOTE: 7 };

export async function verificationQueue(): Promise<Order[]> {
  return (await listOrders()).filter((o) => o.status === ORDER_STATUS.FINAL_VERIFICATION);
}

export interface VerifyInput { key: string; passed: boolean; note?: string }

/** Records the 7-point checklist. All checks must pass to move
 *  FINAL_VERIFICATION → READY_FOR_DISPATCH. Re-submitting replaces prior rows. */
export async function saveVerification(actor: StaffSession, orderId: string, checks: VerifyInput[]): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;
  if (order.status !== ORDER_STATUS.FINAL_VERIFICATION) return { ok: false, msg: `Order is "${order.status}", not in final verification.` };

  const valid = new Set<string>(VERIFICATION_CHECKS);
  const clean = checks.filter((c) => valid.has(c.key));
  const byKey = new Map(clean.map((c) => [c.key, c]));

  // wipe prior rows for this order, then append fresh
  const { rows } = await readSheet(FV);
  const clearCells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
  rows.forEach((r, i) => {
    if (String(r[VC.ORDER]).trim() === orderId) {
      for (let c = 0; c < 8; c++) clearCells.push({ row1Based: i + 2, col1Based: c + 1, value: '' });
    }
  });
  if (clearCells.length) await setCells(FV, clearCells);

  const base = nextId(ID_PREFIX.VERIFICATION, rows, 0);
  const baseN = Number(base.slice(base.lastIndexOf('-') + 1)) || 1;
  const now = new Date();
  await appendRows(FV, VERIFICATION_CHECKS.map((key, i) => {
    const c = byKey.get(key);
    return [`${ID_PREFIX.VERIFICATION}${String(baseN + i).padStart(4, '0')}`, orderId, key, c?.passed ? 'TRUE' : 'FALSE', actor.userId, actor.name, now, c?.note || ''];
  }));

  const allPass = VERIFICATION_CHECKS.every((k) => byKey.get(k)?.passed);
  if (allPass) {
    await setCells(O, [
      { row1Based: row1, col1Based: C.STATUS + 1, value: ORDER_STATUS.READY_FOR_DISPATCH },
      { row1Based: row1, col1Based: C.UPDATED + 1, value: now },
    ]);
    await pushHistory(orderId, ORDER_STATUS.FINAL_VERIFICATION, ORDER_STATUS.READY_FOR_DISPATCH, staffActor(actor), 'All checks passed');
    await notify({ audience: 'Internal', staffRole: 'DISPATCH', orderId, type: 'Ready for Dispatch', message: `${orderId} passed final verification — ready to dispatch.` });
  }
  await audit(staffActor(actor), 'FINAL_VERIFICATION', 'Order', orderId, '', allPass ? ORDER_STATUS.READY_FOR_DISPATCH : ORDER_STATUS.FINAL_VERIFICATION, `${clean.filter((c) => c.passed).length}/${VERIFICATION_CHECKS.length} passed`);
  return { ok: true, msg: allPass ? 'Verified — ready for dispatch.' : 'Saved. All 7 checks must pass to proceed.' };
}

export async function verificationView(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) return null;
  const { rows } = await readSheet(FV);
  const saved = new Map(rows.filter((r) => String(r[VC.ORDER]).trim() === orderId).map((r) => [String(r[VC.KEY]), String(r[VC.PASSED]).toLowerCase() === 'true']));
  return {
    orderId,
    status: order.status,
    customerName: order.customerName,
    items: order.items ?? [],
    deliverySnapshot: order.deliverySnapshot,
    checks: VERIFICATION_CHECKS.map((key) => ({ key, passed: saved.get(key) ?? false })),
  };
}
