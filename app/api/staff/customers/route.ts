import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { listCustomers } from '@/lib/oms/customers';

export async function GET() {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  return NextResponse.json({ ok: true, customers: await listCustomers() });
}
