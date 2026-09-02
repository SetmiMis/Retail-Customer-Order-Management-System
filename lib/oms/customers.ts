import { OMS_SHEETS, ID_PREFIX } from './constants';
import { readSheet, readSheets, appendRow, setCells, nextId } from '../sheets/rows';
import { hashPassword, verifyPassword } from '../auth/hash';
import { audit, staffActor, customerActor, SYSTEM_ACTOR } from './audit';
import type { Customer, CustomerAddress, ServiceResult } from './types';
import type { CustomerSession, StaffSession } from '../auth/session';

const T = OMS_SHEETS.CUSTOMERS;
const A = OMS_SHEETS.ADDRESSES;

// OMS_Customers: CustomerID,CompanyName,ContactName,Phone,WhatsApp,Email,EmailLower,PassHash,GST,Status,CreatedAt,CreatedBy,LastLoginAt
const C = {
  ID: 0, COMPANY: 1, CONTACT: 2, PHONE: 3, WA: 4, EMAIL: 5, EMAIL_LC: 6,
  HASH: 7, GST: 8, STATUS: 9, CREATED: 10, CREATED_BY: 11, LAST_LOGIN: 12,
};
// OMS_CustomerAddresses: AddressID,CustomerID,Label,Line1,Line2,City,District,State,Pincode,ContactName,ContactPhone,IsDefault,Active,CreatedAt
const AC = {
  ID: 0, CUST: 1, LABEL: 2, L1: 3, L2: 4, CITY: 5, DIST: 6, STATE: 7, PIN: 8,
  CNAME: 9, CPHONE: 10, DEFAULT: 11, ACTIVE: 12, CREATED: 13,
};

const emailNorm = (e: unknown) => String(e || '').trim().toLowerCase();

function toCustomer(r: unknown[]): Customer {
  return {
    customerId: String(r[C.ID] ?? '').trim(),
    companyName: String(r[C.COMPANY] ?? '').trim(),
    contactName: String(r[C.CONTACT] ?? '').trim(),
    phone: String(r[C.PHONE] ?? '').trim(),
    whatsapp: String(r[C.WA] ?? '').trim(),
    email: String(r[C.EMAIL] ?? '').trim(),
    gst: String(r[C.GST] ?? '').trim(),
    status: String(r[C.STATUS] ?? '').trim() || 'Active',
    createdAt: String(r[C.CREATED] ?? '').trim(),
    lastLoginAt: String(r[C.LAST_LOGIN] ?? '').trim(),
  };
}

function toAddress(r: unknown[]): CustomerAddress {
  return {
    addressId: String(r[AC.ID] ?? '').trim(),
    customerId: String(r[AC.CUST] ?? '').trim(),
    label: String(r[AC.LABEL] ?? '').trim(),
    line1: String(r[AC.L1] ?? '').trim(),
    line2: String(r[AC.L2] ?? '').trim(),
    city: String(r[AC.CITY] ?? '').trim(),
    district: String(r[AC.DIST] ?? '').trim(),
    state: String(r[AC.STATE] ?? '').trim(),
    pincode: String(r[AC.PIN] ?? '').trim(),
    contactName: String(r[AC.CNAME] ?? '').trim(),
    contactPhone: String(r[AC.CPHONE] ?? '').trim(),
    isDefault: String(r[AC.DEFAULT] ?? '').toLowerCase() === 'true',
    active: String(r[AC.ACTIVE] ?? '').toLowerCase() !== 'false',
  };
}

function sessionFrom(c: Customer): CustomerSession {
  return {
    kind: 'customer',
    customerId: c.customerId,
    companyName: c.companyName,
    contactName: c.contactName,
    email: c.email,
    status: c.status,
  };
}

export async function registerCustomer(p: {
  companyName?: string; contactName?: string; phone?: string; whatsapp?: string;
  email?: string; password?: string; gst?: string;
}): Promise<ServiceResult & { session?: CustomerSession }> {
  const company = String(p.companyName || '').trim();
  const contact = String(p.contactName || '').trim();
  const phone = String(p.phone || '').trim();
  const email = String(p.email || '').trim();
  const password = String(p.password || '');
  if (!company || !contact || !phone || !email || !password) {
    return { ok: false, msg: 'Company, contact name, phone, email and password are all required.' };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, msg: 'Enter a valid email address.' };
  if (password.length < 8) return { ok: false, msg: 'Password must be at least 8 characters.' };

  const { rows } = await readSheet(T);
  if (rows.some((r) => emailNorm(r[C.EMAIL_LC] || r[C.EMAIL]) === emailNorm(email))) {
    return { ok: false, msg: 'An account with that email already exists. Try signing in.' };
  }
  const id = nextId(ID_PREFIX.CUSTOMER, rows, C.ID);
  const now = new Date();
  await appendRow(T, [
    id, company, contact, phone, String(p.whatsapp || phone).trim(), email, emailNorm(email),
    hashPassword(password), String(p.gst || '').trim(), 'Active', now, 'self', '',
  ]);
  const cust = toCustomer([id, company, contact, phone, p.whatsapp || phone, email, emailNorm(email), '', p.gst || '', 'Active', now, 'self', '']);
  await audit(SYSTEM_ACTOR, 'REGISTER_CUSTOMER', 'Customer', id, '', company, email);
  return { ok: true, msg: 'Account created.', id, session: sessionFrom(cust) };
}

