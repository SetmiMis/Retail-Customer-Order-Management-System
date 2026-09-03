import {
  OMS_SHEETS, ID_PREFIX, ORDER_STATUS, ORDER_TRANSITIONS, STATUS_OWNER_ROLE,
  HOLDABLE_STATUSES, CANCELLABLE_STATUSES, CONFIRM_STATUS, LINE_STATUS, PARTIAL_POLICY,
  customerFacingStep, NOTIFICATION_TYPES,
} from './constants';
import type { OmsRole, OrderStatus } from './constants';
import { readSheet, readSheets, appendRow, appendRows, setCells, nextId, nextOrderId } from '../sheets/rows';
import { fmtNice } from '../shared/format';
import { withLock } from '../sheets/lock';
import { audit, staffActor, customerActor, SYSTEM_ACTOR, type Actor } from './audit';
import { notify } from './notifications';
import { productsByIds } from './products';
import { listAddresses, addressSnapshot } from './customers';
import type { Order, OrderItem, OrderStatusEvent, CustomerOrderView, ServiceResult } from './types';
import type { StaffSession, CustomerSession } from '../auth/session';

const O = OMS_SHEETS.ORDERS;
const OI = OMS_SHEETS.ORDER_ITEMS;
const H = OMS_SHEETS.STATUS_HISTORY;

// OMS_Orders columns
const C = {
  ID: 0, CUST: 1, CUST_NAME: 2, SOURCE: 3, BY_TYPE: 4, BY_ID: 5, BY_NAME: 6, CREATED: 7,
  STATUS: 8, CONF_STATUS: 9, CONF_BY: 10, CONF_AT: 11, CONF_NOTE: 12, REMARK: 13,
  ADDR_ID: 14, ADDR_SNAP: 15, PARTIAL: 16, HOLD_REASON: 17, RESUME: 18,
  CANCEL_REASON: 19, CANCEL_BY: 20, CANCEL_AT: 21, ASSIGNED: 22, UPDATED: 23,
};
// OMS_OrderItems columns
const IC = {
  ORDER: 0, LINE: 1, PID: 2, PNAME: 3, SKU: 4, UNIT: 5, ORDERED: 6, CHECKED: 7,
  AVAIL: 8, SHORT: 9, PACKED: 10, DISPATCHED: 11, STATUS: 12, REMARKS: 13,
};

const numOrNull = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v));

function toOrder(r: unknown[]): Order {
  return {
    orderId: String(r[C.ID] ?? '').trim(),
    customerId: String(r[C.CUST] ?? '').trim(),
    customerName: String(r[C.CUST_NAME] ?? '').trim(),
    source: String(r[C.SOURCE] ?? '').trim(),
    createdByType: String(r[C.BY_TYPE] ?? '').trim(),
    createdByName: String(r[C.BY_NAME] ?? '').trim(),
    createdAt: String(r[C.CREATED] ?? '').trim(),
    status: String(r[C.STATUS] ?? '').trim(),
    confirmStatus: String(r[C.CONF_STATUS] ?? '').trim() || CONFIRM_STATUS.PENDING,
    confirmedBy: String(r[C.CONF_BY] ?? '').trim(),
    confirmedAt: String(r[C.CONF_AT] ?? '').trim(),
    confirmNote: String(r[C.CONF_NOTE] ?? '').trim(),
    customerRemark: String(r[C.REMARK] ?? '').trim(),
    deliveryAddressId: String(r[C.ADDR_ID] ?? '').trim(),
    deliverySnapshot: String(r[C.ADDR_SNAP] ?? '').trim(),
    partialPolicy: String(r[C.PARTIAL] ?? '').trim() || PARTIAL_POLICY.WAIT,
    holdReason: String(r[C.HOLD_REASON] ?? '').trim(),
    resumeStatus: String(r[C.RESUME] ?? '').trim(),
    cancelReason: String(r[C.CANCEL_REASON] ?? '').trim(),
    assignedStaff: String(r[C.ASSIGNED] ?? '').trim(),
    updatedAt: String(r[C.UPDATED] ?? '').trim(),
  };
}

