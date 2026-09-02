import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_MANAGE } from '@/lib/oms/constants';
import { listPfmsItems } from '@/lib/oms/products';

/** Read-only PFMS_Items list — populates the "link to PFMS item" picker on Products. */
export async function GET() {
  const g = await requireStaff(ROLE_MANAGE);
  if (!g.ok) return g.response;
  return NextResponse.json({ ok: true, items: await listPfmsItems() });
}
