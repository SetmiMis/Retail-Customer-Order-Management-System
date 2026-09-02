import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { ROLE_WAREHOUSE } from '@/lib/oms/constants';
import { raiseRequirement } from '@/lib/oms/requirementBridge';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff(ROLE_WAREHOUSE);
  if (!g.ok) return g.response;
  const { id } = await params;
  let body: { lineNos?: number[]; requiredByDate?: string; purpose?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Bad request.' }, { status: 400 });
  }
  if (!body.lineNos?.length) return NextResponse.json({ ok: false, msg: 'Select at least one short line.' }, { status: 400 });
  const result = await raiseRequirement(g.user, id, { lineNos: body.lineNos, requiredByDate: body.requiredByDate, purpose: body.purpose });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