function toItem(r: unknown[], rowNo: number): OrderItem {
  return {
    rowNo,
    lineNo: Number(r[IC.LINE]) || 0,
    productId: String(r[IC.PID] ?? '').trim(),
    productName: String(r[IC.PNAME] ?? '').trim(),
    sku: String(r[IC.SKU] ?? '').trim(),
    unit: String(r[IC.UNIT] ?? '').trim() || 'Pcs',
    orderedQty: Number(r[IC.ORDERED]) || 0,
    checkedQty: numOrNull(r[IC.CHECKED]),
    availableQty: numOrNull(r[IC.AVAIL]),
    shortQty: Number(r[IC.SHORT]) || 0,
    packedQty: Number(r[IC.PACKED]) || 0,
    dispatchedQty: Number(r[IC.DISPATCHED]) || 0,
    lineStatus: String(r[IC.STATUS] ?? '').trim() || LINE_STATUS.PENDING,
    remarks: String(r[IC.REMARKS] ?? '').trim(),
  };
}

async function itemsFor(orderId: string): Promise<OrderItem[]> {
  const { rows } = await readSheet(OI);
  const out: OrderItem[] = [];
  rows.forEach((r, i) => {
    if (String(r[IC.ORDER]).trim() === orderId) out.push(toItem(r, i + 2));
  });
  return out.sort((a, b) => a.lineNo - b.lineNo);
}

async function timelineFor(orderId: string): Promise<OrderStatusEvent[]> {
  const { rows } = await readSheet(H);
  return rows
    .filter((r) => String(r[1]).trim() === orderId)
    .map((r) => ({
      fromStatus: String(r[2] ?? '').trim(),
      toStatus: String(r[3] ?? '').trim(),
      byType: String(r[4] ?? '').trim(),
      byName: String(r[6] ?? '').trim(),
      at: String(r[7] ?? '').trim(),
      note: String(r[8] ?? '').trim(),
    }));
}

async function pushHistory(orderId: string, from: string, to: string, actor: Actor, note = ''): Promise<void> {
  const { rows } = await readSheet(H);
  const id = nextId(ID_PREFIX.HISTORY, rows, 0);
  await appendRow(H, [id, orderId, from, to, actor.type, actor.id, actor.name, new Date(), note]);
}

export interface NewOrderItemInput {
  productId: string;
  qty: number | string;
  remarks?: string;
}
export interface NewOrderInput {
  items: NewOrderItemInput[];
  customerRemark?: string;
  deliveryAddressId?: string;
  // staff-only:
  customerId?: string;
  source?: string;
}

/**
 * Create an order. `by` is either a customer (portal) or a staff member (phone/
 * WhatsApp/email intake). Lands at "Order Received" then immediately advances to
 * "Customer Confirmation Pending". Original ordered quantities are frozen here
 * and never overwritten by later checks.
 */
