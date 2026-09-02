import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_MANAGE } from '@/lib/oms/constants';
import { setCustomerStatus } from '@/lib/oms/customers';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff(ROLE_MANAGE);
  if (!g.ok) return g.response;
  const { id } = await params;
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  if (!body.status) return NextResponse.json({ ok: false, msg: 'status is required.' }, { status: 400 });
  const result = await setCustomerStatus(g.user, id, body.status);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
