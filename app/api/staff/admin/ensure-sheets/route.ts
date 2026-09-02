import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_ADMIN } from '@/lib/oms/constants';
import { ensureSheets } from '@/lib/oms/ensure';
import { audit, staffActor } from '@/lib/oms/audit';

export async function POST() {
  const g = await requireStaff(ROLE_ADMIN);
  if (!g.ok) return g.response;
  const result = await ensureSheets();
  await audit(staffActor(g.user), 'ENSURE_SHEETS', 'System', 'schema', '', JSON.stringify(result), '');
  return NextResponse.json({ ok: true, ...result });
}
