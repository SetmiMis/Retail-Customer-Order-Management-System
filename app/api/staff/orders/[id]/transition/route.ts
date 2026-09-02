import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_MANAGE } from '@/lib/oms/constants';
import { transitionOrder, holdOrder, resumeOrder, cancelOrder, setPartialPolicy, assignOrder } from '@/lib/oms/orders';
import type { OrderStatus } from '@/lib/oms/constants';

/**
 * One endpoint for the manual order-state actions:
 *  { action: 'transition', to, note }   (any staff — role-gated inside transitionOrder)
 *  { action: 'hold'|'resume'|'cancel', reason }   (MANAGER/ADMIN)
 *  { action: 'partialPolicy', policy } | { action: 'assign', staffName }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  const { id } = await params;
  let body: { action?: string; to?: string; note?: string; reason?: string; policy?: string; staffName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }

  const manageOnly = ['hold', 'resume', 'cancel', 'partialPolicy', 'assign'];
  if (manageOnly.includes(body.action || '') && !ROLE_MANAGE.includes(g.user.role)) {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN', msg: 'Manager or admin only.' }, { status: 403 });
  }

  let result;
  switch (body.action) {
    case 'transition':
      result = await transitionOrder(g.user, id, (body.to || '') as OrderStatus, body.note || '');
      break;
    case 'hold':
      result = await holdOrder(g.user, id, body.reason || '');
      break;
    case 'resume':
      result = await resumeOrder(g.user, id);
      break;
    case 'cancel':
      result = await cancelOrder(g.user, id, body.reason || '');
      break;
    case 'partialPolicy':
      result = await setPartialPolicy(g.user, id, body.policy || '');
      break;
    case 'assign':
      result = await assignOrder(g.user, id, body.staffName || '');
      break;
    default:
      return NextResponse.json({ ok: false, msg: 'Unknown action.' }, { status: 400 });
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
