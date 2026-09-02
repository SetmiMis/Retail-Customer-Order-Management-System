import { NextResponse } from 'next/server';
import { authenticateStaff } from '@/lib/oms/staff';
import { issueStaffToken } from '@/lib/auth/session';
import { STAFF_SESSION_COOKIE, AUTH_TTL_SECONDS } from '@/lib/oms/constants';
import { audit, staffActor } from '@/lib/oms/audit';

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const session = await authenticateStaff(body.username ?? '', body.password ?? '');
  if (!session) {
    await new Promise((r) => setTimeout(r, 600)); // slow credential stuffing
    return NextResponse.json({ ok: false, code: 'AUTH', msg: 'Wrong username or password.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, user: { name: session.name, role: session.role } });
  res.cookies.set(STAFF_SESSION_COOKIE, await issueStaffToken(session), {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: AUTH_TTL_SECONDS, path: '/',
  });
  await audit(staffActor(session), 'LOGIN', 'StaffUser', session.userId, '', '', '');
  return res;
}
