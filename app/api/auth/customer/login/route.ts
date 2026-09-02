import { NextResponse } from 'next/server';
import { authenticateCustomer } from '@/lib/oms/customers';
import { issueCustomerToken } from '@/lib/auth/session';
import { CUSTOMER_SESSION_COOKIE, AUTH_TTL_SECONDS } from '@/lib/oms/constants';

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const session = await authenticateCustomer(body.email ?? '', body.password ?? '');
  if (!session) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ ok: false, code: 'AUTH', msg: 'Wrong email or password.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, customer: { companyName: session.companyName } });
  res.cookies.set(CUSTOMER_SESSION_COOKIE, await issueCustomerToken(session), {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: AUTH_TTL_SECONDS, path: '/',
  });
  return res;
}
