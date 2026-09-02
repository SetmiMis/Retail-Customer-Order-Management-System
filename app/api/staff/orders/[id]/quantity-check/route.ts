import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_WAREHOUSE } from '@/lib/oms/constants';
import { recordQuantityCheck, quantityCheckView, type LineCheckInput } from '@/lib/oms/quantity';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  const { id } = await params;
  const view = await quantityCheckView(id);
  if (!view) return NextResponse.json({ ok: false, msg: 'Order not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, ...view });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff(ROLE_WAREHOUSE);
  if (!g.ok) return g.response;
  const { id } = await params;
  let body: { lines?: LineCheckInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = await recordQuantityCheck(g.user, id, body.lines || []);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
