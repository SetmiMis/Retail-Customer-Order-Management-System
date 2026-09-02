import { OMS_SHEETS, ID_PREFIX, ORDER_STATUS, LINE_STATUS, STATUS_OWNER_ROLE } from './constants';
import { readSheet, appendRows, setCells, nextId } from '../sheets/rows';
import { audit, staffActor } from './audit';
import { notify } from './notifications';
import { getOrder, itemsFor, orderRow1, pushHistory, _colmaps } from './orders';
import { openLinksForOrder } from './requirementBridge';
import type { ServiceResult } from './types';
import type { StaffSession } from '../auth/session';

const O = OMS_SHEETS.ORDERS;
const OI = OMS_SHEETS.ORDER_ITEMS;
const QC = OMS_SHEETS.QTY_CHECKS;
const { C, IC } = _colmaps;

export interface LineCheckInput {
  lineNo: number;
  checkedQty: number | string;   // physically counted
  availableQty: number | string; // what can be committed to THIS order now
  remarks?: string;
}

/**
 * Record a warehouse quantity check. There is no stock ledger in the system —
 * `availableQty` is the human count the warehouse commits to this order. Original
 * OrderedQty is never touched; we only write CheckedQty / AvailableQty / ShortQty
 * / LineStatus. Moving the order out of "Customer Confirmed" into "Quantity Check"
 * happens automatically on the first check.
 */
