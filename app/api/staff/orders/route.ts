import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_ORDER_ENTRY } from '@/lib/oms/constants';
import { listOrders, createOrder, type OrderFilter } from '@/lib/oms/orders';

export async function GET(req: Request) {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  const sp = new URL(req.url).searchParams;
  const filter: OrderFilter = {
    status: sp.get('status') || undefined,
    source: sp.get('source') || undefined,
    customerId: sp.get('customerId') || undefined,
    assignedStaff: sp.get('assignedStaff') || undefined,
    q: sp.get('q') || undefined,
  };
  return NextResponse.json({ ok: true, orders: await listOrders(filter) });
}

/** Staff creates an order on behalf of a customer (phone / WhatsApp / email intake). */
export async function POST(req: Request) {
  const g = await requireStaff(ROLE_ORDER_ENTRY);
  if (!g.ok) return g.response;
  let body: { customerId?: string; source?: string; items?: Array<{ productId: string; qty: number | string; remarks?: string }>; customerRemark?: string; deliveryAddressId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = await createOrder(
    { staff: g.user },
    { items: body.items || [], customerRemark: body.customerRemark, deliveryAddressId: body.deliveryAddressId, customerId: body.customerId, source: body.source },
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
