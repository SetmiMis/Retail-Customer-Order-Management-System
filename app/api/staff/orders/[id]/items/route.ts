import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_ORDER_ENTRY } from '@/lib/oms/constants';
import { editOrderItems, type LineEdit } from '@/lib/oms/orderEdit';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff(ROLE_ORDER_ENTRY);
  if (!g.ok) return g.response;
  const { id } = await params;
  let body: { edits?: LineEdit[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = await editOrderItems(g.user, id, body.edits || []);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