export async function recordQuantityCheck(
  actor: StaffSession,
  orderId: string,
  lines: LineCheckInput[],
): Promise<ServiceResult> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;

  const allowRoles = STATUS_OWNER_ROLE[ORDER_STATUS.CONFIRMED] || STATUS_OWNER_ROLE[ORDER_STATUS.QTY_CHECK] || [];
  if (allowRoles.length && !allowRoles.includes(actor.role)) {
    return { ok: false, code: 'FORBIDDEN', msg: 'Only warehouse staff can run a quantity check.' };
  }
  if (![ORDER_STATUS.CONFIRMED, ORDER_STATUS.QTY_CHECK, ORDER_STATUS.REQUIREMENT_PENDING, ORDER_STATUS.PARTIAL_AVAILABLE].includes(order.status as never)) {
    return { ok: false, msg: `Quantity check does not apply to an order in "${order.status}".` };
  }

  const items = await itemsFor(orderId);
  const byLine = new Map(items.map((it) => [it.lineNo, it]));
  const links = await openLinksForOrder(orderId); // lines already handed to PFMS
  const linkedLines = new Set(links.filter((l) => !l.satisfied).map((l) => l.orderLineNo));

  const { rows: itemRows } = await readSheet(OI);
  const cellWrites: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
  const qcRows: unknown[][] = [];
  let qcSeq = 0;
  const { rows: qcExisting } = await readSheet(QC);
  const baseId = nextId(ID_PREFIX.QTY_CHECK, qcExisting, 0);
  const baseNum = Number(baseId.slice(baseId.lastIndexOf('-') + 1)) || 1;

  for (const ln of lines) {
    const it = byLine.get(Number(ln.lineNo));
    if (!it) continue;
    const checked = Math.max(0, Number(ln.checkedQty) || 0);
    const available = Math.max(0, Math.min(Number(ln.availableQty) || 0, it.orderedQty));
    const shortQty = Math.max(0, it.orderedQty - available);

    let lineStatus: string;
    if (linkedLines.has(it.lineNo)) {
      lineStatus = LINE_STATUS.REQUIREMENT; // keep — bridge reflect-back owns this line now
    } else if (shortQty === 0) {
      lineStatus = LINE_STATUS.READY;
    } else if (available > 0) {
      lineStatus = LINE_STATUS.SHORT;
    } else {
      lineStatus = LINE_STATUS.SHORT;
    }

    // find the sheet row for this order line
    const rowIdx = itemRows.findIndex(
      (r) => String(r[IC.ORDER]).trim() === orderId && Number(r[IC.LINE]) === it.lineNo,
    );
    if (rowIdx !== -1) {
      const r1 = rowIdx + 2;
      cellWrites.push(
        { row1Based: r1, col1Based: IC.CHECKED + 1, value: checked },
        { row1Based: r1, col1Based: IC.AVAIL + 1, value: available },
        { row1Based: r1, col1Based: IC.SHORT + 1, value: shortQty },
        { row1Based: r1, col1Based: IC.STATUS + 1, value: lineStatus },
      );
      if (ln.remarks !== undefined) cellWrites.push({ row1Based: r1, col1Based: IC.REMARKS + 1, value: String(ln.remarks) });
    }

    qcSeq += 1;
    qcRows.push([
      `${ID_PREFIX.QTY_CHECK}${String(baseNum + qcSeq - 1).padStart(4, '0')}`,
      orderId, it.lineNo, it.productId, it.orderedQty, checked, available, shortQty,
      lineStatus, actor.userId, actor.name, new Date(), String(ln.remarks || ''),
    ]);
  }

  if (cellWrites.length) await setCells(OI, cellWrites);
  if (qcRows.length) await appendRows(QC, qcRows);

  // Recompute order status from the full line picture.
  const refreshed = await itemsFor(orderId);
  const anyShortUnlinked = refreshed.some(
    (it) => it.lineStatus === LINE_STATUS.SHORT && !linkedLines.has(it.lineNo),
  );
  const anyRequirement = refreshed.some((it) => it.lineStatus === LINE_STATUS.REQUIREMENT) || linkedLines.size > 0;
  const allReady = refreshed.every((it) => it.lineStatus === LINE_STATUS.READY);

  let newStatus: string = order.status;
  if (allReady) newStatus = ORDER_STATUS.READY_FOR_PACKING;
  else if (anyRequirement) newStatus = ORDER_STATUS.REQUIREMENT_PENDING;
  else if (anyShortUnlinked) newStatus = ORDER_STATUS.QTY_CHECK;
  else newStatus = ORDER_STATUS.QTY_CHECK;

  if (newStatus !== order.status) {
    await setCells(O, [
      { row1Based: row1, col1Based: C.STATUS + 1, value: newStatus },
      { row1Based: row1, col1Based: C.UPDATED + 1, value: new Date() },
    ]);
    await pushHistory(orderId, order.status, newStatus, staffActor(actor), 'Quantity check');
    if (newStatus === ORDER_STATUS.READY_FOR_PACKING) {
      await notify({ audience: 'Internal', staffRole: 'WAREHOUSE', orderId, type: 'Ready for Packing', message: `${orderId} — all items available, ready for packing.` });
    }
  }
  if (anyShortUnlinked) {
    await notify({ audience: 'Internal', staffRole: 'MANAGER', orderId, type: 'Quantity Short', message: `${orderId} has short quantities — decide: raise requirement or allow partial.` });
  }

  await audit(staffActor(actor), 'QUANTITY_CHECK', 'Order', orderId, order.status, newStatus, `${qcRows.length} line(s)`);
  return { ok: true, msg: 'Quantity check saved.', status: newStatus };
}

/** Convenience: the check screen's current picture (ordered vs checked vs available vs short). */
export async function quantityCheckView(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) return null;
  const links = await openLinksForOrder(orderId);
  return {
    orderId,
    status: order.status,
    partialPolicy: order.partialPolicy,
    lines: (order.items || []).map((it) => {
      const link = links.find((l) => l.orderLineNo === it.lineNo);
      return {
        lineNo: it.lineNo,
        productId: it.productId,
        productName: it.productName,
        unit: it.unit,
        orderedQty: it.orderedQty,
        checkedQty: it.checkedQty,
        availableQty: it.availableQty,
        shortQty: it.shortQty,
        lineStatus: it.lineStatus,
        requirementId: link?.requirementId || '',
        requirementStatus: link?.mirroredStatus || '',
        requirementSatisfied: !!link?.satisfied,
      };
    }),
  };
}
