import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_WAREHOUSE } from '@/lib/oms/constants';
import { packingView, startPacking, savePacking, type PackLineInput } from '@/lib/oms/packing';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  const { id } = await params;
  const view = await packingView(id);
  if (!view) return NextResponse.json({ ok: false, msg: 'Order not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, ...view });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff(ROLE_WAREHOUSE);
  if (!g.ok) return g.response;
  const { id } = await params;
  let body: { action?: 'start' | 'save'; lines?: PackLineInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = body.action === 'save'
    ? await savePacking(g.user, id, body.lines || [])
    : await startPacking(g.user, id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
