import { OMS_SHEETS, ID_PREFIX, ORDER_STATUS, LINE_STATUS, PFMS_BRIDGE } from './constants';
import { readSheet, readSheets, appendRow, appendRows, setCells, nextId } from '../sheets/rows';
import { pfmsSheetId } from '../sheets/client';
import { withLock } from '../sheets/lock';
import { audit, staffActor, SYSTEM_ACTOR } from './audit';
import { notify } from './notifications';
import { itemsFor, orderRow1, pushHistory, _colmaps } from './orders';
import { getProduct } from './products';
import type { OrderRequirementLink, ServiceResult } from './types';
import type { StaffSession } from '../auth/session';

const O = OMS_SHEETS.ORDERS;
const OI = OMS_SHEETS.ORDER_ITEMS;
const RL = OMS_SHEETS.REQ_LINKS;
const { C, IC } = _colmaps;

// OMS_OrderRequirementLinks: LinkID,OrderID,OrderLineNo,ProductID,PfmsItemId,RequiredQty,RequirementID,ReqLineNo,MirroredStatus,Satisfied,CreatedByID,CreatedByName,CreatedAt,ClosedAt
const LC = {
  ID: 0, ORDER: 1, LINE: 2, PID: 3, PFMS: 4, QTY: 5, REQ: 6, REQ_LINE: 7,
  MIRROR: 8, SAT: 9, BY_ID: 10, BY_NAME: 11, CREATED: 12, CLOSED: 13,
};

function toLink(r: unknown[]): OrderRequirementLink {
  return {
    linkId: String(r[LC.ID] ?? '').trim(),
    orderId: String(r[LC.ORDER] ?? '').trim(),
    orderLineNo: Number(r[LC.LINE]) || 0,
    productId: String(r[LC.PID] ?? '').trim(),
    pfmsItemId: String(r[LC.PFMS] ?? '').trim(),
    requiredQty: Number(r[LC.QTY]) || 0,
    requirementId: String(r[LC.REQ] ?? '').trim(),
    reqLineNo: Number(r[LC.REQ_LINE]) || 0,
    mirroredStatus: String(r[LC.MIRROR] ?? '').trim(),
    satisfied: String(r[LC.SAT] ?? '').toLowerCase() === 'true',
    createdAt: String(r[LC.CREATED] ?? '').trim(),
    closedAt: String(r[LC.CLOSED] ?? '').trim(),
  };
}

export async function openLinksForOrder(orderId: string): Promise<OrderRequirementLink[]> {
  const { rows } = await readSheet(RL);
  return rows.filter((r) => r[LC.ID] && String(r[LC.ORDER]).trim() === orderId).map(toLink);
}

export async function allOpenLinks(): Promise<OrderRequirementLink[]> {
  const { rows } = await readSheet(RL);
  return rows.filter((r) => r[LC.ID] && String(r[LC.SAT]).toLowerCase() !== 'true').map(toLink);
}

/** Resolve the PFMS "OMS Bot" identity used to attribute raised requirements. */
async function botIdentity(): Promise<{ userId: string; name: string; role: string }> {
  const botId = process.env.PFMS_BOT_USER_ID || '';
  let name = 'OMS Bot';
  let role = 'REQUIREMENT_USER';
  try {
    const { rows } = await readSheet('PFMS_Users', pfmsSheetId()); // UserID,Name,Email,Username,PassHash,Role,Department,Status,CreatedAt,Phone
    const r = rows.find((x) => String(x[0]).trim() === botId);
    if (r) {
      name = String(r[1] ?? '').trim() || name;
      role = String(r[5] ?? '').trim() || role;
    }
  } catch {
    /* PFMS_Users not present — use defaults */
  }
  return { userId: botId || 'OMS-BOT', name, role };
}

export interface RaiseRequirementInput {
  lineNos: number[];
  requiredByDate?: string;
  purpose?: string;
}

/**
 * Append a customer-order shortfall into PFMS as a new Submitted requirement, and
 * record a two-way link. Never mutates existing PFMS rows. Every selected line must
 * map to a PFMS item (product.pfmsItemId); unmapped lines are reported back so an
 * admin can map them first.
 */
