import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { STAFF_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from '../oms/constants';
import type { OmsRole } from '../oms/constants';
import { readStaffToken, readCustomerToken, type StaffSession, type CustomerSession } from './session';

export async function getStaff(): Promise<StaffSession | null> {
  const jar = await cookies();
  return readStaffToken(jar.get(STAFF_SESSION_COOKIE)?.value);
}

export async function getCustomer(): Promise<CustomerSession | null> {
  const jar = await cookies();
  return readCustomerToken(jar.get(CUSTOMER_SESSION_COOKIE)?.value);
}

export type StaffGuard =
  | { ok: true; user: StaffSession }
  | { ok: false; response: NextResponse };

export type CustomerGuard =
  | { ok: true; customer: CustomerSession }
  | { ok: false; response: NextResponse };

const deny = (code: string, msg: string, status: number) =>
  NextResponse.json({ ok: false, code, msg }, { status });

/** Verifies the staff session, that the account is Active, and (when `roles` given) role membership. */
export async function requireStaff(roles?: readonly OmsRole[]): Promise<StaffGuard> {
  const user = await getStaff();
  if (!user) return { ok: false, response: deny('AUTH', 'Session expired — please sign in again.', 401) };
  if (user.status !== 'Active') return { ok: false, response: deny('AUTH', 'This account is inactive. Contact your administrator.', 403) };
  if (roles && roles.length && !roles.includes(user.role)) {
    return { ok: false, response: deny('FORBIDDEN', 'You do not have permission to do this.', 403) };
  }
  return { ok: true, user };
}

/** Verifies the customer portal session and that the account is Active. */
export async function requireCustomer(): Promise<CustomerGuard> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, response: deny('AUTH', 'Session expired — please sign in again.', 401) };
  if (customer.status !== 'Active') return { ok: false, response: deny('AUTH', 'This account is not active. Contact us for help.', 403) };
  return { ok: true, customer };
}
