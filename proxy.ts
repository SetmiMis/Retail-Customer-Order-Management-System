import { NextRequest, NextResponse } from 'next/server';
import {
  STAFF_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  AUTH_TTL_SECONDS,
} from './lib/oms/constants';
import {
  readStaffToken,
  readCustomerToken,
  issueStaffToken,
  issueCustomerToken,
} from './lib/auth/session';

/*****************************************************************
 * Route auth gate (Next 16 "proxy"). Two identities:
 *   /portal/**  + /api/portal/**  -> customer session (oms_cust)
 *   /staff/**   + everything else -> staff session    (oms_staff)
 * Per-ROLE checks live in each API route via lib/auth/guard.ts requireStaff().
 * This only enforces "signed in as the right kind". Sessions slide on every hit.
 *****************************************************************/
export const config = {
  matcher: ['/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};

const PUBLIC_PATHS = new Set<string>([
  '/',
  '/staff/login',
  '/portal/login',
  '/portal/register',
  '/portal/forgot',
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/api/auth/')) return true;
  return false;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const isPortal = pathname.startsWith('/portal') || pathname.startsWith('/api/portal');
  const isApi = pathname.startsWith('/api/');

  if (isPortal) {
    const token = req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
    const c = await readCustomerToken(token);
    if (!c) {
      if (isApi) return NextResponse.json({ ok: false, code: 'AUTH', msg: 'Please sign in again.' }, { status: 401 });
      const url = new URL('/portal/login', req.url);
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    const res = NextResponse.next();
    res.cookies.set(CUSTOMER_SESSION_COOKIE, await issueCustomerToken(c), {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: AUTH_TTL_SECONDS, path: '/',
    });
    return res;
  }

  // staff area
  const token = req.cookies.get(STAFF_SESSION_COOKIE)?.value;
  const s = await readStaffToken(token);
  if (!s) {
    if (isApi) return NextResponse.json({ ok: false, code: 'AUTH', msg: 'Please sign in again.' }, { status: 401 });
    const url = new URL('/staff/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.cookies.set(STAFF_SESSION_COOKIE, await issueStaffToken(s), {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: AUTH_TTL_SECONDS, path: '/',
  });
  return res;
}
