import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { listAddresses, addAddress } from '@/lib/oms/customers';

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return g.response;
  const addresses = await listAddresses(g.customer.customerId);
  return NextResponse.json({ ok: true, addresses });
}

export async function POST(req: Request) {
  const g = await requireCustomer();
  if (!g.ok) return g.response;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = await addAddress(g.customer, body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
