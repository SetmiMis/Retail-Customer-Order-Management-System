import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_MANAGE } from '@/lib/oms/constants';
import { getReports } from '@/lib/oms/reports';

export async function GET(req: Request) {
  const g = await requireStaff(ROLE_MANAGE);
  if (!g.ok) return g.response;
  const sp = new URL(req.url).searchParams;
  const bundle = await getReports({ from: sp.get('from') || undefined, to: sp.get('to') || undefined });
  return NextResponse.json({ ok: true, ...bundle });
}