export async function createOrder(
  by: { staff?: StaffSession; customer?: CustomerSession },
  p: NewOrderInput,
): Promise<ServiceResult & { orderId?: string }> {
  const clean = (p.items || [])
    .map((it) => ({ productId: String(it.productId || '').trim(), qty: Number(it.qty), remarks: String(it.remarks || '').trim() }))
    .filter((it) => it.productId && it.qty > 0);
  if (!clean.length) return { ok: false, msg: 'Add at least one product with a quantity.' };

  const isStaff = !!by.staff;
  const customerId = isStaff ? String(p.customerId || '').trim() : by.customer!.customerId;
  if (!customerId) return { ok: false, msg: 'A customer must be selected.' };

  const source = isStaff
    ? (String(p.source || 'Phone Call').trim())
    : 'Customer Portal';

  // hydrate product names / units / SKUs
  const prodMap = await productsByIds(clean.map((c) => c.productId));
  for (const c of clean) {
    if (!prodMap.has(c.productId)) return { ok: false, msg: `Unknown product: ${c.productId}` };
  }

  // delivery snapshot
  let addrSnap = '';
  let addrId = String(p.deliveryAddressId || '').trim();
  let custName = isStaff ? '' : by.customer!.companyName;
  const addrs = await listAddresses(customerId).catch(() => []);
  if (!addrId) {
    const def = addrs.find((a) => a.isDefault) || addrs[0];
    addrId = def?.addressId || '';
    addrSnap = addressSnapshot(def || null, custName);
  } else {
    const a = addrs.find((x) => x.addressId === addrId) || null;
    addrSnap = addressSnapshot(a, custName);
  }

  const actor: Actor = isStaff ? staffActor(by.staff!) : customerActor(by.customer!);

  return withLock(async () => {
    const { rows: orderRows } = await readSheet(O);
    // resolve customer display name from the customers sheet when staff-created
    if (isStaff) {
      const { rows: custRows } = await readSheet(OMS_SHEETS.CUSTOMERS);
      const cr = custRows.find((r) => String(r[0]).trim() === customerId);
      custName = cr ? String(cr[1] ?? '').trim() : customerId;
      if (!addrSnap) addrSnap = custName;
    }

    const orderId = nextOrderId(orderRows);
    const now = new Date();

    const row = new Array(24).fill('');
    row[C.ID] = orderId;
    row[C.CUST] = customerId;
    row[C.CUST_NAME] = custName;
    row[C.SOURCE] = source;
    row[C.BY_TYPE] = actor.type;
    row[C.BY_ID] = actor.id;
    row[C.BY_NAME] = actor.name;
    row[C.CREATED] = now;
    row[C.STATUS] = ORDER_STATUS.CONFIRM_PENDING;
    row[C.CONF_STATUS] = CONFIRM_STATUS.PENDING;
    row[C.REMARK] = String(p.customerRemark || '').trim();
    row[C.ADDR_ID] = addrId;
    row[C.ADDR_SNAP] = addrSnap;
    row[C.PARTIAL] = PARTIAL_POLICY.WAIT;
    row[C.UPDATED] = now;
    await appendRow(O, row);

    await appendRows(OI, clean.map((c, idx) => {
      const pr = prodMap.get(c.productId)!;
      return [
        orderId, idx + 1, pr.productId, pr.name, pr.sku, pr.unit,
        c.qty, '', '', 0, 0, 0, LINE_STATUS.PENDING, c.remarks,
      ];
    }));

    await pushHistory(orderId, '', ORDER_STATUS.RECEIVED, actor, source);
    await pushHistory(orderId, ORDER_STATUS.RECEIVED, ORDER_STATUS.CONFIRM_PENDING, SYSTEM_ACTOR);
    await audit(actor, 'CREATE_ORDER', 'Order', orderId, '', ORDER_STATUS.CONFIRM_PENDING, `${clean.length} line(s) · ${source}`);
    await notify({
      audience: 'Internal', staffRole: 'SALES', orderId,
      type: NOTIFICATION_TYPES.ORDER_RECEIVED,
      message: `New order ${orderId} from ${custName} (${source}) — ${clean.length} item(s), confirmation pending.`,
    });

    return { ok: true, msg: `Order ${orderId} created.`, orderId };
  });
}

/* -------------------- Reads -------------------- */

export interface OrderFilter {
  status?: string;
  source?: string;
  customerId?: string;
  assignedStaff?: string;
  requirementPending?: boolean;
  quantityShort?: boolean;
  q?: string;
  from?: string;
  to?: string;
}

export async function listOrders(filter: OrderFilter = {}): Promise<Order[]> {
  const { rows } = await readSheet(O);
  let out = rows.filter((r) => r[C.ID]).map(toOrder);
  const f = filter;
  if (f.status) out = out.filter((o) => o.status === f.status);
  if (f.source) out = out.filter((o) => o.source === f.source);
  if (f.customerId) out = out.filter((o) => o.customerId === f.customerId);
  if (f.assignedStaff) out = out.filter((o) => o.assignedStaff === f.assignedStaff);
  if (f.q) {
    const t = f.q.toLowerCase();
    out = out.filter((o) => [o.orderId, o.customerName, o.customerRemark].some((v) => v.toLowerCase().includes(t)));
  }
  return out.reverse();
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const { rows } = await readSheet(O);
  const r = rows.find((x) => String(x[C.ID]).trim() === orderId);
  if (!r) return null;
  const order = toOrder(r);
  const [items, timeline] = await Promise.all([itemsFor(orderId), timelineFor(orderId)]);
  order.items = items;
  order.timeline = timeline;
  return order;
}