export async function raiseRequirement(
  actor: StaffSession,
  orderId: string,
  p: RaiseRequirementInput,
): Promise<ServiceResult & { requirementId?: string; unmapped?: string[] }> {
  const found = await orderRow1(orderId);
  if (!found) return { ok: false, msg: 'Order not found.' };
  const { row1, order } = found;

  const items = await itemsFor(orderId);
  const wanted = new Set((p.lineNos || []).map(Number));
  const targetLines = items.filter((it) => wanted.has(it.lineNo) && it.shortQty > 0);
  if (!targetLines.length) return { ok: false, msg: 'No short lines selected.' };

  const existing = await openLinksForOrder(orderId);
  const alreadyLinked = new Set(existing.filter((l) => !l.satisfied).map((l) => l.orderLineNo));

  const resolved: Array<{ lineNo: number; pfmsItemId: string; name: string; unit: string; qty: number; remarks: string }> = [];
  const unmapped: string[] = [];
  for (const it of targetLines) {
    if (alreadyLinked.has(it.lineNo)) continue;
    const prod = await getProduct(it.productId);
    if (!prod || !prod.pfmsItemId) {
      unmapped.push(it.productName || it.productId);
      continue;
    }
    resolved.push({ lineNo: it.lineNo, pfmsItemId: prod.pfmsItemId, name: prod.name, unit: it.unit, qty: it.shortQty, remarks: it.remarks });
  }
  if (unmapped.length && !resolved.length) {
    return { ok: false, code: 'UNMAPPED', msg: `These products are not linked to a PFMS item yet: ${unmapped.join(', ')}. An admin must map them under Products.`, unmapped };
  }
  if (!resolved.length) return { ok: false, msg: 'Selected lines are already linked to a requirement.' };

  const bot = await botIdentity();
  const purpose = (p.purpose || `Customer Order ${orderId} / ${order.customerName}`).slice(0, 480);

  const PFMS = pfmsSheetId();
  // Lock the PFMS spreadsheet itself — that's where the ID-generating reads/writes below
  // land, so a lock on this app's own sheet (the default) would give no real protection
  // against a concurrent write from the actual Purchase FMS app on the same sheet.
  const result = await withLock(async () => {
    const { [PFMS_BRIDGE.REQ]: reqS, [PFMS_BRIDGE.APPROVALS]: apS } = await readSheets([PFMS_BRIDGE.REQ, PFMS_BRIDGE.APPROVALS], PFMS);
    const reqId = nextId('REQ-', reqS.rows, 0, 3);
    const now = new Date();

    await appendRow(PFMS_BRIDGE.REQ, [
      reqId, now, p.requiredByDate || '', bot.userId, bot.name, 'Sales', purpose,
      PFMS_BRIDGE.SUBMITTED_STATUS, now, now,
    ], PFMS);
    await appendRows(PFMS_BRIDGE.REQ_ITEMS, resolved.map((r, idx) => [
      reqId, idx + 1, r.pfmsItemId, r.name, r.unit || 'Pcs', r.qty, '', '', r.remarks || `From ${orderId}`,
    ]), PFMS);
    const apId = nextId('AP-', apS.rows, 0, 3);
    await appendRow(PFMS_BRIDGE.APPROVALS, [
      apId, reqId, 'SUBMIT', bot.userId, bot.name, bot.role, '', purpose, now,
    ], PFMS);

    // OMS-side links + line status
    const { rows: linkRows } = await readSheet(RL);
    const baseLink = nextId(ID_PREFIX.REQ_LINK, linkRows, 0);
    const baseNum = Number(baseLink.slice(baseLink.lastIndexOf('-') + 1)) || 1;
    await appendRows(RL, resolved.map((r, idx) => [
      `${ID_PREFIX.REQ_LINK}${String(baseNum + idx).padStart(4, '0')}`,
      orderId, r.lineNo, items.find((it) => it.lineNo === r.lineNo)!.productId, r.pfmsItemId, r.qty,
      reqId, idx + 1, PFMS_BRIDGE.SUBMITTED_STATUS, 'FALSE', actor.userId, actor.name, now, '',
    ]));

    const { rows: itemRows } = await readSheet(OI);
    const cells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
    for (const r of resolved) {
      const idx = itemRows.findIndex((x) => String(x[IC.ORDER]).trim() === orderId && Number(x[IC.LINE]) === r.lineNo);
      if (idx !== -1) cells.push({ row1Based: idx + 2, col1Based: IC.STATUS + 1, value: LINE_STATUS.REQUIREMENT });
    }
    if (cells.length) await setCells(OI, cells);

    if (order.status !== ORDER_STATUS.REQUIREMENT_PENDING) {
      await setCells(O, [
        { row1Based: row1, col1Based: C.STATUS + 1, value: ORDER_STATUS.REQUIREMENT_PENDING },
        { row1Based: row1, col1Based: C.UPDATED + 1, value: now },
      ]);
      await pushHistory(orderId, order.status, ORDER_STATUS.REQUIREMENT_PENDING, staffActor(actor), `Raised ${reqId}`);
    }

    return { reqId, count: resolved.length };
  }, PFMS);

  await audit(staffActor(actor), 'RAISE_REQUIREMENT', 'Order', orderId, '', result.reqId, `${result.count} line(s) → PFMS`);
  await notify({ audience: 'Internal', staffRole: 'MANAGER', orderId, type: 'Requirement Created', message: `${orderId}: requirement ${result.reqId} raised in Purchase FMS for ${result.count} short item(s).` });

  return {
    ok: true,
    msg: `Requirement ${result.reqId} raised in Purchase FMS for ${result.count} item(s).${unmapped.length ? ` (Skipped unmapped: ${unmapped.join(', ')}.)` : ''}`,
    requirementId: result.reqId,
    unmapped: unmapped.length ? unmapped : undefined,
  };
}

