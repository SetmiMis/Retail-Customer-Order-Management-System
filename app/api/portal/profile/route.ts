import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { getCustomer, updateCustomerProfile } from '@/lib/oms/customers';

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return g.response;
  const c = await getCustomer(g.customer.customerId);
  if (!c) return NextResponse.json({ ok: false, msg: 'Account not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, profile: c });
}

export async function PATCH(req: Request) {
  const g = await requireCustomer();
  if (!g.ok) return g.response;
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  const result = await updateCustomerProfile(g.customer, body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