export async function authenticateCustomer(email: string, password: string): Promise<CustomerSession | null> {
  const e = emailNorm(email);
  if (!e || !password) return null;
  const { rows } = await readSheet(T);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (emailNorm(r[C.EMAIL_LC] || r[C.EMAIL]) !== e) continue;
    if (String(r[C.STATUS] ?? '').trim() !== 'Active') return null;
    if (!verifyPassword(password, String(r[C.HASH] ?? ''))) return null;
    await setCells(T, [{ row1Based: i + 2, col1Based: C.LAST_LOGIN + 1, value: new Date() }]).catch(() => {});
    return sessionFrom(toCustomer(r));
  }
  return null;
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  const { rows } = await readSheet(T);
  const r = rows.find((x) => String(x[C.ID]).trim() === customerId);
  return r ? toCustomer(r) : null;
}

export async function listCustomers(): Promise<Customer[]> {
  const { rows } = await readSheet(T);
  return rows.filter((r) => r[C.ID]).map(toCustomer);
}

export async function updateCustomerProfile(
  session: CustomerSession,
  p: { companyName?: string; contactName?: string; phone?: string; whatsapp?: string; gst?: string; password?: string; currentPassword?: string },
): Promise<ServiceResult> {
  const { rows } = await readSheet(T);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][C.ID]).trim() !== session.customerId) continue;
    const row1 = i + 2;
    const cells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
    if (p.companyName !== undefined) cells.push({ row1Based: row1, col1Based: C.COMPANY + 1, value: p.companyName });
    if (p.contactName !== undefined) cells.push({ row1Based: row1, col1Based: C.CONTACT + 1, value: p.contactName });
    if (p.phone !== undefined) cells.push({ row1Based: row1, col1Based: C.PHONE + 1, value: p.phone });
    if (p.whatsapp !== undefined) cells.push({ row1Based: row1, col1Based: C.WA + 1, value: p.whatsapp });
    if (p.gst !== undefined) cells.push({ row1Based: row1, col1Based: C.GST + 1, value: p.gst });
    if (p.password) {
      if (p.password.length < 8) return { ok: false, msg: 'New password must be at least 8 characters.' };
      if (!verifyPassword(String(p.currentPassword || ''), String(rows[i][C.HASH] ?? ''))) {
        return { ok: false, msg: 'Current password is incorrect.' };
      }
      cells.push({ row1Based: row1, col1Based: C.HASH + 1, value: hashPassword(p.password) });
    }
    if (!cells.length) return { ok: false, msg: 'Nothing to update.' };
    await setCells(T, cells);
    await audit(customerActor(session), 'UPDATE_PROFILE', 'Customer', session.customerId, '', '', '');
    return { ok: true, msg: 'Profile updated.' };
  }
  return { ok: false, msg: 'Account not found.' };
}

/** Staff-side: activate / deactivate / reset a customer login. */
export async function setCustomerStatus(actor: StaffSession, customerId: string, status: string): Promise<ServiceResult> {
  const { rows } = await readSheet(T);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][C.ID]).trim() !== customerId) continue;
    await setCells(T, [{ row1Based: i + 2, col1Based: C.STATUS + 1, value: status }]);
    await audit(staffActor(actor), 'SET_CUSTOMER_STATUS', 'Customer', customerId, '', status, '');
    return { ok: true, msg: `Customer ${status}.` };
  }
  return { ok: false, msg: 'Customer not found.' };
}

/* ---------------- Addresses ---------------- */

export async function listAddresses(customerId: string): Promise<CustomerAddress[]> {
  const { rows } = await readSheet(A);
  return rows.filter((r) => r[AC.ID] && String(r[AC.CUST]).trim() === customerId && String(r[AC.ACTIVE] ?? '').toLowerCase() !== 'false').map(toAddress);
}