/**
 * Poll PFMS_Requirements for every open link (optionally just one order) and reflect
 * progress back: update MirroredStatus; when PFMS reports the shortfall received/closed,
 * flip the link to Satisfied, restore the OMS order line to READY (available = ordered,
 * short = 0), and advance the order to Ready for Packing once every line is ready.
 */
export async function reflectRequirementStatus(orderId?: string): Promise<{ updated: number; satisfied: number; ordersAdvanced: string[] }> {
  const links = orderId ? (await openLinksForOrder(orderId)).filter((l) => !l.satisfied) : await allOpenLinks();
  if (!links.length) return { updated: 0, satisfied: 0, ordersAdvanced: [] };

  const { rows: reqRows } = await readSheet(PFMS_BRIDGE.REQ, pfmsSheetId()); // RequirementID..Status(idx 7)
  const statusByReq = new Map<string, string>();
  for (const r of reqRows) statusByReq.set(String(r[0]).trim(), String(r[7] ?? '').trim());

  const { rows: linkRows } = await readSheet(RL);
  const { rows: itemRows } = await readSheet(OI);
  const linkCells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
  const itemCells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
  const touchedOrders = new Set<string>();
  let updated = 0;
  let satisfied = 0;
  const now = new Date();

  for (const link of links) {
    const cur = statusByReq.get(link.requirementId);
    if (cur === undefined) continue;
    const idx = linkRows.findIndex((r) => String(r[LC.ID]).trim() === link.linkId);
    if (idx === -1) continue;
    const r1 = idx + 2;

    if (cur !== link.mirroredStatus) {
      linkCells.push({ row1Based: r1, col1Based: LC.MIRROR + 1, value: cur });
      updated += 1;
    }
    if (PFMS_BRIDGE.DONE_STATUSES.has(cur)) {
      linkCells.push(
        { row1Based: r1, col1Based: LC.SAT + 1, value: 'TRUE' },
        { row1Based: r1, col1Based: LC.CLOSED + 1, value: now },
      );
      satisfied += 1;
      touchedOrders.add(link.orderId);
      const li = itemRows.findIndex((x) => String(x[IC.ORDER]).trim() === link.orderId && Number(x[IC.LINE]) === link.orderLineNo);
      if (li !== -1) {
        const ordered = Number(itemRows[li][IC.ORDERED]) || 0;
        itemCells.push(
          { row1Based: li + 2, col1Based: IC.AVAIL + 1, value: ordered },
          { row1Based: li + 2, col1Based: IC.SHORT + 1, value: 0 },
          { row1Based: li + 2, col1Based: IC.STATUS + 1, value: LINE_STATUS.READY },
        );
      }
    }
  }
  if (linkCells.length) await setCells(RL, linkCells);
  if (itemCells.length) await setCells(OI, itemCells);

  // Advance orders whose lines are now all READY.
  const ordersAdvanced: string[] = [];
  for (const oid of touchedOrders) {
    const items = await itemsFor(oid);
    const allReady = items.length > 0 && items.every((it) => it.lineStatus === LINE_STATUS.READY);
    const found = await orderRow1(oid);
    if (!found) continue;
    if (allReady && found.order.status !== ORDER_STATUS.READY_FOR_PACKING) {
      await setCells(O, [
        { row1Based: found.row1, col1Based: C.STATUS + 1, value: ORDER_STATUS.READY_FOR_PACKING },
        { row1Based: found.row1, col1Based: C.UPDATED + 1, value: now },
      ]);
      await pushHistory(oid, found.order.status, ORDER_STATUS.READY_FOR_PACKING, SYSTEM_ACTOR, 'All requirements satisfied');
      await notify({ audience: 'Internal', staffRole: 'WAREHOUSE', orderId: oid, type: 'Ready for Packing', message: `${oid} — required items received, ready for packing.` });
      ordersAdvanced.push(oid);
    } else if (!allReady && found.order.status === ORDER_STATUS.REQUIREMENT_PENDING) {
      // some satisfied, some pending → Partially Available
      const someReady = items.some((it) => it.lineStatus === LINE_STATUS.READY);
      if (someReady) {
        await setCells(O, [{ row1Based: found.row1, col1Based: C.STATUS + 1, value: ORDER_STATUS.PARTIAL_AVAILABLE }]);
        await pushHistory(oid, found.order.status, ORDER_STATUS.PARTIAL_AVAILABLE, SYSTEM_ACTOR, 'Partial requirement satisfied');
      }
    }
  }

  return { updated, satisfied, ordersAdvanced };
}
