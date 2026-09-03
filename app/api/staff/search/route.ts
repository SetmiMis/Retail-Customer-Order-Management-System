import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { globalSearch } from '@/lib/oms/search';

export async function GET(req: Request) {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  const q = new URL(req.url).searchParams.get('q') || '';
  return NextResponse.json({ ok: true, ...(await globalSearch(q)) });
}
