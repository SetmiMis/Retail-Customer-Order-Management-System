import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { updateAddress } from '@/lib/oms/customers';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireCustomer();
  if (!g.ok) return g.response;
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = await updateAddress(g.customer, id, body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
