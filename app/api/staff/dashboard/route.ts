import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { getDashboard } from '@/lib/oms/dashboard';

export async function GET() {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  return NextResponse.json({ ok: true, ...(await getDashboard()) });
}
