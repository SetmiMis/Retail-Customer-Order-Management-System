import { SignJWT, jwtVerify } from 'jose';
import { AUTH_TTL_SECONDS } from '../oms/constants';
import type { OmsRole } from '../oms/constants';

/*****************************************************************
 * Two independent session identities, two cookies:
 *   - StaffSession   (oms_staff)  — an OMS_Users row, carries an OmsRole
 *   - CustomerSession (oms_cust)  — an OMS_Customers row, role is implicitly CUSTOMER
 * A browser can hold both at once (a staff member testing the portal), and the
 * guards only ever read the cookie they care about.
 *****************************************************************/

export interface StaffSession {
  kind: 'staff';
  userId: string;
  name: string;
  username: string;
  email: string;
  role: OmsRole;
  status: string;
}

export interface CustomerSession {
  kind: 'customer';
  customerId: string;
  companyName: string;
  contactName: string;
  email: string;
  status: string;
}

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Missing SESSION_SECRET env var.');
  return new TextEncoder().encode(secret);
}

async function sign(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TTL_SECONDS}s`)
    .sign(secretKey());
}

export function issueStaffToken(s: StaffSession): Promise<string> {
  return sign({ s });
}
export function issueCustomerToken(c: CustomerSession): Promise<string> {
  return sign({ c });
}

export async function readStaffToken(token: string | undefined | null): Promise<StaffSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const s = (payload as { s?: StaffSession }).s;
    if (!s || s.kind !== 'staff' || !s.userId || !s.role) return null;
    return s;
  } catch {
    return null;
  }
}

export async function readCustomerToken(token: string | undefined | null): Promise<CustomerSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const c = (payload as { c?: CustomerSession }).c;
    if (!c || c.kind !== 'customer' || !c.customerId) return null;
    return c;
  } catch {
    return null;
  }
}
