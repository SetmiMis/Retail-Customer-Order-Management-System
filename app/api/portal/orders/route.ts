import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { listCustomerOrders, createOrder } from '@/lib/oms/orders';

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return g.response;
  const orders = await listCustomerOrders(g.customer.customerId);
  return NextResponse.json({ ok: true, orders });
}

export async function POST(req: Request) {
  const g = await requireCustomer();
  if (!g.ok) return g.response;
  let body: { items?: Array<{ productId: string; qty: number | string; remarks?: string }>; customerRemark?: string; deliveryAddressId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = await createOrder(
    { customer: g.customer },
    { items: body.items || [], customerRemark: body.customerRemark, deliveryAddressId: body.deliveryAddressId },
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
