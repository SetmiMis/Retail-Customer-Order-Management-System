import { NextResponse } from 'next/server';
import { registerCustomer } from '@/lib/oms/customers';
import { issueCustomerToken } from '@/lib/auth/session';
import { CUSTOMER_SESSION_COOKIE, AUTH_TTL_SECONDS } from '@/lib/oms/constants';

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = await registerCustomer(body);
  if (!result.ok || !result.session) {
    return NextResponse.json({ ok: false, msg: result.msg }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, id: result.id });
  res.cookies.set(CUSTOMER_SESSION_COOKIE, await issueCustomerToken(result.session), {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: AUTH_TTL_SECONDS, path: '/',
  });
  return res;
}
