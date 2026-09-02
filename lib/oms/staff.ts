import { OMS_SHEETS, OMS_ROLES, ID_PREFIX } from './constants';
import type { OmsRole } from './constants';
import { readSheet, appendRow, setCells, nextId } from '../sheets/rows';
import { hashPassword, verifyPassword } from '../auth/hash';
import { audit, staffActor } from './audit';
import type { StaffUser, ServiceResult } from './types';
import type { StaffSession } from '../auth/session';

const T = OMS_SHEETS.STAFF;
// HEADERS: UserID,Name,Email,Username,PassHash,Role,Status,CreatedAt,Phone
const C = { ID: 0, NAME: 1, EMAIL: 2, USERNAME: 3, HASH: 4, ROLE: 5, STATUS: 6, CREATED: 7, PHONE: 8 };

function toUser(r: unknown[]): StaffUser {
  return {
    userId: String(r[C.ID] ?? '').trim(),
    name: String(r[C.NAME] ?? '').trim(),
    email: String(r[C.EMAIL] ?? '').trim(),
    username: String(r[C.USERNAME] ?? '').trim(),
    role: (String(r[C.ROLE] ?? '').trim() as OmsRole) || 'SALES',
    status: String(r[C.STATUS] ?? '').trim() || 'Active',
    createdAt: String(r[C.CREATED] ?? '').trim(),
    phone: String(r[C.PHONE] ?? '').trim(),
  };
}

export async function authenticateStaff(username: string, password: string): Promise<StaffSession | null> {
  const u = String(username || '').trim().toLowerCase();
  if (!u || !password) return null;
  const { rows } = await readSheet(T);
  for (const r of rows) {
    if (String(r[C.USERNAME] ?? '').trim().toLowerCase() !== u) continue;
    if (String(r[C.STATUS] ?? '').trim() !== 'Active') return null;
    if (!verifyPassword(password, String(r[C.HASH] ?? ''))) return null;
    const user = toUser(r);
    return {
      kind: 'staff',
      userId: user.userId,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
  return null;
}

export async function listStaff(): Promise<StaffUser[]> {
  const { rows } = await readSheet(T);
  return rows.filter((r) => r[C.ID]).map(toUser);
}

export async function createStaff(
  actor: StaffSession,
  p: { name?: string; email?: string; username?: string; password?: string; role?: string; phone?: string },
): Promise<ServiceResult> {
  const name = String(p.name || '').trim();
  const username = String(p.username || '').trim().toLowerCase();
  const password = String(p.password || '');
  if (!name || !username || !password) return { ok: false, msg: 'Name, username and password are required.' };
  if (password.length < 8) return { ok: false, msg: 'Password must be at least 8 characters.' };
  const role = (OMS_ROLES as readonly string[]).includes(p.role ?? '') ? (p.role as OmsRole) : 'SALES';

  const { rows } = await readSheet(T);
  if (rows.some((r) => String(r[C.USERNAME] ?? '').trim().toLowerCase() === username)) {
    return { ok: false, msg: 'That username is taken.' };
  }
  const id = nextId(ID_PREFIX.STAFF, rows, C.ID);
  await appendRow(T, [
    id, name, String(p.email || '').trim(), username, hashPassword(password), role, 'Active', new Date(), String(p.phone || '').trim(),
  ]);
  await audit(staffActor(actor), 'CREATE_STAFF', 'StaffUser', id, '', role, name);
  return { ok: true, msg: `${name} added.`, id };
}

export async function updateStaff(
  actor: StaffSession,
  userId: string,
  p: { name?: string; email?: string; role?: string; status?: string; phone?: string; password?: string },
): Promise<ServiceResult> {
  const { rows } = await readSheet(T);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][C.ID]).trim() !== userId) continue;
    const row1 = i + 2;
    const cells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
    if (p.name !== undefined) cells.push({ row1Based: row1, col1Based: C.NAME + 1, value: p.name });
    if (p.email !== undefined) cells.push({ row1Based: row1, col1Based: C.EMAIL + 1, value: p.email });
    if (p.role !== undefined && (OMS_ROLES as readonly string[]).includes(p.role))
      cells.push({ row1Based: row1, col1Based: C.ROLE + 1, value: p.role });
    if (p.status !== undefined) cells.push({ row1Based: row1, col1Based: C.STATUS + 1, value: p.status });
    if (p.phone !== undefined) cells.push({ row1Based: row1, col1Based: C.PHONE + 1, value: p.phone });
    if (p.password) {
      if (p.password.length < 8) return { ok: false, msg: 'Password must be at least 8 characters.' };
      cells.push({ row1Based: row1, col1Based: C.HASH + 1, value: hashPassword(p.password) });
    }
    if (!cells.length) return { ok: false, msg: 'Nothing to update.' };
    await setCells(T, cells);
    await audit(staffActor(actor), 'UPDATE_STAFF', 'StaffUser', userId, '', JSON.stringify({ ...p, password: p.password ? '***' : undefined }), '');
    return { ok: true, msg: 'Saved.' };
  }
  return { ok: false, msg: 'User not found.' };
}
