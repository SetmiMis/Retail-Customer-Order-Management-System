import { NextResponse } from 'next/server';
import { CUSTOMER_SESSION_COOKIE } from '@/lib/oms/constants';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 0, path: '/' });
  return res;
}