export async function addAddress(
  session: CustomerSession,
  p: { label?: string; line1?: string; line2?: string; city?: string; district?: string; state?: string; pincode?: string; contactName?: string; contactPhone?: string; isDefault?: boolean },
): Promise<ServiceResult> {
  if (!p.line1 || !p.city || !p.state || !p.pincode) return { ok: false, msg: 'Address line, city, state and pincode are required.' };
  const { rows } = await readSheet(A);
  const mine = rows.filter((r) => r[AC.ID] && String(r[AC.CUST]).trim() === session.customerId);
  const makeDefault = p.isDefault || mine.length === 0;

  if (makeDefault && mine.length) {
    // clear existing default flags
    const clears: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
    rows.forEach((r, idx) => {
      if (r[AC.ID] && String(r[AC.CUST]).trim() === session.customerId && String(r[AC.DEFAULT]).toLowerCase() === 'true') {
        clears.push({ row1Based: idx + 2, col1Based: AC.DEFAULT + 1, value: 'FALSE' });
      }
    });
    if (clears.length) await setCells(A, clears);
  }

  const id = nextId(ID_PREFIX.ADDRESS, rows, AC.ID);
  await appendRow(A, [
    id, session.customerId, String(p.label || 'Delivery').trim(), p.line1, String(p.line2 || '').trim(),
    p.city, String(p.district || '').trim(), p.state, p.pincode,
    String(p.contactName || session.contactName).trim(), String(p.contactPhone || '').trim(),
    makeDefault ? 'TRUE' : 'FALSE', 'TRUE', new Date(),
  ]);
  await audit(customerActor(session), 'ADD_ADDRESS', 'CustomerAddress', id, '', p.city, '');
  return { ok: true, msg: 'Address added.', id };
}

export async function updateAddress(
  session: CustomerSession,
  addressId: string,
  p: Partial<{ label: string; line1: string; line2: string; city: string; district: string; state: string; pincode: string; contactName: string; contactPhone: string; isDefault: boolean; active: boolean }>,
): Promise<ServiceResult> {
  const { rows } = await readSheet(A);
  const idx = rows.findIndex((r) => String(r[AC.ID]).trim() === addressId && String(r[AC.CUST]).trim() === session.customerId);
  if (idx === -1) return { ok: false, msg: 'Address not found.' };
  const row1 = idx + 2;
  const cells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
  const put = (col: number, v: unknown) => cells.push({ row1Based: row1, col1Based: col + 1, value: v });
  if (p.label !== undefined) put(AC.LABEL, p.label);
  if (p.line1 !== undefined) put(AC.L1, p.line1);
  if (p.line2 !== undefined) put(AC.L2, p.line2);
  if (p.city !== undefined) put(AC.CITY, p.city);
  if (p.district !== undefined) put(AC.DIST, p.district);
  if (p.state !== undefined) put(AC.STATE, p.state);
  if (p.pincode !== undefined) put(AC.PIN, p.pincode);
  if (p.contactName !== undefined) put(AC.CNAME, p.contactName);
  if (p.contactPhone !== undefined) put(AC.CPHONE, p.contactPhone);
  if (p.active !== undefined) put(AC.ACTIVE, p.active ? 'TRUE' : 'FALSE');
  if (p.isDefault) {
    rows.forEach((r, i) => {
      if (r[AC.ID] && String(r[AC.CUST]).trim() === session.customerId && String(r[AC.DEFAULT]).toLowerCase() === 'true') {
        cells.push({ row1Based: i + 2, col1Based: AC.DEFAULT + 1, value: 'FALSE' });
      }
    });
    put(AC.DEFAULT, 'TRUE');
  }
  if (!cells.length) return { ok: false, msg: 'Nothing to update.' };
  await setCells(A, cells);
  await audit(customerActor(session), 'UPDATE_ADDRESS', 'CustomerAddress', addressId, '', '', '');
  return { ok: true, msg: 'Address saved.' };
}

/** Snapshot string frozen onto an order at submit time. */
export function addressSnapshot(a: CustomerAddress | null, customerName: string): string {
  if (!a) return customerName;
  return [
    a.label ? `${a.label}:` : '',
    customerName,
    [a.line1, a.line2].filter(Boolean).join(', '),
    [a.city, a.district].filter(Boolean).join(', '),
    [a.state, a.pincode].filter(Boolean).join(' - '),
    a.contactName ? `Attn: ${a.contactName}` : '',
    a.contactPhone ? `Ph: ${a.contactPhone}` : '',
  ].filter(Boolean).join('\n');
}
