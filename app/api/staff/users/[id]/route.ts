import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_ADMIN } from '@/lib/oms/constants';
import { updateStaff } from '@/lib/oms/staff';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff(ROLE_ADMIN);
  if (!g.ok) return g.response;
  const { id } = await params;
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = await updateStaff(g.user, id, body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