/** 1-based sheet row of an order (header = 1), or -1. */
async function orderRow1(orderId: string): Promise<{ row1: number; order: Order } | null> {
  const { rows } = await readSheet(O);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][C.ID]).trim() === orderId) return { row1: i + 2, order: toOrder(rows[i]) };
  }
  return null;
}

/* -------------------- Customer-facing (trimmed, isolated) -------------------- */

export async function listCustomerOrders(customerId: string): Promise<CustomerOrderView[]> {
  const orders = (await listOrders({ customerId }));
  const { [OI]: itemS, [OMS_SHEETS.DISPATCHES]: dispS } = await readSheets([OI, OMS_SHEETS.DISPATCHES]);
  const itemRows = itemS.rows;
  return orders.map((o) => {
    const mine = itemRows.filter((r) => String(r[IC.ORDER]).trim() === o.orderId);
    const step = customerFacingStep(o.status);
    // latest dispatch record for this order (cols: 1=OrderID,2=Date,3=Transporter,4=AWB,5=Vehicle)
    const disp = dispS.rows.filter((r) => String(r[1]).trim() === o.orderId).at(-1);
    return {
      orderId: o.orderId,
      createdAt: fmtNice(o.createdAt),
      status: o.status,
      stepLabel: step.label,
      stepIndex: step.index,
      itemCount: mine.length,
      customerRemark: o.customerRemark,
      deliverySnapshot: o.deliverySnapshot,
      items: mine.map((r) => ({ productName: String(r[IC.PNAME] ?? ''), unit: String(r[IC.UNIT] ?? 'Pcs'), orderedQty: Number(r[IC.ORDERED]) || 0, dispatchedQty: Number(r[IC.DISPATCHED]) || 0 })),
      arrangingItems: ([ORDER_STATUS.REQUIREMENT_PENDING, ORDER_STATUS.PARTIAL_AVAILABLE] as string[]).includes(o.status),
      dispatch: disp ? { date: fmtNice(String(disp[2] ?? '')), transporter: String(disp[3] ?? ''), awbLrNo: String(disp[4] ?? ''), vehicleNo: String(disp[5] ?? '') } : null,
    };
  });
}

export async function getCustomerOrder(customerId: string, orderId: string): Promise<CustomerOrderView | null> {
  const all = await listCustomerOrders(customerId);
  return all.find((o) => o.orderId === orderId) || null;
}

/* -------------------- Transitions -------------------- */

function canTransition(from: string, to: string): boolean {
  return (ORDER_TRANSITIONS[from] || []).includes(to as OrderStatus);
}

/** Generic guarded transition. Role gate = STATUS_OWNER_ROLE[from]. */
export async function transitionOrder(
  actor: StaffSession,
  orderId: string,
  to: OrderStatus,
  note = '',
): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;
  if (order.status === to) return { ok: true, msg: 'Already there.' };
  if (!canTransition(order.status, to)) {
    return { ok: false, msg: `Cannot move ${order.status} → ${to}.` };
  }
  const allowed = STATUS_OWNER_ROLE[order.status] || [];
  if (allowed.length && !allowed.includes(actor.role)) {
    return { ok: false, code: 'FORBIDDEN', msg: `Your role cannot action an order in "${order.status}".` };
  }
  await setCells(O, [
    { row1Based: row1, col1Based: C.STATUS + 1, value: to },
    { row1Based: row1, col1Based: C.UPDATED + 1, value: new Date() },
  ]);
  await pushHistory(orderId, order.status, to, staffActor(actor), note);
  await audit(staffActor(actor), 'TRANSITION', 'Order', orderId, order.status, to, note);

  if (to === ORDER_STATUS.READY_FOR_PACKING) {
    await notify({ audience: 'Internal', staffRole: 'WAREHOUSE', orderId, type: NOTIFICATION_TYPES.READY_FOR_PACKING, message: `${orderId} is ready for packing.` });
  } else if (to === ORDER_STATUS.READY_FOR_DISPATCH) {
    await notify({ audience: 'Internal', staffRole: 'DISPATCH', orderId, type: NOTIFICATION_TYPES.READY_FOR_DISPATCH, message: `${orderId} is ready for dispatch.` });
  }
  return { ok: true, msg: `Moved to ${to}.` };
}

