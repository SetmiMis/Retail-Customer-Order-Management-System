import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_WAREHOUSE } from '@/lib/oms/constants';
import { verificationView, saveVerification, type VerifyInput } from '@/lib/oms/verification';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  const { id } = await params;
  const view = await verificationView(id);
  if (!view) return NextResponse.json({ ok: false, msg: 'Order not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, ...view });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff(ROLE_WAREHOUSE);
  if (!g.ok) return g.response;
  const { id } = await params;
  let body: { checks?: VerifyInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = await saveVerification(g.user, id, body.checks || []);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
