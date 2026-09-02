import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_DISPATCH } from '@/lib/oms/constants';
import { dispatchView, recordDispatch, completeOrder, type DispatchInput } from '@/lib/oms/dispatch';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  const { id } = await params;
  const view = await dispatchView(id);
  if (!view) return NextResponse.json({ ok: false, msg: 'Order not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, ...view });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff(ROLE_DISPATCH);
  if (!g.ok) return g.response;
  const { id } = await params;
  let body: ({ action?: 'dispatch' | 'complete' } & DispatchInput);
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = body.action === 'complete'
    ? await completeOrder(g.user, id)
    : await recordDispatch(g.user, id, body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