/** Customer confirmation — staff records that the rate was agreed outside the system. */
export async function setConfirmation(
  actor: StaffSession,
  orderId: string,
  decision: 'Confirmed' | 'Cancelled',
  note = '',
): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;
  if (order.status !== ORDER_STATUS.CONFIRM_PENDING && order.status !== ORDER_STATUS.RECEIVED) {
    return { ok: false, msg: `Confirmation only applies while an order is awaiting it (currently "${order.status}").` };
  }
  const now = new Date();
  const toStatus = decision === 'Confirmed' ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.CANCELLED;
  await setCells(O, [
    { row1Based: row1, col1Based: C.CONF_STATUS + 1, value: decision },
    { row1Based: row1, col1Based: C.CONF_BY + 1, value: actor.name },
    { row1Based: row1, col1Based: C.CONF_AT + 1, value: now },
    { row1Based: row1, col1Based: C.CONF_NOTE + 1, value: note },
    { row1Based: row1, col1Based: C.STATUS + 1, value: toStatus },
    { row1Based: row1, col1Based: C.UPDATED + 1, value: now },
    ...(decision === 'Cancelled'
      ? [
          { row1Based: row1, col1Based: C.CANCEL_REASON + 1, value: note || 'Not confirmed by customer' },
          { row1Based: row1, col1Based: C.CANCEL_BY + 1, value: actor.name },
          { row1Based: row1, col1Based: C.CANCEL_AT + 1, value: now },
        ]
      : []),
  ]);
  await pushHistory(orderId, order.status, toStatus, staffActor(actor), note);
  await audit(staffActor(actor), 'CONFIRMATION', 'Order', orderId, order.confirmStatus, decision, note);
  if (decision === 'Confirmed') {
    await notify({ audience: 'Internal', staffRole: 'WAREHOUSE', orderId, type: NOTIFICATION_TYPES.CUSTOMER_CONFIRMED, message: `${orderId} confirmed by customer — ready for quantity check.` });
    await notify({ audience: 'Customer', customerId: order.customerId, orderId, type: 'Order Confirmed', message: `Your order ${orderId} is confirmed and being prepared.` });
  }
  return { ok: true, msg: decision === 'Confirmed' ? 'Customer confirmation recorded.' : 'Order cancelled.' };
}

export async function holdOrder(actor: StaffSession, orderId: string, reason: string): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;
  if (!HOLDABLE_STATUSES.includes(order.status as OrderStatus)) {
    return { ok: false, msg: `An order in "${order.status}" cannot be put on hold.` };
  }
  const now = new Date();
  await setCells(O, [
    { row1Based: row1, col1Based: C.RESUME + 1, value: order.status },
    { row1Based: row1, col1Based: C.HOLD_REASON + 1, value: reason },
    { row1Based: row1, col1Based: C.STATUS + 1, value: ORDER_STATUS.ON_HOLD },
    { row1Based: row1, col1Based: C.UPDATED + 1, value: now },
  ]);
  await pushHistory(orderId, order.status, ORDER_STATUS.ON_HOLD, staffActor(actor), reason);
  await audit(staffActor(actor), 'HOLD', 'Order', orderId, order.status, ORDER_STATUS.ON_HOLD, reason);
  return { ok: true, msg: 'Order placed on hold.' };
}

