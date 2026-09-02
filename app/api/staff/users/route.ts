import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_ADMIN } from '@/lib/oms/constants';
import { listStaff, createStaff } from '@/lib/oms/staff';

export async function GET() {
  const g = await requireStaff(ROLE_ADMIN);
  if (!g.ok) return g.response;
  return NextResponse.json({ ok: true, users: await listStaff() });
}

export async function POST(req: Request) {
  const g = await requireStaff(ROLE_ADMIN);
  if (!g.ok) return g.response;
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = await createStaff(g.user, body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
