import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_WAREHOUSE } from '@/lib/oms/constants';
import { allOpenLinks, reflectRequirementStatus } from '@/lib/oms/requirementBridge';

/** GET → open order↔requirement links (+ auto-reflects PFMS status first). */
export async function GET() {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  const reflect = await reflectRequirementStatus().catch(() => ({ updated: 0, satisfied: 0, ordersAdvanced: [] }));
  const links = await allOpenLinks();
  return NextResponse.json({ ok: true, links, reflect });
}

/** POST → force a reflect pass (WAREHOUSE/MANAGER/ADMIN). */
export async function POST() {
  const g = await requireStaff(ROLE_WAREHOUSE);
  if (!g.ok) return g.response;
  const reflect = await reflectRequirementStatus();
  return NextResponse.json({ ok: true, ...reflect });
}
