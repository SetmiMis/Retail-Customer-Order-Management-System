import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_CONFIRM } from '@/lib/oms/constants';
import { setConfirmation } from '@/lib/oms/orders';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff(ROLE_CONFIRM);
  if (!g.ok) return g.response;
  const { id } = await params;
  let body: { decision?: 'Confirmed' | 'Cancelled'; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  if (body.decision !== 'Confirmed' && body.decision !== 'Cancelled') {
    return NextResponse.json({ ok: false, msg: 'decision must be Confirmed or Cancelled.' }, { status: 400 });
  }
  const result = await setConfirmation(g.user, id, body.decision, body.note || '');
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
