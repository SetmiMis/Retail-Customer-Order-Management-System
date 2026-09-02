import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { listForCustomer, markRead } from '@/lib/oms/notifications';

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return g.response;
  return NextResponse.json({ ok: true, notifications: await listForCustomer(g.customer.customerId) });
}

export async function POST(req: Request) {
  const g = await requireCustomer();
  if (!g.ok) return g.response;
  let body: { ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  await markRead(body.ids || []);
  return NextResponse.json({ ok: true });
}