export async function resumeOrder(actor: StaffSession, orderId: string): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;
  if (order.status !== ORDER_STATUS.ON_HOLD) return { ok: false, msg: 'Order is not on hold.' };
  const back = order.resumeStatus || ORDER_STATUS.RECEIVED;
  const now = new Date();
  await setCells(O, [
    { row1Based: row1, col1Based: C.STATUS + 1, value: back },
    { row1Based: row1, col1Based: C.HOLD_REASON + 1, value: '' },
    { row1Based: row1, col1Based: C.RESUME + 1, value: '' },
    { row1Based: row1, col1Based: C.UPDATED + 1, value: now },
  ]);
  await pushHistory(orderId, ORDER_STATUS.ON_HOLD, back, staffActor(actor), 'Resumed');
  await audit(staffActor(actor), 'RESUME', 'Order', orderId, ORDER_STATUS.ON_HOLD, back, '');
  return { ok: true, msg: `Order resumed (${back}).` };
}

export async function cancelOrder(actor: StaffSession, orderId: string, reason: string): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;
  if (!CANCELLABLE_STATUSES.includes(order.status as OrderStatus)) {
    return { ok: false, msg: `An order in "${order.status}" cannot be cancelled.` };
  }
  const now = new Date();
  await setCells(O, [
    { row1Based: row1, col1Based: C.STATUS + 1, value: ORDER_STATUS.CANCELLED },
    { row1Based: row1, col1Based: C.CANCEL_REASON + 1, value: reason },
    { row1Based: row1, col1Based: C.CANCEL_BY + 1, value: actor.name },
    { row1Based: row1, col1Based: C.CANCEL_AT + 1, value: now },
    { row1Based: row1, col1Based: C.UPDATED + 1, value: now },
  ]);
  await pushHistory(orderId, order.status, ORDER_STATUS.CANCELLED, staffActor(actor), reason);
  await audit(staffActor(actor), 'CANCEL', 'Order', orderId, order.status, ORDER_STATUS.CANCELLED, reason);
  return { ok: true, msg: 'Order cancelled.' };
}

export async function setPartialPolicy(actor: StaffSession, orderId: string, policy: string): Promise<ServiceResult> {
  const valid = Object.values(PARTIAL_POLICY) as string[];
  if (!valid.includes(policy)) return { ok: false, msg: 'Invalid policy.' };
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  await setCells(O, [
    { row1Based: found.row1, col1Based: C.PARTIAL + 1, value: policy },
    { row1Based: found.row1, col1Based: C.UPDATED + 1, value: new Date() },
  ]);
  await audit(staffActor(actor), 'SET_PARTIAL_POLICY', 'Order', orderId, found.order.partialPolicy, policy, '');
  return { ok: true, msg: 'Partial-dispatch policy updated.' };
}

export async function assignOrder(actor: StaffSession, orderId: string, staffName: string): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  await setCells(O, [
    { row1Based: found.row1, col1Based: C.ASSIGNED + 1, value: staffName },
    { row1Based: found.row1, col1Based: C.UPDATED + 1, value: new Date() },
  ]);
  await audit(staffActor(actor), 'ASSIGN', 'Order', orderId, found.order.assignedStaff, staffName, '');
  return { ok: true, msg: `Assigned to ${staffName}.` };
}

/** Re-order: build a fresh NewOrderInput from a past order's lines (never mutates the old order). */
export async function reorderInput(customerId: string, sourceOrderId: string): Promise<ServiceResult & { input?: NewOrderInput }> {
  const { rows } = await readSheet(O);
  const src = rows.find((r) => String(r[C.ID]).trim() === sourceOrderId && String(r[C.CUST]).trim() === customerId);
  if (!src) return { ok: false, msg: 'Order not found.' };
  const items = await itemsFor(sourceOrderId);
  if (!items.length) return { ok: false, msg: 'That order has no items to reorder.' };
  return {
    ok: true,
    input: {
      items: items.map((it) => ({ productId: it.productId, qty: it.orderedQty, remarks: it.remarks })),
      deliveryAddressId: String(src[C.ADDR_ID] ?? '').trim(),
    },
  };
}

export const _colmaps = { C, IC };
export { itemsFor, orderRow1, pushHistory, canTransition };
export type { OmsRole };
