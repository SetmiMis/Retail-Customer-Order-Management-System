import { OMS_SHEETS, ID_PREFIX } from './constants';
import { readSheet, appendRow, setCells, nextId } from '../sheets/rows';

const T = OMS_SHEETS.NOTIFICATIONS;
// NotifID,Audience,CustomerID,StaffRole,OrderID,Type,Message,Read,CreatedAt
const C = { ID: 0, AUD: 1, CUST: 2, ROLE: 3, ORDER: 4, TYPE: 5, MSG: 6, READ: 7, CREATED: 8 };

export interface NotifyInput {
  audience: 'Internal' | 'Customer';
  customerId?: string;
  staffRole?: string; // '' or 'ALL' = every staff member
  orderId?: string;
  type: string;
  message: string;
}

/** Appends a notification row. Never throws. */
export async function notify(p: NotifyInput): Promise<void> {
  try {
    const { rows } = await readSheet(T);
    const id = nextId(ID_PREFIX.NOTIFICATION, rows, C.ID);
    await appendRow(T, [
      id, p.audience, p.customerId || '', p.staffRole || 'ALL', p.orderId || '', p.type, p.message, 'FALSE', new Date(),
    ]);
  } catch {
    /* swallow */
  }
}

export interface NotificationRow {
  id: string;
  audience: string;
  orderId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

function toRow(r: unknown[]): NotificationRow {
  return {
    id: String(r[C.ID] ?? '').trim(),
    audience: String(r[C.AUD] ?? '').trim(),
    orderId: String(r[C.ORDER] ?? '').trim(),
    type: String(r[C.TYPE] ?? '').trim(),
    message: String(r[C.MSG] ?? '').trim(),
    read: String(r[C.READ] ?? '').toLowerCase() === 'true',
    createdAt: String(r[C.CREATED] ?? '').trim(),
  };
}

export async function listForStaff(role: string, limit = 50): Promise<NotificationRow[]> {
  const { rows } = await readSheet(T);
  return rows
    .filter((r) => r[C.ID] && String(r[C.AUD]).trim() === 'Internal' && ['ALL', '', role].includes(String(r[C.ROLE]).trim()))
    .map(toRow)
    .reverse()
    .slice(0, limit);
}

export async function listForCustomer(customerId: string, limit = 50): Promise<NotificationRow[]> {
  const { rows } = await readSheet(T);
  return rows
    .filter((r) => r[C.ID] && String(r[C.AUD]).trim() === 'Customer' && String(r[C.CUST]).trim() === customerId)
    .map(toRow)
    .reverse()
    .slice(0, limit);
}

export async function markRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const want = new Set(ids);
  const { rows } = await readSheet(T);
  const cells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
  rows.forEach((r, i) => {
    if (want.has(String(r[C.ID]).trim())) cells.push({ row1Based: i + 2, col1Based: C.READ + 1, value: 'TRUE' });
  });
  await setCells(T, cells);
}
