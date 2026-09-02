import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_MANAGE } from '@/lib/oms/constants';
import { getAuditLog } from '@/lib/oms/audit';

export async function GET(req: Request) {
  const g = await requireStaff(ROLE_MANAGE);
  if (!g.ok) return g.response;
  const sp = new URL(req.url).searchParams;
  const entries = await getAuditLog({
    actor: sp.get('actor') || undefined,
    action: sp.get('action') || undefined,
    entity: sp.get('entity') || undefined,
    entityId: sp.get('entityId') || undefined,
    from: sp.get('from') || undefined,
    to: sp.get('to') || undefined,
    limit: sp.get('limit') ? Number(sp.get('limit')) : 300,
  });
  return NextResponse.json({ ok: true, entries });
}
