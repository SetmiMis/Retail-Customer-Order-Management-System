import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { getCustomerOrder } from '@/lib/oms/orders';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireCustomer();
  if (!g.ok) return g.response;
  const { id } = await params;
  const order = await getCustomerOrder(g.customer.customerId, id);
  if (!order) return NextResponse.json({ ok: false, code: 'NOT_FOUND', msg: 'Order not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, order });
}
