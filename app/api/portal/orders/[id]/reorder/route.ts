import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { reorderInput, createOrder } from '@/lib/oms/orders';

/** Builds a fresh order from a past one and (unless ?draft) submits it as a NEW order. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireCustomer();
  if (!g.ok) return g.response;
  const { id } = await params;
  const draftOnly = new URL(req.url).searchParams.get('draft') === '1';

  const built = await reorderInput(g.customer.customerId, id);
  if (!built.ok || !built.input) return NextResponse.json({ ok: false, msg: built.msg }, { status: 400 });
  if (draftOnly) return NextResponse.json({ ok: true, input: built.input });

  const result = await createOrder({ customer: g.customer }, built.input);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
