import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { getOrder } from '@/lib/oms/orders';
import { openLinksForOrder } from '@/lib/oms/requirementBridge';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ ok: false, code: 'NOT_FOUND', msg: 'Order not found.' }, { status: 404 });
  order.requirements = await openLinksForOrder(id).catch(() => []);
  return NextResponse.json({ ok: true, order });
}
